import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function Clock({ hour24 }: { hour24: boolean }) {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">
      <div className="text-6xl font-light tracking-tight tabular-nums">
        {now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: !hour24 })}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {now.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}
