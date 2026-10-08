import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [{ title: '隐私政策 · Privacy Policy — Tabyard' }],
  }),
  component: Privacy,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm text-slate-500">最后更新：2026 年 10 月 8 日 · 适用产品：Tabyard Chrome 扩展</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">隐私政策</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Tabyard（以下简称"我们"）是一款 Chrome 扩展，可根据你自定义的规则将标签页自动归入 Chrome
        原生标签分组。本政策说明扩展会处理哪些数据。
      </p>

      <Section title="一、仅在本地处理的数据（不会离开你的设备）">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink dark:text-slate-100">标签页网址与标题</strong>：通过 <code>tabs</code>{' '}
            权限读取，仅用于在本地匹配你的分组规则（域名、路径、关键词、正则）。匹配过程完全在扩展内部完成，
            <strong className="text-ink dark:text-slate-100">我们不会将你的浏览记录传输到任何服务器</strong>。
          </li>
          <li>
            <strong className="text-ink dark:text-slate-100">你的规则与设置</strong>：保存在浏览器本地的扩展存储（<code>chrome.storage</code>）中。
          </li>
        </ul>
      </Section>

      <Section title="二、同步到服务器的数据（仅 Pro / 登录用户）">
        <p>如果你使用 GitHub / Google 登录并使用 Pro 功能，以下数据会同步到我们的后端 https://tabyard.jayden0.com（Cloudflare 基础设施）：</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>账号标识与邮箱（来自 OAuth，仅用于登录）；</li>
          <li>你的分组规则与扩展设置（用于多设备云同步，可随时在设置中关闭）；</li>
          <li>你主动发布或分享的规则包（通过短码分享）。</li>
        </ul>
        <p>我们<strong className="text-ink dark:text-slate-100">不会</strong>上传你的标签页网址、标题或浏览记录。</p>
      </Section>

      <Section title="三、我们绝不做的事">
        <ul className="list-disc space-y-2 pl-5">
          <li>不出售、出租或与第三方共享你的个人数据；</li>
          <li>不展示广告，不在扩展中使用第三方分析或追踪脚本；</li>
          <li>不将你的数据用于广告或用户画像。</li>
        </ul>
      </Section>

      <Section title="四、数据保留与删除">
        <p>
          同步的规则与设置仅在账号有效期内保留。你可以随时在扩展设置中退出登录并删除云端数据，或联系我们要求彻底删除账号数据。
        </p>
      </Section>

      <Section title="五、安全">
        <p>数据传输全程使用 HTTPS/TLS 加密，后端存储访问权限受到严格限制。</p>
      </Section>

      <Section title="六、政策变更">
        <p>如本政策发生变更，我们会更新上方的"最后更新"日期，并酌情通过扩展或网站通知用户。</p>
      </Section>

      <Section title="七、联系我们">
        <p>
          网站：<a className="underline" href="https://tabyard.jayden0.com">https://tabyard.jayden0.com</a>
        </p>
      </Section>

      <hr className="my-12 border-slate-200 dark:border-slate-700" />

      <p className="text-sm text-slate-500">Last updated: October 8, 2026 · Applies to: Tabyard Chrome extension</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Tabyard ("we", "our") is a Chrome extension that automatically sorts your browser tabs into native Chrome tab
        groups based on rules you define. This policy explains what data the extension handles.
      </p>

      <Section title="1. Data processed locally (never leaves your device)">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink dark:text-slate-100">Tab URLs and page titles</strong>: read via the{' '}
            <code>tabs</code> permission solely to match your grouping rules (domain, path, keyword, regex). Matching
            happens entirely inside the extension on your device.{' '}
            <strong className="text-ink dark:text-slate-100">
              We do not transmit your browsing history to any server.
            </strong>
          </li>
          <li>
            <strong className="text-ink dark:text-slate-100">Your rules and settings</strong>: stored in the browser's
            local extension storage (<code>chrome.storage</code>).
          </li>
        </ul>
      </Section>

      <Section title="2. Data synced to our servers (Pro / signed-in users only)">
        <p>
          If you sign in (GitHub / Google OAuth) and use Pro features, the following syncs with our backend at
          https://tabyard.jayden0.com (Cloudflare infrastructure):
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account identifier and email address (from OAuth, sign-in only);</li>
          <li>Your grouping rules and extension settings (for multi-device cloud sync; can be disabled anytime);</li>
          <li>Rule packs you choose to publish or share (via short codes).</li>
        </ul>
        <p>
          We do <strong className="text-ink dark:text-slate-100">not</strong> upload your tab URLs, page titles, or
          browsing history.
        </p>
      </Section>

      <Section title="3. What we never do">
        <ul className="list-disc space-y-2 pl-5">
          <li>We do not sell, rent, or share your personal data with third parties;</li>
          <li>No ads, no third-party analytics or tracking scripts in the extension;</li>
          <li>We do not use your data for advertising or profiling.</li>
        </ul>
      </Section>

      <Section title="4. Retention and deletion">
        <p>
          Synced rules and settings are kept only while your account is active. You may sign out and delete cloud data
          anytime in the extension options, or contact us to request full deletion.
        </p>
      </Section>

      <Section title="5. Security">
        <p>All data in transit is encrypted with HTTPS/TLS. Backend storage access is strictly restricted.</p>
      </Section>

      <Section title="6. Changes">
        <p>If this policy changes, we will update the "Last updated" date above and notify users where appropriate.</p>
      </Section>

      <Section title="7. Contact">
        <p>
          Website: <a className="underline" href="https://tabyard.jayden0.com">https://tabyard.jayden0.com</a>
        </p>
      </Section>
    </div>
  );
}
