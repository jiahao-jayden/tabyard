import { Check, Copy } from '@phosphor-icons/react';
import { createFileRoute, Link, useLoaderData, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { dictionaries, localeFromParam, MCP_URL } from '~/i18n';
import { fetchMcpStatus, generateMcpKey, removeMcpKey } from '~/server/fns';

export const Route = createFileRoute('/{-$locale}/mcp')({
  loader: () => fetchMcpStatus(),
  component: Mcp,
});

const primaryButton =
  'inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-white transition hover:bg-ink/85 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-100 dark:text-ink dark:hover:bg-slate-100/85';
const secondaryButton =
  'inline-flex h-10 items-center justify-center rounded-full bg-white/70 px-5 text-sm transition hover:bg-white active:scale-[0.98] disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20';

function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`${secondaryButton} shrink-0 gap-1.5`}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? done : label}
    </button>
  );
}

function Field({ title, value, copy }: { title: string; value: string; copy: { label: string; done: string } }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{title}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-white/70 px-3 py-2.5 font-mono text-xs dark:bg-white/10">{value}</code>
        <CopyButton text={value} label={copy.label} done={copy.done} />
      </div>
    </div>
  );
}

function Mcp() {
  const { locale: param } = Route.useParams();
  const t = dictionaries[localeFromParam(param)];
  const user = useLoaderData({ from: '/{-$locale}' });
  const status = Route.useLoaderData();
  const router = useRouter();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const copyText = { label: t.mcpCopy, done: t.mcpCopied };

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      await router.invalidate();
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  const generate = () =>
    run(async () => {
      setFreshKey((await generateMcpKey()).key);
    });
  const revoke = () =>
    run(async () => {
      await removeMcpKey();
      setFreshKey(null);
    });

  const config = JSON.stringify(
    { mcpServers: { tabyard: { url: MCP_URL, headers: { Authorization: `Bearer ${freshKey ?? '<your-api-key>'}` } } } },
    null,
    2,
  );

  return (
    <div className="py-10">
      <h1 className="rise text-4xl font-medium tracking-tight" style={{ '--i': 0 } as React.CSSProperties}>
        {t.mcpTitle}
      </h1>
      <p className="rise mt-3 max-w-[60ch] text-slate-600 dark:text-slate-300" style={{ '--i': 1 } as React.CSSProperties}>
        {t.mcpDesc}
      </p>

      {!user || !status ? (
        <div className="frost rise mt-8 flex max-w-xl flex-col items-start gap-4 rounded-[20px] p-6" style={{ '--i': 2 } as React.CSSProperties}>
          <p className="text-sm text-slate-700 dark:text-slate-300">{user ? t.mcpProOnly : t.mcpSignInHint}</p>
          {user ? (
            <Link to="/{-$locale}/pricing" params={{ locale: param }} className={primaryButton}>
              {t.buyPro}
            </Link>
          ) : (
            <Link
              to="/{-$locale}/login"
              params={{ locale: param }}
              search={{ redirect: param === 'zh' ? '/zh/mcp' : '/mcp' }}
              className={primaryButton}
            >
              {t.signIn}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 grid max-w-3xl gap-4">
          <section className="frost rise space-y-5 rounded-[20px] p-6" style={{ '--i': 2 } as React.CSSProperties}>
            <Field title={t.mcpEndpoint} value={MCP_URL} copy={copyText} />

            <div>
              <p className="text-xs text-slate-500">{t.mcpKeyTitle}</p>
              {freshKey ? (
                <div className="mt-1.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-xl bg-white/70 px-3 py-2.5 font-mono text-xs dark:bg-white/10">{freshKey}</code>
                    <CopyButton text={freshKey} label={t.mcpCopy} done={t.mcpCopied} />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{t.mcpKeyOnce}</p>
                </div>
              ) : (
                <p className="mt-1.5 font-mono text-sm">{status.prefix ? `${status.prefix}…` : t.mcpNoKey}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={status.prefix ? secondaryButton : primaryButton}
                  onClick={() => {
                    if (!status.prefix || window.confirm(t.mcpRegenerateConfirm)) void generate();
                  }}
                >
                  {status.prefix ? t.mcpRegenerate : t.mcpGenerate}
                </button>
                {status.prefix && (
                  <button
                    type="button"
                    disabled={busy}
                    className={secondaryButton}
                    onClick={() => {
                      if (window.confirm(t.mcpRevokeConfirm)) void revoke();
                    }}
                  >
                    {t.mcpRevoke}
                  </button>
                )}
              </div>
              {failed && <p className="mt-2 text-sm text-red-600">{t.mcpFailed}</p>}
            </div>

            <div>
              <p className="text-xs text-slate-500">{t.mcpUsageTitle}</p>
              <p className="mt-1.5 text-sm tabular-nums">
                {status.used} / {status.limit}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t.mcpUsageNote}</p>
            </div>
          </section>

          <section className="frost rise space-y-3 rounded-[20px] p-6" style={{ '--i': 3 } as React.CSSProperties}>
            <p className="text-xs text-slate-500">{t.mcpConfigTitle}</p>
            <pre className="overflow-x-auto rounded-xl bg-white/70 p-3 font-mono text-xs leading-relaxed dark:bg-white/10">{config}</pre>
            <CopyButton text={config} label={t.mcpCopy} done={t.mcpCopied} />
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t.mcpConfigHint}</p>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t.mcpNotes}</p>
          </section>
        </div>
      )}
    </div>
  );
}
