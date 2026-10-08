import { ArrowRight, Copy } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PackCard } from '~/components/PackCard';
import { dictionaries, GROUP_HEX, INSTALL_URL, localeFromParam, type Dictionary } from '~/i18n';
import { fetchPacks } from '~/server/fns';

export const Route = createFileRoute('/{-$locale}/')({
  loader: async () => (await fetchPacks({ data: '' })).slice(0, 4),
  component: Landing,
});

function Landing() {
  const { locale: param } = Route.useParams();
  const t = dictionaries[localeFromParam(param)];
  const featured = Route.useLoaderData();

  return (
    <>
      <section className="grid min-h-[calc(100dvh-8rem)] items-center gap-12 py-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div className="max-w-md">
          <h1 className="rise text-4xl font-medium leading-[1.15] tracking-tight md:text-5xl" style={{ '--i': 0 } as React.CSSProperties}>
            {t.heroTitle}
          </h1>
          <p className="rise mt-5 text-base leading-relaxed text-slate-600 dark:text-slate-300" style={{ '--i': 1 } as React.CSSProperties}>
            {t.heroDesc}
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ '--i': 2 } as React.CSSProperties}>
            <a
              href={INSTALL_URL}
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgb(34_43_53/0.18)] transition hover:bg-ink/85 active:scale-[0.98] dark:bg-slate-100 dark:text-ink"
            >
              {t.install}
            </a>
            <Link
              to="/{-$locale}/packs"
              params={{ locale: param }}
              className="frost inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-sm transition hover:bg-white/80 active:scale-[0.98] dark:hover:bg-white/10"
            >
              {t.browsePacks}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NativeCard t={t} />
          <SpecificCard t={t} />
          <ShareCard t={t} />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="pb-16">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-medium tracking-tight">{t.featuredTitle}</h2>
            <Link
              to="/{-$locale}/packs"
              params={{ locale: param }}
              className="inline-flex items-center gap-1 text-sm text-lake hover:underline dark:text-slate-300"
            >
              {t.viewAll}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <PackCard key={p.code} pack={p} locale={param} t={t} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function CardText({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
    </div>
  );
}

const TAB_GROUPS = [
  { name: '开发', color: 'purple', tabs: ['github.com', 'vercel.com'] },
  { name: '设计', color: 'pink', tabs: ['figma.com'] },
  { name: 'AI', color: 'cyan', tabs: ['claude.ai', 'chatgpt.com'] },
];

function NativeCard({ t }: { t: Dictionary }) {
  return (
    <div className="frost rise flex flex-col gap-6 rounded-[20px] p-6 sm:col-span-2" style={{ '--i': 3 } as React.CSSProperties}>
      <CardText title={t.bentoNativeTitle} desc={t.bentoNativeDesc} />
      <div className="overflow-hidden rounded-2xl bg-white/70 p-2 dark:bg-black/20">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {TAB_GROUPS.map((g) => (
            <div key={g.name} className="flex shrink-0 items-center gap-1.5">
              <span
                className="rounded-md px-2 py-1 text-xs font-medium text-white"
                style={{ background: GROUP_HEX[g.color] }}
              >
                {g.name}
              </span>
              {g.tabs.map((tab) => (
                <span
                  key={tab}
                  className="rounded-lg border-b-2 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-300"
                  style={{ borderColor: GROUP_HEX[g.color] }}
                >
                  {tab}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpecificCard({ t }: { t: Dictionary }) {
  const rows = [
    { pattern: 'chrome.com/docs', group: '文档', color: 'blue', hit: true },
    { pattern: 'chrome.com', group: '谷歌', color: 'green', hit: false },
  ];
  return (
    <div className="frost rise flex flex-col gap-5 rounded-[20px] p-6" style={{ '--i': 4 } as React.CSSProperties}>
      <CardText title={t.bentoSpecificTitle} desc={t.bentoSpecificDesc} />
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.pattern}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
              r.hit ? 'bg-white shadow-sm dark:bg-white/10' : 'text-slate-400'
            }`}
          >
            <span className="font-mono">{r.pattern}</span>
            <span className="flex items-center gap-1.5">
              {r.hit && <span className="text-lake dark:text-slate-300">{t.matched}</span>}
              <span className="size-2 rounded-full" style={{ background: GROUP_HEX[r.color] }} />
              {r.group}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShareCard({ t }: { t: Dictionary }) {
  return (
    <div className="frost rise flex flex-col gap-5 rounded-[20px] p-6" style={{ '--i': 5 } as React.CSSProperties}>
      <CardText title={t.bentoShareTitle} desc={t.bentoShareDesc} />
      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-white/10">
        <span className="font-mono text-lg tracking-[0.2em]">K7M2X9AB</span>
        <Copy className="size-4 text-lake dark:text-slate-300" />
      </div>
    </div>
  );
}
