import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { ChevronRight, X } from 'lucide-react';
import { changelogUrl } from '@/utils/api';
import { currentChangelogEntry, loadSeenVersion, markVersionSeen, SEEN_VERSION_KEY } from '@/utils/changelog';
import { useStored } from './useStored';

/** 升级后第一次打开新标签页时，在搜索框下方提示新版本；点击跳到官网更新日志 */
export function UpdateNotice() {
  const { t, i18n } = useTranslation();
  const seen = useStored(SEEN_VERSION_KEY, loadSeenVersion);
  const entry = currentChangelogEntry();
  const visible = !!entry && seen !== null && entry.version !== seen;
  const ref = useRef<HTMLDivElement>(null);

  // 提示出现时从胶囊两侧放一次彩带
  useEffect(() => {
    const el = ref.current;
    if (!visible || !el) return;
    const rect = el.getBoundingClientRect();
    const y = (rect.top + rect.height / 2) / innerHeight;
    void import('canvas-confetti').then(({ default: confetti }) => {
      const shoot = (x: number, angle: number) =>
        confetti({
          particleCount: 60,
          angle,
          spread: 65,
          startVelocity: 45,
          origin: { x, y },
          disableForReducedMotion: true,
        });
      shoot(rect.left / innerWidth, 60);
      shoot(rect.right / innerWidth, 120);
    });
  }, [visible]);

  if (!entry || !visible) return null;

  const text = i18n.language.startsWith('zh') ? entry.zh : entry.en;
  const open = () => {
    void browser.tabs.create({ url: changelogUrl(i18n.language) });
    void markVersionSeen();
  };

  return (
    // 负边距把它收近搜索框，视觉上是搜索框的附注，而不是另一个输入框
    <div ref={ref} className="-mt-4 flex max-w-full items-center rounded-full border border-border bg-card/80 text-sm shadow-xs backdrop-blur">
      <button
        type="button"
        onClick={open}
        className="group flex min-w-0 items-center gap-2 rounded-l-full py-1.5 pr-1 pl-1.5 transition-colors hover:text-foreground"
      >
        <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[11px] leading-4 font-medium text-background">
          v{entry.version}
        </span>
        <span className="truncate text-foreground/80 group-hover:text-foreground">{text.title}</span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
      <button
        type="button"
        aria-label={t('newtab.dismissUpdate')}
        onClick={() => void markVersionSeen()}
        className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
