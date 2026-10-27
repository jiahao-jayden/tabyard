// 录屏执行端：offscreen 文档不随 popup 关闭，负责取流、混音、裁剪区域并写入分片
import { browser } from 'wxt/browser';
import type { Region } from '@/utils/page';
import { putChunk, putMeta } from '@/utils/record/store';
import type { OffscreenCommand, RecordFinished } from '@/utils/record/types';

// Insertable Streams 尚未进入 TypeScript 的 DOM 类型
declare class MediaStreamTrackProcessor<T> {
  constructor(init: { track: MediaStreamTrack });
  readonly readable: ReadableStream<T>;
}
declare class MediaStreamTrackGenerator<T> extends MediaStreamTrack {
  constructor(init: { kind: 'video' | 'audio' });
  readonly writable: WritableStream<T>;
}

const SIZES = { '720p': { width: 1280, height: 720, bitrate: 5_000_000 }, '1080p': { width: 1920, height: 1080, bitrate: 8_000_000 } };
const MIME_TYPES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];

interface Session {
  id: string;
  recorder: MediaRecorder;
  streams: MediaStream[];
  audio: AudioContext | null;
  writes: Promise<void>[];
}

let session: Session | null = null;

/** chromeMediaSource 是 Chrome 专有的约束写法 */
function tabConstraints(streamId: string, extra: Record<string, unknown> = {}): MediaTrackConstraints {
  return { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId, ...extra } } as MediaTrackConstraints;
}

/** 用 VideoFrame 的 visibleRect 裁剪，不依赖隐藏文档里会被节流的定时器 */
function cropTrack(track: MediaStreamTrack, region: Region): MediaStreamTrack {
  const { width = region.width } = track.getSettings();
  const scale = width / region.width;
  // I420 帧的裁剪坐标和尺寸需为偶数
  const even = (n: number) => Math.floor(n / 2) * 2;
  const rect = {
    x: even(region.x * scale),
    y: even(region.y * scale),
    width: Math.max(2, even(region.w * scale)),
    height: Math.max(2, even(region.h * scale)),
  };
  const processor = new MediaStreamTrackProcessor<VideoFrame>({ track });
  const generator = new MediaStreamTrackGenerator<VideoFrame>({ kind: 'video' });
  void processor.readable
    .pipeThrough(new TransformStream<VideoFrame, VideoFrame>({
      transform(frame, controller) {
        const x = Math.min(rect.x, frame.codedWidth - 2);
        const y = Math.min(rect.y, frame.codedHeight - 2);
        const visibleRect = {
          x,
          y,
          width: even(Math.min(rect.width, frame.codedWidth - x)),
          height: even(Math.min(rect.height, frame.codedHeight - y)),
        };
        controller.enqueue(new VideoFrame(frame, { visibleRect }));
        frame.close();
      },
    }))
    .pipeTo(generator.writable)
    .catch(() => {});
  return generator;
}

async function start(cmd: Extract<OffscreenCommand, { type: 'start' }>): Promise<void> {
  const { options, region } = cmd;
  const size = SIZES[options.quality];
  const tab = await navigator.mediaDevices.getUserMedia({
    video: tabConstraints(cmd.streamId, { maxWidth: size.width, maxHeight: size.height, maxFrameRate: 30 }),
    audio: options.tabAudio ? tabConstraints(cmd.streamId) : false,
  });
  const current: Session = { id: cmd.id, recorder: null!, streams: [tab], audio: null, writes: [] };
  try {
    const [video] = tab.getVideoTracks();
    const tracks: MediaStreamTrack[] = [region ? cropTrack(video!, region) : video!];

    const mic = options.mic ? await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, ...(options.micDeviceId ? { deviceId: { exact: options.micDeviceId } } : {}) },
    }) : null;
    if (mic) current.streams.push(mic);
    if (tab.getAudioTracks().length > 0 || mic) {
      const audio = new AudioContext();
      current.audio = audio;
      const mixed = audio.createMediaStreamDestination();
      if (tab.getAudioTracks().length > 0) {
        const source = audio.createMediaStreamSource(new MediaStream(tab.getAudioTracks()));
        source.connect(mixed);
        // 被捕获的标签页会静音，需要回放给用户听
        source.connect(audio.destination);
      }
      if (mic) audio.createMediaStreamSource(mic).connect(mixed);
      tracks.push(...mixed.stream.getAudioTracks());
    }

    const output = new MediaStream(tracks);
    current.streams.push(output);
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
    const recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: size.bitrate });
    current.recorder = recorder;
    await putMeta({ id: cmd.id, mimeType: recorder.mimeType || 'video/webm', title: cmd.title, url: cmd.url });

    let index = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) current.writes.push(putChunk(index++, event.data));
    };
    recorder.onstop = () => void finish(current);
    // 标签页关闭或捕获被浏览器中断时画面轨道结束，按正常停止处理
    video!.addEventListener('ended', () => stop());
    recorder.start(1000);
    session = current;
  } catch (error) {
    await release(current);
    throw error;
  }
}

async function release(current: Session): Promise<void> {
  for (const stream of current.streams) stream.getTracks().forEach((t) => t.stop());
  await current.audio?.close();
}

function stop(): void {
  if (session?.recorder.state !== 'inactive') session?.recorder.stop();
}

async function finish(current: Session): Promise<void> {
  await release(current);
  await Promise.allSettled(current.writes);
  if (session === current) session = null;
  await browser.runtime.sendMessage({ type: 'record-finished', id: current.id } satisfies RecordFinished);
}

browser.runtime.onMessage.addListener((msg: OffscreenCommand, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return;
  if (msg.type === 'start') {
    void start(msg).then(
      () => sendResponse({ ok: true }),
      (error: Error) => sendResponse({ ok: false, error: error.message }),
    );
    return true;
  }
  if (msg.type === 'pause' && session?.recorder.state === 'recording') session.recorder.pause();
  if (msg.type === 'resume' && session?.recorder.state === 'paused') session.recorder.resume();
  if (msg.type === 'stop') stop();
  sendResponse({ ok: true });
});
