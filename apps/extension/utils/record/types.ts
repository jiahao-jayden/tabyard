// 录屏在 popup、后台、offscreen 文档和页面控制栏之间传递的数据
import type { Region } from '../page';

export type RecordMode = 'tab' | 'region';
export type RecordQuality = '720p' | '1080p';

export interface RecordOptions {
  mode: RecordMode;
  mic: boolean;
  /** 空字符串表示系统默认设备 */
  micDeviceId: string;
  tabAudio: boolean;
  camera: boolean;
  cameraDeviceId: string;
  /** 页面上的控制栏与标注工具条 */
  controls: boolean;
  quality: RecordQuality;
}

export const DEFAULT_RECORD_OPTIONS: RecordOptions = {
  mode: 'tab',
  mic: false,
  micDeviceId: '',
  tabAudio: true,
  camera: false,
  cameraDeviceId: '',
  controls: true,
  quality: '1080p',
};

export const RECORD_OPTIONS_KEY = 'recordOptions';

/** 录制中的状态，存 storage.session：Service Worker 被回收后仍能恢复 */
export interface RecordState {
  id: string;
  tabId: number;
  options: RecordOptions;
  startedAt: number;
  /** 暂停开始的时间，未暂停为 null */
  pausedAt: number | null;
  /** 已累计的暂停时长 */
  pausedMs: number;
}

export function elapsedMs(state: Pick<RecordState, 'startedAt' | 'pausedAt' | 'pausedMs'>, now = Date.now()): number {
  return (state.pausedAt ?? now) - state.startedAt - state.pausedMs;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** popup / 页面控制栏 → 后台 */
export type RecordCommand =
  | { type: 'record-start'; tabId: number; options: RecordOptions; hint: string }
  | { type: 'record-state' }
  | { type: 'record-pause' }
  | { type: 'record-resume' }
  | { type: 'record-stop' };

/** 后台 → offscreen 文档 */
export type OffscreenCommand =
  | {
    target: 'offscreen';
    type: 'start';
    id: string;
    streamId: string;
    options: RecordOptions;
    region: Region | null;
    title: string;
    url: string;
  }
  | { target: 'offscreen'; type: 'pause' }
  | { target: 'offscreen'; type: 'resume' }
  | { target: 'offscreen'; type: 'stop' };

/** offscreen 文档 → 后台：录制结束（主动停止或标签页关闭导致画面中断） */
export interface RecordFinished {
  type: 'record-finished';
  id: string;
}

/** 后台 → 页面控制栏 */
export const OVERLAY_REMOVE = 'record-overlay-remove';
