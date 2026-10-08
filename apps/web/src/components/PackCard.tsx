import { Link } from '@tanstack/react-router';
import { SealCheck } from '@phosphor-icons/react';
import type { Dictionary } from '~/i18n';
import type { PackSummary } from '~/server/packs';

export function PackCard({ pack, locale, t }: { pack: PackSummary; locale?: string; t: Dictionary }) {
  return (
    <Link
      to="/{-$locale}/p/$code"
      params={{ locale, code: pack.code }}
      className="frost group flex h-full flex-col rounded-[20px] p-5 transition duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-medium leading-snug">{pack.name}</h3>
        {pack.official && (
          <SealCheck weight="fill" className="mt-1 size-4 shrink-0 text-lake" aria-label={t.official} />
        )}
      </div>
      {pack.description && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {pack.description}
        </p>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {pack.author || t.anonymous}
          <br />
          {pack.groupCount} {t.groups} · {pack.patternCount} {t.patterns}
        </span>
        <code className="rounded-full bg-lake-soft/80 px-2.5 py-1 font-mono text-[11px] tracking-wider text-lake dark:bg-white/10 dark:text-slate-200">
          {pack.code}
        </code>
      </div>
    </Link>
  );
}
