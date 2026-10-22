import { Check, Crown } from '@phosphor-icons/react';
import { createFileRoute, Link, useLoaderData } from '@tanstack/react-router';
import { dictionaries, localeFromParam } from '~/i18n';
import { fetchPrice } from '~/server/fns';

export const Route = createFileRoute('/{-$locale}/pricing')({
  loader: () => fetchPrice(),
  component: Pricing,
});

const CHECKOUT = '/api/checkout';
const primaryButton =
  'flex h-11 items-center justify-center rounded-full bg-ink text-sm font-medium text-white shadow-[0_8px_24px_rgb(34_43_53/0.18)] transition hover:bg-ink/85 active:scale-[0.98] dark:bg-slate-100 dark:text-ink';

function Pricing() {
  const { locale: param } = Route.useParams();
  const locale = localeFromParam(param);
  const t = dictionaries[locale];
  const price = Route.useLoaderData();
  const user = useLoaderData({ from: '/{-$locale}' });
  const amount = price
    ? new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
        style: 'currency',
        currency: price.currency,
        minimumFractionDigits: price.amount % 100 === 0 ? 0 : 2,
      }).format(price.amount / 100)
    : undefined;

  return (
    <div className="py-10">
      <h1 className="rise text-4xl font-medium tracking-tight" style={{ '--i': 0 } as React.CSSProperties}>
        {t.pricingTitle}
      </h1>
      <p className="rise mt-3 max-w-[60ch] text-slate-600 dark:text-slate-300" style={{ '--i': 1 } as React.CSSProperties}>
        {t.pricingDesc}
      </p>

      <div className="mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
        <Plan
          i={2}
          name={t.planFree}
          price={t.free}
          features={[t.freeGroups, t.freeRules, t.freePacks, t.freeCollect, t.freeClip]}
        />
        <Plan
          i={3}
          highlight
          name={t.planPro}
          price={amount}
          note={t.oneTime}
          features={[t.proEverything, t.proSync]}
        >
          {user?.pro ? (
            <p className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#b8862b] to-[#e8c15a] text-sm font-medium text-white">
              <Crown size={16} weight="fill" />
              {t.alreadyPro}
            </p>
          ) : user ? (
            <a href={CHECKOUT} className={primaryButton}>
              {t.buyPro}
            </a>
          ) : (
            <Link to="/{-$locale}/login" params={{ locale: param }} search={{ redirect: CHECKOUT }} className={primaryButton}>
              {t.buyPro}
            </Link>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t.paidNote}</p>
        </Plan>
      </div>
    </div>
  );
}

function Plan({
  i,
  name,
  price,
  note,
  features,
  highlight,
  children,
}: {
  i: number;
  name: string;
  price?: string;
  note?: string;
  features: string[];
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`frost rise flex flex-col rounded-[20px] p-6 ${highlight ? 'ring-2 ring-[#e2b33c]/70' : ''}`}
      style={{ '--i': i } as React.CSSProperties}
    >
      <h2 className="flex items-center gap-1.5 font-medium">
        {highlight && <Crown size={16} weight="fill" className="text-[#c99a35]" />}
        {name}
      </h2>
      <p className="mt-4 h-10 text-4xl font-medium tracking-tight">{price}</p>
      <p className="mt-1 h-5 text-sm text-slate-500 dark:text-slate-400">{note}</p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-lake dark:text-slate-300" weight="bold" />
            {f}
          </li>
        ))}
      </ul>
      {children && <div className="mt-8">{children}</div>}
    </section>
  );
}
