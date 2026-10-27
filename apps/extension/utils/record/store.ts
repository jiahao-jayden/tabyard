// 录屏分片边录边写入 IndexedDB，避免长时间录制把视频全部压在内存里；只保留最近一段
import { clear, createStore, entries, get, set } from 'idb-keyval';

export interface RecordingMeta {
  mimeType: string;
  title: string;
  url: string;
}

const store = createStore('tabyard-recordings', 'chunks');
const META = 'meta';

const chunkKey = (index: number) => `chunk:${String(index).padStart(8, '0')}`;

export function resetRecording(): Promise<void> {
  return clear(store);
}

export function putMeta(meta: RecordingMeta & { id: string }): Promise<void> {
  return set(META, meta, store);
}

export function putChunk(index: number, chunk: Blob): Promise<void> {
  return set(chunkKey(index), chunk, store);
}

export async function loadRecording(id: string): Promise<(RecordingMeta & { blob: Blob }) | null> {
  const meta = await get<RecordingMeta & { id: string }>(META, store);
  if (!meta || meta.id !== id) return null;
  const chunks = (await entries<string, Blob>(store))
    .filter(([key]) => key.startsWith('chunk:'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, blob]) => blob);
  return { ...meta, blob: new Blob(chunks, { type: meta.mimeType }) };
}
