import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { browser, type Browser } from 'wxt/browser';
import {
  AppWindow, Camera, CameraOff, Check, ChevronDown, Circle, LoaderCircle, Mic, MicOff, MonitorPlay, PenLine,
  SquareDashed, Square, Volume2, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { isCollectable } from '@/utils/collect/capture';
import {
  DEFAULT_RECORD_OPTIONS,
  elapsedMs,
  formatDuration,
  RECORD_OPTIONS_KEY,
  type RecordMode,
  type RecordOptions,
  type RecordState,
} from '@/utils/record/types';

const TILE = 'rounded-[10px] bg-white/70 ring-1 ring-black/[0.06] transition-colors';

function ModeTile({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${TILE} flex flex-col items-center gap-2 px-2 py-3 text-xs font-medium [&_svg]:size-6 ${
        active ? 'bg-blue-50 text-blue-600 ring-blue-300' : 'text-foreground hover:bg-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** 摄像头 / 麦克风：图标即开关，关闭时显示红色划线图标；箭头选择设备 */
function MediaToggle({
  on, off, label, checked, onChange, devices, deviceId, onDevice,
}: {
  on: LucideIcon;
  off: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  devices: MediaDeviceInfo[];
  deviceId: string;
  onDevice: (id: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = checked ? on : off;
  return (
    <div className={`${TILE} flex h-10 items-center hover:bg-white`}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
        title={label}
        className="flex h-full flex-1 items-center justify-center pl-1.5"
      >
        <Icon className={`size-5 ${checked ? 'text-blue-600' : 'text-red-500'}`} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-full items-center pr-2 pl-0.5 text-muted-foreground/70 outline-none hover:text-foreground"
          aria-label={t('record.chooseDevice', { name: label })}
        >
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-64">
          <DropdownMenuItem onSelect={() => onDevice('')}>
            <Check className={deviceId ? 'invisible' : ''} />
            {t('record.defaultDevice')}
          </DropdownMenuItem>
          {devices.length > 0 && <DropdownMenuSeparator />}
          {devices.map((d, i) => (
            <DropdownMenuItem key={d.deviceId} onSelect={() => onDevice(d.deviceId)}>
              <Check className={deviceId === d.deviceId ? '' : 'invisible'} />
              <span className="truncate">{d.label || `${label} ${i + 1}`}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SwitchCard({ icon, label, checked, onChange, className = '' }: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label className={`${TILE} flex h-10 items-center gap-2 px-3 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground ${className}`}>
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

/** 麦克风 / 摄像头未授权时打开授权页；offscreen 文档自己无法弹出权限请求 */
async function ensureMediaPermission(options: RecordOptions): Promise<boolean> {
  const needed = [options.mic && 'microphone', options.camera && 'camera'].filter(Boolean) as string[];
  const states = await Promise.all(
    needed.map((name) => navigator.permissions.query({ name: name as PermissionName }).then((s) => s.state, () => 'prompt')),
  );
  if (states.every((s) => s === 'granted')) return true;
  const params = new URLSearchParams({ mic: options.mic ? '1' : '0', camera: options.camera ? '1' : '0' });
  await browser.tabs.create({ url: browser.runtime.getURL(`/permission.html?${params}`) });
  return false;
}

export function RecordSection({ activeTab }: { activeTab: Browser.tabs.Tab | undefined }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<RecordOptions | null>(null);
  /** undefined 表示读取中 */
  const [state, setState] = useState<RecordState | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const tabId = activeTab?.id;

  useEffect(() => {
    void browser.storage.local.get(RECORD_OPTIONS_KEY).then((stored) =>
      setOptions({ ...DEFAULT_RECORD_OPTIONS, ...(stored[RECORD_OPTIONS_KEY] as Partial<RecordOptions> | undefined) }));
    void (browser.runtime.sendMessage({ type: 'record-state' }) as Promise<RecordState | null>).then(setState);
    // 授权前拿不到设备 id 和名称，只能选系统默认
    void navigator.mediaDevices.enumerateDevices().then((list) => setDevices(list.filter((d) => d.deviceId)));
  }, []);

  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state]);

  const update = (patch: Partial<RecordOptions>) => {
    const next = { ...options!, ...patch };
    setOptions(next);
    void browser.storage.local.set({ [RECORD_OPTIONS_KEY]: next });
  };

  if (state === undefined || !options) return null;

  if (state) {
    return (
      <div className="space-y-3">
        <div className={`flex items-center justify-center gap-2 ${TILE} py-3 text-sm`}>
          <span className={`size-2 rounded-full ${state.pausedAt ? 'bg-muted-foreground' : 'animate-pulse bg-red-500'}`} />
          {state.pausedAt ? t('record.paused') : t('record.recording')}
          <span className="font-mono tabular-nums">{formatDuration(elapsedMs(state, now))}</span>
        </div>
        <Button
          size="lg"
          variant="destructive"
          className="h-10 w-full rounded-[10px]"
          onClick={() => {
            void browser.runtime.sendMessage({ type: 'record-stop' });
            window.close();
          }}
        >
          <Square className="fill-current" />
          {t('record.stop')}
        </Button>
      </div>
    );
  }

  if (tabId === undefined || !isCollectable(activeTab?.url)) {
    return <p className="text-xs text-muted-foreground">{t('record.unsupported')}</p>;
  }

  const start = async () => {
    if (!(await ensureMediaPermission(options))) return;
    const request = { type: 'record-start', tabId, options, hint: t('record.regionHint') };
    // 框选需要在页面上操作，先关闭 popup
    if (options.mode === 'region') {
      void browser.runtime.sendMessage(request);
      window.close();
      return;
    }
    setBusy(true);
    const res = (await browser.runtime.sendMessage(request).catch((e: Error) => ({ ok: false, error: e.message }))) as
      | { ok: true }
      | { ok: false; error: string };
    setBusy(false);
    if (res.ok) window.close();
    else toast.error(t('record.failed', { msg: res.error }));
  };

  const mode = (value: RecordMode, icon: ReactNode) => (
    <ModeTile icon={icon} label={t(`record.mode_${value}`)} active={options.mode === value} onClick={() => update({ mode: value })} />
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {mode('tab', <AppWindow />)}
        {mode('region', <SquareDashed />)}
      </div>
      <div className="grid grid-cols-[3.5rem_3.5rem_minmax(0,1fr)] gap-2">
        <MediaToggle
          on={Camera}
          off={CameraOff}
          label={t('record.camera')}
          checked={options.camera}
          onChange={(v) => update({ camera: v })}
          devices={devices.filter((d) => d.kind === 'videoinput')}
          deviceId={options.cameraDeviceId}
          onDevice={(id) => update({ cameraDeviceId: id, camera: true })}
        />
        <MediaToggle
          on={Mic}
          off={MicOff}
          label={t('record.mic')}
          checked={options.mic}
          onChange={(v) => update({ mic: v })}
          devices={devices.filter((d) => d.kind === 'audioinput')}
          deviceId={options.micDeviceId}
          onDevice={(id) => update({ micDeviceId: id, mic: true })}
        />
        <SwitchCard icon={<Volume2 />} label={t('record.tabAudio')} checked={options.tabAudio} onChange={(v) => update({ tabAudio: v })} />
      </div>
      <SwitchCard icon={<PenLine />} label={t('record.controls')} checked={options.controls} onChange={(v) => update({ controls: v })} />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-7 items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground [&_svg]:size-3.5"
          aria-label={t('record.quality')}
          title={t('record.quality')}
        >
          <MonitorPlay />
          {options.quality}
          <ChevronDown className="!size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(['720p', '1080p'] as const).map((q) => (
            <DropdownMenuItem key={q} onSelect={() => update({ quality: q })}>
              <Check className={options.quality === q ? '' : 'invisible'} />
              {q}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="lg" className="h-10 w-full rounded-[10px]" onClick={() => void start()} disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Circle className="fill-red-500 text-red-500" />}
        {t('record.start')}
      </Button>
    </div>
  );
}
