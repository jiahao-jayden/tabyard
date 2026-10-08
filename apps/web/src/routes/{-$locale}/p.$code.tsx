import { ArrowLeft, Check, Copy, SealCheck } from '@phosphor-icons/react';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useState } from 'react';
import { dictionaries, GROUP_HEX, localeFromParam } from '~/i18n';
import { fetchPack } from '~/server/fns';

export const Route = createFileRoute('/{-$locale}/p/$code')({
  loader: async ({ params }) => {
    const pack = await fetchPack({ data: params.code });
    if (!pack) throw notFound();
    return pack;
  },
  notFoundComponent: NotFound,
  component: Detail,
});

function BackLink() {
  const { locale: param } = Route.useParams();
  const t = dictionaries[localeFromParam(param)];
  return (
    <Link
      to="/{-$locale}/packs"
      params={{ locale: param }}
      className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-ink dark:text-slate-400 dark:hover:text-slate-100"
    >
      <ArrowLeft className="size-4" />
      {t.back}
    </Link>
  );
}

function NotFound() {
  const { locale: param } = Route.useParams();
  const t = dictionaries[localeFromParam(param)];
  return (
    <div className="py-10">
      <BackLink />
      <p className="frost mt-8 rounded-[20px] px-6 py-16 text-center text-slate-600 dark:text-slate-300">
        {t.notFound}
      </p>
    </div>
  );
}

function Detail() {
  const { locale: param } = Route.useParams();
  const t = dictionaries[localeFromParam(param)];
  const detail = Route.useLoaderData();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(detail.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="py-10">
      <BackLink />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-4xl font-medium tracking-tight">
            {detail.name}
            {detail.official && <SealCheck weight="fill" className="size-6 text-lake" aria-label={t.official} />}
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {detail.author || t.anonymous} · {t.version} {detail.version}
          </p>
          {detail.description && (
            <p className="mt-4 max-w-[60ch] leading-relaxed text-slate-700 dark:text-slate-300">{detail.description}</p>
          )}

          <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] items-start gap-4">
            {detail.pack.groups.map((g, i) => (
              <section key={i} className="frost rounded-[20px] p-5">
                <h2 className="flex items-center gap-2 font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: GROUP_HEX[g.color] }} />
                  {g.name}
                  <span className="ml-auto text-xs font-normal text-slate-500">
                    {g.patterns.length} {t.patterns}
                  </span>
                </h2>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {g.patterns.map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-white/80 px-2.5 py-1 font-mono text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="frost rounded-[20px] p-5 lg:sticky lg:top-6">
          <p className="text-xs text-slate-500">{t.code}</p>
          <p className="mt-1 font-mono text-3xl tracking-[0.2em]">{detail.code}</p>
          <button
            onClick={() => void copy()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm text-white transition hover:bg-ink/85 active:scale-[0.98] dark:bg-slate-100 dark:text-ink"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t.copied : t.copy}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t.howToImport}</p>
        </aside>
      </div>
    </div>
  );
}
