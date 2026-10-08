import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { Crown, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_URL, fetchAccount, type AccountUser } from '@/utils/api';

export function AccountButton({ pro }: { pro: boolean }) {
  const { t } = useTranslation();
  const [user, setUser] = useState<AccountUser | null | undefined>(undefined);

  useEffect(() => {
    const refresh = () => void fetchAccount().then(setUser);
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  if (user === undefined) return null;

  if (!user) {
    return (
      <Button variant="outline" onClick={() => void browser.tabs.create({ url: `${API_URL}/login` })}>
        <LogIn />
        {t('account.signIn')}
      </Button>
    );
  }

  return (
    <a
      href={API_URL}
      target="_blank"
      rel="noreferrer"
      title={user.name}
      className="flex h-9 items-center gap-2 rounded-full bg-card pr-1 pl-1 text-sm ring-1 ring-white/70 backdrop-blur"
    >
      {user.image ? (
        <img src={user.image} alt="" className="size-7 rounded-full" />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {pro && (
        <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-linear-to-r from-[#b8862b] to-[#e8c15a] px-2 py-0.5 text-xs font-semibold text-white shadow-[0_2px_10px_rgb(184_134_43/0.4)] ring-1 ring-white/50">
          <Crown className="size-3" />
          Pro
        </span>
      )}
    </a>
  );
}
