// 截图结果在后台生成、在结果页展示；图片可能很大，用 IndexedDB 传递，只保留最近一张
import { clear, createStore, get, set } from 'idb-keyval';
import type { PageInfo } from '../collect/capture';

export interface Screenshot {
  blob: Blob;
  /** 截图时读取的页面信息，结果页收藏时使用 */
  page: PageInfo;
}

const store = createStore('tabyard-screenshot', 'shots');

export async function putScreenshot(shot: Screenshot): Promise<string> {
  const id = crypto.randomUUID();
  await clear(store);
  await set(id, shot, store);
  return id;
}

export function getScreenshot(id: string): Promise<Screenshot | undefined> {
  return get<Screenshot>(id, store);
}
