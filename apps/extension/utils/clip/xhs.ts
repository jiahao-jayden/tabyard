// 小红书笔记数据在页面 MAIN world 的 window.__INITIAL_STATE__ 里，isolated world 读不到

export interface XhsNote {
  title: string;
  desc: string;
  images: string[];
}

export function isXhsNoteUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?xiaohongshu\.com\/(explore|discovery\/item)\//.test(url);
}

/** 通过 scripting.executeScript({ world: 'MAIN' }) 注入，必须自包含 */
export function readXhsNote(): XhsNote | null {
  type Dict = Record<string, unknown>;
  const asDict = (v: unknown): Dict => (v && typeof v === 'object' ? (v as Dict) : {});
  // 部分字段被包成 { value } 的 ref 结构
  const unwrap = (v: unknown): string => (typeof v === 'string' ? v : String(asDict(v).value ?? ''));

  const state = (window as unknown as { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__;
  const noteModule = asDict(asDict(state).note);
  const map = asDict(noteModule.noteDetailMap);
  const urlId = location.pathname.match(/\/(?:explore|discovery\/item)\/([0-9a-fA-F]+)/)?.[1];
  const id = urlId || unwrap(noteModule.currentNoteId) || unwrap(noteModule.firstNoteId);
  const entry = (id && map[id]) || map[Object.keys(map)[0] ?? ''];
  const note = asDict(asDict(entry).note ?? entry);

  const list = note.imageList ?? note.imagesList;
  const images = Array.isArray(list)
    ? list
        .map((im) => {
          const d = asDict(im);
          return String(d.urlDefault || d.url || d.urlPre || '');
        })
        .filter(Boolean)
    : [];
  const title = String(note.title ?? '').trim();
  const desc = String(note.desc ?? '').trim();
  return title || desc || images.length ? { title, desc, images } : null;
}
