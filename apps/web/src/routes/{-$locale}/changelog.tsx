import { createFileRoute } from '@tanstack/react-router';
import { CHANGELOG } from '@tabyard/shared';
import { dictionaries, localeFromParam } from '~/i18n';

export const Route = createFileRoute('/{-$locale}/changelog')({
  component: Changelog,
});

function Changelog() {
  const { locale: param } = Route.useParams();
  const locale = localeFromParam(param);
  const t = dictionaries[locale];

  return (
    <div className="py-10">
      <h1 className="rise text-4xl font-medium tracking-tight" style={{ '--i': 0 } as React.CSSProperties}>
        {t.changelogTitle}
      </h1>
      <p className="rise mt-3 max-w-[60ch] text-slate-600 dark:text-slate-300" style={{ '--i': 1 } as React.CSSProperties}>
        {t.changelogDesc}
      </p>

      <div className="mt-10 max-w-2xl space-y-4">
        {CHANGELOG.map((entry, i) => (
          <section
            key={entry.version}
            id={`v${entry.version}`}
            className="frost rise rounded-[20px] p-6"
            style={{ '--i': i + 2 } as React.CSSProperties}
          >
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-medium">v{entry.version}</h2>
              <time className="text-sm text-slate-500 dark:text-slate-400">{entry.date}</time>
            </div>
            <p className="mt-2 font-medium">{entry[locale].title}</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
              {entry[locale].items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
