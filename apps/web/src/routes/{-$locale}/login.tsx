import { GithubLogo, GoogleLogo } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { authClient } from '~/auth-client';
import { dictionaries, localeFromParam } from '~/i18n';

export const Route = createFileRoute('/{-$locale}/login')({ component: Login });

function Login() {
  const { locale: param } = Route.useParams();
  const t = dictionaries[localeFromParam(param)];
  const callbackURL = param ? '/en' : '/';

  const buttons = [
    { provider: 'github', label: t.withGithub, Icon: GithubLogo },
    { provider: 'google', label: t.withGoogle, Icon: GoogleLogo },
  ] as const;

  return (
    <div className="frost rise mx-auto mt-16 flex max-w-sm flex-col gap-3 rounded-[20px] p-8">
      <h1 className="text-xl font-medium">{t.loginTitle}</h1>
      <p className="mb-3 text-sm text-ink/60 dark:text-slate-400">{t.loginDesc}</p>
      {buttons.map(({ provider, label, Icon }) => (
        <button
          key={provider}
          type="button"
          onClick={() => authClient.signIn.social({ provider, callbackURL })}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm text-white transition hover:bg-ink/85 active:scale-[0.98] dark:bg-slate-100 dark:text-ink"
        >
          <Icon size={18} weight="fill" />
          {label}
        </button>
      ))}
    </div>
  );
}
