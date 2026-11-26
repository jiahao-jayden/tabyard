import { GithubLogo, GoogleChromeLogo } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { CHANGELOG } from '@tabyard/shared';
import { dictionaries, INSTALL_URL, localeFromParam, REPO_URL } from '~/i18n';
import { fetchStoreVersion } from '~/server/fns';

const badge = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition hover:brightness-95';

export const Route = createFileRoute('/{-$locale}/changelog')({
  loader: () => fetchStoreVersion(),
  component: Changelog,
});

/** a <= b，按数字段比较 */
function versionAtMost(a: string, b: string): boolean {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0;
  }
  return true;
}

function Changelog() {
  const { locale: param } = Route.useParams();
  const locale = localeFromParam(param);
  const t = dictionaries[locale];
  const storeVersion = Route.useLoaderData();
  const isListed = (version: string) => !!storeVersion && versionAtMost(version, storeVersion);

  return (
    <div className="py-10">
      <h1 className="rise text-4xl font-medium tracking-tight" style={{ '--i': 0 } as React.CSSProperties}>
        {t.changelogTitle}
      </h1>
      <p className="rise mt-3 max-w-[60ch] text-slate-600 dark:text-slate-300" style={{ '--i': 1 } as React.CSSProperties}>
        {t.changelogDesc}
      </p>

      {/* 时间线：左侧日期和版本号，中间竖线和圆点，右侧标题与条目 */}
      <ol className="frost rise mt-10 rounded-[20px] p-6 md:p-10" style={{ '--i': 2 } as React.CSSProperties}>
        {CHANGELOG.map((entry, i) => (
          <li
            key={entry.version}
            id={`v${entry.version}`}
            className="grid scroll-mt-8 gap-x-6 gap-y-3 pb-12 last:pb-0 md:grid-cols-[7rem_0.75rem_minmax(0,1fr)]"
          >
            <div className="flex items-center gap-3 md:block md:pt-1.5">
              <time className="block text-sm text-slate-500 dark:text-slate-400">{entry.date}</time>
              <span className="inline-block rounded-lg border border-ink/10 bg-white/60 px-2.5 py-1 text-sm font-medium md:mt-2 dark:border-white/15 dark:bg-white/10">
                v{entry.version}
              </span>
            </div>

            <div aria-hidden className="relative hidden md:block">
              <span className="absolute top-3.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-ink dark:bg-slate-100" />
              {i < CHANGELOG.length - 1 && (
                <span className="absolute top-3.5 -bottom-12 left-1/2 w-px -translate-x-1/2 bg-ink/10 dark:bg-white/15" />
              )}
            </div>

            <div>
              <h2 className="text-2xl font-medium tracking-tight md:text-3xl">{entry[locale].title}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`${REPO_URL}/releases/tag/v${entry.version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${badge} border-slate-300/80 bg-white/60 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200`}
                >
                  <GithubLogo size={16} weight="fill" />
                  {t.releasedOnGithub}
                </a>
                {storeVersion && (
                  <a
                    href={INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${badge} ${
                      isListed(entry.version)
                        ? 'border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300'
                        : 'border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300'
                    }`}
                  >
                    <GoogleChromeLogo size={16} weight="bold" />
                    {isListed(entry.version) ? t.chromeLive : t.chromeReview}
                  </a>
                )}
              </div>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
                {entry[locale].items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
