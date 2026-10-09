import { Crown } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '~/auth-client';
import { dictionaries, localeFromParam } from '~/i18n';
import { fetchSession, redeemGiftCode } from '~/server/fns';

export const Route = createFileRoute('/{-$locale}/gift/$code')({
  loader: () => fetchSession(),
  component: Gift,
});

const primaryButton =
  'flex h-11 items-center justify-center rounded-full bg-ink px-6 text-sm font-medium text-white transition hover:bg-ink/85 active:scale-[0.98] dark:bg-slate-100 dark:text-ink';

function Gift() {
  const { locale: param, code } = Route.useParams();
  const locale = localeFromParam(param);
  const t = dictionaries[locale];
  const user = Route.useLoaderData();
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'invalid'>('idle');

  async function activate() {
    setState('busy');
    try {
      setState((await redeemGiftCode({ data: code })) ? 'ok' : 'invalid');
    } catch {
      setState('invalid');
    }
  }

  return (
    <div className="frost rise mx-auto mt-16 flex max-w-sm flex-col items-center gap-4 rounded-[20px] p-8 text-center">
      <Crown size={28} weight="fill" className="text-[#c99a35]" />
      <h1 className="text-xl font-medium">{t.giftTitle}</h1>
      <p className="text-sm text-ink/60 dark:text-slate-400">{t.giftDesc}</p>

      {state === 'ok' ? (
        <>
          <p className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#b8862b] to-[#e8c15a] px-6 text-sm font-medium text-white">
            <Crown size={16} weight="fill" />
            {t.alreadyPro}
          </p>
          <p className="text-xs leading-relaxed text-ink/50 dark:text-slate-400">{t.giftOk}</p>
        </>
      ) : user?.pro ? (
        <p className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#b8862b] to-[#e8c15a] px-6 text-sm font-medium text-white">
          <Crown size={16} weight="fill" />
          {t.alreadyPro}
        </p>
      ) : user ? (
        <button type="button" onClick={activate} disabled={state === 'busy'} className={`${primaryButton} w-full disabled:opacity-50`}>
          {t.giftActivate}
        </button>
      ) : (
        <>
          <p className="text-sm text-ink/60 dark:text-slate-400">{t.giftLoginFirst}</p>
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => authClient.signIn.social({ provider: 'github', callbackURL: location.pathname })}
              className={primaryButton}
            >
              GitHub
            </button>
            <button
              type="button"
              onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: location.pathname })}
              className={primaryButton}
            >
              Google
            </button>
          </div>
        </>
      )}
      {state === 'invalid' && <p className="text-sm text-red-600">{t.giftInvalid}</p>}
      <Link to="/{-$locale}/pricing" params={{ locale: param }} className="text-xs text-lake underline">
        {t.navPricing}
      </Link>
    </div>
  );
}