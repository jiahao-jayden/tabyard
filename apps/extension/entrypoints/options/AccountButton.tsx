import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_URL, fetchAccount, type AccountUser } from '@/utils/api';

export function AccountButton() {
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
      className="flex h-9 items-center gap-2 rounded-full bg-card pr-3 pl-1 text-sm ring-1 ring-white/70 backdrop-blur"
    >
      {user.image ? (
        <img src={user.image} alt="" className="size-7 rounded-full" />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-24 truncate">{user.name}</span>
    </a>
  );
}
