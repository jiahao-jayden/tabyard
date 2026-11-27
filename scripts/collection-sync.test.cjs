// Run with: node --test scripts/collection-sync.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === '@tabyard/shared') return load('packages/shared/src/index.ts', mocks, cache);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache);
    return require(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const shared = load('packages/shared/src/index.ts');
const settings = { enabled: true, fallback: 'none', otherGroupName: '', otherColor: 'grey', autoCollapse: false, insertPosition: 'end' };
const bookmark = (id, updatedAt = 1) => ({ id, url: `https://example.com/${id}`, title: id, description: '', image: '', favicon: '', folderId: null, createdAt: 1, updatedAt });
const collection = (...bookmarks) => ({ ...shared.emptyCollect(), bookmarks });
const record = (collect, modifiedAt) => ({ data: { settings, groups: [], ...(collect ? { collect } : {}) }, modifiedAt });

// Each fixture isolates storage, Web Locks, network, and the extension module cache.
function fixture(initial = {}) {
  const state = structuredClone({ plan: 'pro', ...initial });
  const locks = new Map();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request(name, fn) {
      const next = (locks.get(name) ?? Promise.resolve()).then(fn);
      locks.set(name, next.catch(() => {}));
      return next;
    },
  } } });
  const storage = {
    async get(keys) {
      return structuredClone(Object.fromEntries((typeof keys === 'string' ? [keys] : keys).map((k) => [k, state[k]])));
    },
    async set(patch) { Object.assign(state, structuredClone(patch)); },
  };
  const mocks = { 'wxt/browser': { browser: { storage: { local: storage } } }, './api': { API_URL: 'https://test.invalid' } };
  const cache = new Map();
  return { state, sync: load('apps/extension/utils/sync.ts', mocks, cache), store: load('apps/extension/utils/collect/store.ts', mocks, cache) };
}

test('collection conflicts keep independent edits and honor deletion, re-addition, folder removal', () => {
  const remote = collection(bookmark('a', 5), bookmark('b', 5));
  remote.folders = [{ id: 'folder', name: 'Folder', updatedAt: 1 }];
  remote.bookmarks[0].folderId = 'folder';
  const local = collection(bookmark('b', 8), bookmark('c', 7));
  local.deletedBookmarks[bookmark('a').url] = 6;
  local.deletedFolders.folder = 6;
  let merged = shared.mergeCollect(remote, local, true);
  assert.deepEqual(merged.bookmarks.map((b) => b.id).sort(), ['b', 'c']);
  assert.equal(merged.bookmarks.find((b) => b.id === 'b').updatedAt, 8);
  remote.bookmarks[0].updatedAt = 9;
  merged = shared.mergeCollect(remote, local, false);
  assert.equal(merged.bookmarks.find((b) => b.id === 'a').folderId, null);
  assert.equal(merged.folders.length, 0);
});

test('free users make no sync requests; Pro still respects server 401/403', async () => {
  const f = fixture({ plan: 'free' });
  global.fetch = async () => { throw new Error('must not fetch'); };
  assert.equal(await f.sync.syncNow(), 'skipped');
  f.state.plan = 'pro';
  for (const status of [401, 403]) {
    global.fetch = async () => new Response(null, { status });
    assert.equal(await f.sync.syncNow(), 'skipped');
  }
});

test('legacy local collection uploads on first sync and merges with cloud', async () => {
  const f = fixture({ collect: { bookmarks: [bookmark('local')], folders: [] }, modifiedAt: 10, syncedAt: 10 });
  let uploaded;
  global.fetch = async (_url, options) => {
    if (options.method === 'PUT') { uploaded = JSON.parse(options.body); return Response.json({ ok: true }); }
    return Response.json({ record: record(collection(bookmark('remote')), 20) });
  };
  assert.equal(await f.sync.syncNow(), 'ok');
  assert.deepEqual(uploaded.data.collect.bookmarks.map((b) => b.id).sort(), ['local', 'remote']);
  assert.equal(f.state.syncedAt, uploaded.modifiedAt);
});

test('clean device pulls collection; old records preserve local collection', async () => {
  const f = fixture({ collectSyncReady: true, collect: collection(bookmark('local')), modifiedAt: 10, syncedAt: 10 });
  global.fetch = async () => Response.json({ record: record(undefined, 20) });
  assert.equal(await f.sync.syncNow(), 'ok');
  assert.equal(f.state.collect.bookmarks[0].id, 'local');
  global.fetch = async () => Response.json({ record: record(collection(bookmark('remote')), 30) });
  assert.equal(await f.sync.syncNow(), 'ok');
  assert.equal(f.state.collect.bookmarks[0].id, 'remote');
});

test('concurrent writes serialize; edit during upload remains dirty; deletes create tombstones', async () => {
  const f = fixture({ collectSyncReady: true });
  await Promise.all([f.store.addBookmark(bookmark('a')), f.store.addBookmark(bookmark('b'))]);
  assert.equal(f.state.collect.bookmarks.length, 2);
  global.fetch = async (_url, options) => {
    if (options.method === 'PUT') {
      await f.store.addBookmark(bookmark('during-upload'));
      return Response.json({ ok: true });
    }
    return Response.json({ record: null });
  };
  assert.equal(await f.sync.syncNow(), 'ok');
  assert.ok(f.state.modifiedAt > f.state.syncedAt);
  await f.store.removeBookmarkByUrl(bookmark('a').url);
  assert.ok(f.state.collect.deletedBookmarks[bookmark('a').url]);
});

