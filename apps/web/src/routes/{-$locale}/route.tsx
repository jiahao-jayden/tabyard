import { createFileRoute, Link, notFound, Outlet, useLocation } from '@tanstack/react-router';
import { useState } from 'react';
import { Crown } from '@phosphor-icons/react';
import { authClient } from '~/auth-client';
import { dictionaries, INSTALL_URL, localeFromParam } from '~/i18n';
import { fetchSession } from '~/server/fns';

export const Route = createFileRoute('/{-$locale}')({
  beforeLoad: ({ params }) => {
    if (params.locale !== undefined && params.locale !== 'en') throw notFound();
  },
  loader: () => fetchSession(),
  component: Layout,
});

function Layout() {
  const { locale: param } = Route.useParams();
  const locale = localeFromParam(param);
  const t = dictionaries[locale];
  const user = Route.useLoaderData();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const switchHref =
    locale === 'en' ? pathname.replace(/^\/en/, '') || '/' : `/en${pathname === '/' ? '' : pathname}`;

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <img src="/bg.webp" alt="" className="size-full object-cover object-[50%_45%]" />
        <div className="absolute inset-0 bg-[radial-gradient(55%_70%_at_28%_48%,rgb(244_240_230/0.82)_35%,transparent)] dark:bg-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f4f0e6]/40 via-transparent to-[#f4f0e6]/60 dark:from-[#121820]/80 dark:via-[#121820]/75 dark:to-[#121820]/90" />
      </div>

      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <Link
          to="/{-$locale}"
          params={{ locale: param }}
          className="flex items-center gap-2.5 text-[15px] font-medium tracking-wide text-ink/80 dark:text-slate-200"
        >
          <img src="/logo.svg" alt="" className="size-7" />
          {t.siteName}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/{-$locale}/packs"
            params={{ locale: param }}
            className="frost rounded-full px-4 py-1.5 transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            {t.navPacks}
          </Link>
          <a
            href={switchHref}
            aria-label={t.languageLabel}
            className="frost flex size-8 items-center justify-center rounded-full text-xs transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            {t.language}
          </a>
          {user ? (
            <div
              className="relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false);
              }}
            >
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={user.name}
                aria-expanded={menuOpen}
                className="frost flex h-8 items-center gap-2 rounded-full pr-1 pl-1 transition hover:bg-white/80 dark:hover:bg-white/10"
              >
                {user.image ? (
                  <img src={user.image} alt="" className="size-6 rounded-full" />
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs text-white">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                {user.pro && (
                  <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#b8862b] to-[#e8c15a] px-2 py-0.5 text-[11px] font-semibold text-white">
                    <Crown size={12} weight="fill" />
                    Pro
                  </span>
                )}
              </button>
              {menuOpen && (
                <div className="frost absolute right-0 z-10 mt-2 w-44 rounded-2xl p-1.5 text-sm">
                  <div className="truncate px-3 py-2 text-ink/60 dark:text-slate-400">{user.name}</div>
                  <button
                    type="button"
                    onClick={() => authClient.signOut().then(() => location.reload())}
                    className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/70 dark:hover:bg-white/10"
                  >
                    {t.signOut}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/{-$locale}/login"
              params={{ locale: param }}
              className="frost rounded-full px-4 py-1.5 transition hover:bg-white/80 dark:hover:bg-white/10"
            >
              {t.signIn}
            </Link>
          )}
          <a
            href={INSTALL_URL}
            className="rounded-full bg-ink px-4 py-1.5 text-white transition hover:bg-ink/85 active:scale-[0.98] dark:bg-slate-100 dark:text-ink"
          >
            {t.install}
          </a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 md:px-8">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 py-8 text-xs text-ink/50 md:px-8 dark:text-slate-500">
        {t.footer}
      </footer>
    </div>
  );
}
