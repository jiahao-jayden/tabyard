import { MagnifyingGlass } from '@phosphor-icons/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PackCard } from '~/components/PackCard';
import { dictionaries, localeFromParam } from '~/i18n';
import { fetchPacks } from '~/server/fns';

export const Route = createFileRoute('/{-$locale}/packs')({
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s.q === 'string' && s.q ? { q: s.q } : {},
  loaderDeps: ({ search }) => ({ q: search.q ?? '' }),
  loader: ({ deps }) => fetchPacks({ data: deps.q }),
  component: Packs,
});

function Packs() {
  const { locale: param } = Route.useParams();
  const { q = '' } = Route.useSearch();
  const packs = Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });
  const t = dictionaries[localeFromParam(param)];

  return (
    <div className="py-10">
      <h1 className="text-4xl font-medium tracking-tight">{t.packsTitle}</h1>
      <p className="mt-3 max-w-[60ch] text-slate-600 dark:text-slate-300">{t.packsDesc}</p>

      <label htmlFor="pack-search" className="sr-only">{t.searchLabel}</label>
      <div className="frost mt-8 flex max-w-md items-center gap-2 rounded-full px-4">
        <MagnifyingGlass className="size-4 shrink-0 text-slate-500" />
        <input
          id="pack-search"
          defaultValue={q}
          placeholder={t.searchPlaceholder}
          onChange={(e) => navigate({ search: e.target.value ? { q: e.target.value } : {}, replace: true })}
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-500"
        />
      </div>

      {packs.length === 0 ? (
        <p className="frost mt-10 rounded-[20px] px-6 py-12 text-center text-slate-600 dark:text-slate-300">
          {t.empty}
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((p) => (
            <PackCard key={p.code} pack={p} locale={param} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
