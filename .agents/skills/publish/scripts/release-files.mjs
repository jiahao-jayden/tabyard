// 从仓库根目录运行。stdout 是 Release 正文，stderr 是附件路径与摘要。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const { version } = json('apps/extension/package.json');
assert.match(version, /^\d+(?:\.\d+){2,3}$/, 'Expected a Chrome extension version');
assert.equal(json('package-lock.json').packages['apps/extension'].version, version, 'Lockfile version mismatch');

const { CHANGELOG } = await import(pathToFileURL(resolve('packages/shared/src/changelog.ts')).href);
const entry = CHANGELOG[0];
assert.equal(entry?.version, version, 'Latest changelog version mismatch');
assert.equal(CHANGELOG.filter((item) => item.version === version).length, 1, 'Duplicate changelog version');

const archive = `apps/extension/dist/tabyardextension-${version}-chrome.zip`;
const unzip = (...args) => execFileSync('unzip', args, { encoding: 'utf8' });
unzip('-tq', archive);
const paths = unzip('-Z1', archive).trimEnd().split('\n');
assert.ok(paths.every((path) => !/(^|\/)(\.env(?:\.[^/]*)?|\.dev\.vars(?:\.[^/]*)?|\.git|node_modules)(\/|$)|\.(pem|key)$/i.test(path)), 'Unexpected local file in ZIP');
const manifest = JSON.parse(unzip('-p', archive, 'manifest.json'));
assert.equal(manifest.manifest_version, 3, 'Expected Manifest V3');
assert.equal(manifest.version, version, 'ZIP version mismatch');

const notes = [entry.zh, entry.en].map(({ title, items }) => {
  assert.ok(title?.trim() && Array.isArray(items) && items.length && items.every((item) => item.trim()), 'Incomplete release notes');
  return [`## ${title}`, '', ...items.map((item) => `- ${item}`)].join('\n');
});
const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
console.error(`${archive}  sha256:${digest}`);
console.log(notes.join('\n\n'));