test('409 retries merge latest remote; offline/failure do not acknowledge local edits', async () => {
  const f = fixture({ collectSyncReady: true, collect: collection(bookmark('local')), modifiedAt: 10, syncedAt: 0 });
  let puts = 0;
  global.fetch = async (_url, options) => {
    if (options.method === 'PUT') return new Response(null, { status: ++puts === 1 ? 409 : 200 });
    return Response.json({ record: puts ? record(collection(bookmark('other')), 20) : null });
  };
  assert.equal(await f.sync.syncNow(), 'ok');
  assert.equal(puts, 2);
  assert.equal(f.state.collect.bookmarks.length, 2);
  await f.store.addBookmark(bookmark('offline'));
  const syncedAt = f.state.syncedAt;
  global.fetch = async () => { throw new Error('offline'); };
  assert.equal(await f.sync.syncNow(), 'error');
  assert.equal(f.state.syncedAt, syncedAt);
  global.fetch = async () => new Response(null, { status: 500 });
  assert.equal(await f.sync.syncNow(), 'error');
  assert.equal(f.state.syncedAt, syncedAt);
});

test('server gates plans, validates payloads and preserves collection from older clients using real SQL', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE sync (userId TEXT PRIMARY KEY, data TEXT NOT NULL, modifiedAt INTEGER NOT NULL)');
  let user = null;
  let pro = false;
  class HttpError extends Error { constructor(status, code) { super(code); this.status = status; } }
  const api = load('apps/web/src/server/sync.ts', {
    'cloudflare:workers': { env: { DB: { prepare(sql) { return { bind(...args) {
      const stmt = db.prepare(sql);
      return { async first() { return stmt.get(...args) ?? null; }, async run() { return { meta: { changes: Number(stmt.run(...args).changes) } }; } };
    } }; } } } },
    './billing': { getUser: async () => user, isPro: async () => pro },
    './packs': { HttpError },
  });
  await assert.rejects(api.requireProUser(new Headers()), { status: 401 });
  user = { id: 'user' };
  await assert.rejects(api.requireProUser(new Headers()), { status: 403 });
  pro = true;
  assert.equal(await api.requireProUser(new Headers()), 'user');
  await assert.rejects(api.putSync('user', '{'), { status: 400 });
  await assert.rejects(api.putSync('user', JSON.stringify(record({ bookmarks: [{}], folders: [] }, 1))), { status: 400 });
  await assert.rejects(api.putSync('user', '中'.repeat(200_000)), { status: 413 });
  assert.equal((await api.putSync('user', JSON.stringify(record(collection(bookmark('a')), 1)))).conflict, null);
  assert.ok((await api.putSync('user', JSON.stringify(record(undefined, 1)))).conflict);
  await api.putSync('user', JSON.stringify(record(undefined, 2)));
  assert.equal((await api.getSync('user')).data.collect.bookmarks[0].id, 'a');
  await api.putSync('user', JSON.stringify(record(shared.emptyCollect(), 3)));
  assert.equal((await api.getSync('user')).data.collect.bookmarks.length, 0);
  db.close();
});

test('MCP imports preserve provided preview URLs and keep them on subsequent edits', async () => {
  let snapshot = record(collection(), 1);
  const tools = new Map();
  class McpServer {
    registerTool(name, config, call) { tools.set(name, { config, call }); }
  }
  const api = load('apps/web/src/server/mcp.ts', {
    '@modelcontextprotocol/server': {
      McpServer,
      createMcpHandler(build) { return { async fetch() { build(); return new Response(); }, close() {} }; },
    },
    'cloudflare:workers': { env: { DB: { prepare(sql) { return { bind(body, modifiedAt) {
      return { async run() {
        if (sql.includes('UPDATE sync SET')) snapshot = { data: JSON.parse(body), modifiedAt };
        return { meta: { changes: 1 } };
      } };
    } }; } } } },
    './billing': {},
    './sync': { getSync: async () => snapshot },
  });
  await api.handleMcp(new Request('https://example.com/api/mcp'), 'user');
  const { config, call } = tools.get('add_bookmarks');
  const url = 'https://example.com/page';
  const image = 'https://example.com/cover.png';
  const favicon = 'https://example.com/icon.svg';
  const save = async (item) => {
    const result = await call(config.inputSchema.parse({ items: [{ url, ...item }] }));
    assert.ok(!result.isError, result.content[0].text);
  };
  await save({ image, favicon });
  await save({ title: 'Renamed' });
  assert.equal(snapshot.data.collect.bookmarks.length, 1);
  assert.equal(snapshot.data.collect.bookmarks[0].image, image);
  assert.equal(snapshot.data.collect.bookmarks[0].favicon, favicon);
  await save({ image: image + '?v=2' });
  assert.equal(snapshot.data.collect.bookmarks[0].image, image + '?v=2');
  assert.equal(config.inputSchema.safeParse({ items: [{ url, image: 'file:///cover.png' }] }).success, false);
});
