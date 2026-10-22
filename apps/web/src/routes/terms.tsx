import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [{ title: '服务条款 · Terms of Service — Tabyard' }],
  }),
  component: Terms,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm text-slate-500">最后更新：2026 年 10 月 9 日</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">服务条款</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        欢迎使用 Tabyard（以下简称"本服务"）。Tabyard 是一款 Chrome 扩展，可根据你自定义的规则将标签页自动归入
        Chrome 原生标签分组。使用本服务即表示你同意以下条款。
      </p>

      <Section title="一、服务内容">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink dark:text-slate-100">免费版</strong>：
            除云同步外的所有功能永久免费，包括不限数量的分组、按域名自动分组、网页收藏集、AI 整理和网页剪藏。
          </li>
          <li>
            <strong className="text-ink dark:text-slate-100">Pro 付费版</strong>：
            仅包含多设备云同步。Pro 为订阅制，具体价格以网站公示为准。
          </li>
        </ul>
      </Section>

      <Section title="二、订阅与付款">
        <ul className="list-disc space-y-2 pl-5">
          <li>Pro 订阅通过第三方支付服务商 Creem（Merchant of Record）处理付款，支持的付款方式以结账页面为准。</li>
          <li>订阅按周期自动续费，你可以随时取消。取消后，当前已付费周期结束前 Pro 功能继续有效，到期后恢复为免费版。</li>
          <li>你可以在扩展设置中管理订阅，或通过 Creem 客户门户取消订阅。</li>
        </ul>
      </Section>

      <Section title="三、退款政策">
        <p>
          如果你对 Pro 订阅不满意，请在购买后 7 天内联系我们申请退款，我们将按实际情况处理。
          适用法律另有规定的，从其规定。
        </p>
      </Section>

      <Section title="四、账号与云同步">
        <ul className="list-disc space-y-2 pl-5">
          <li>使用 Pro 云同步功能需要通过 GitHub 或 Google 账号登录。</li>
          <li>你的分组规则与扩展设置会同步到我们的服务器（https://tabyard.jayden0.com），以便在多设备间使用。你的标签页网址与标题不会被上传，详见《隐私政策》。</li>
          <li>请妥善保管你的登录账号，因账号共享或泄露导致的损失由你自行承担。</li>
        </ul>
      </Section>

      <Section title="五、合理使用">
        <p>你同意不将本服务用于任何违法用途，不干扰服务的正常运行，不尝试破坏、逆向或滥用服务的后端接口。我们保留对滥用行为限制或终止服务的权利。</p>
      </Section>

      <Section title="六、免责声明">
        <ul className="list-disc space-y-2 pl-5">
          <li>本服务按"现状"提供，我们不保证服务完全无中断、无错误。</li>
          <li>分组规则由你自行配置，因规则配置导致的标签分组结果不符合预期，不构成服务缺陷。</li>
          <li>在法律允许的最大范围内，我们对因使用本服务产生的间接损失不承担责任。</li>
        </ul>
      </Section>

      <Section title="七、条款变更">
        <p>我们可能会更新本条款，更新后会在本页面更新"最后更新"日期。继续使用本服务即视为接受更新后的条款。</p>
      </Section>

      <Section title="八、联系我们">
        <p>
          对本条款或你的订阅有任何疑问，请联系：<a className="underline" href="mailto:jayden.devwork@gmail.com">jayden.devwork@gmail.com</a>
          <br />
          网站：<a className="underline" href="https://tabyard.jayden0.com">https://tabyard.jayden0.com</a>
        </p>
      </Section>

      <hr className="my-12 border-slate-200 dark:border-slate-700" />

      <p className="text-sm text-slate-500">Last updated: October 9, 2026</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Welcome to Tabyard ("the Service"). Tabyard is a Chrome extension that automatically sorts your browser tabs
        into native Chrome tab groups based on rules you define. By using the Service, you agree to these terms.
      </p>

      <Section title="1. The Service">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink dark:text-slate-100">Free plan</strong>: every feature except cloud sync is free
            forever, including unlimited groups, per-domain auto grouping, web collection, AI organize, and the page clipper.
          </li>
          <li>
            <strong className="text-ink dark:text-slate-100">Pro plan</strong>: a paid subscription that includes
            multi-device cloud sync only. Pricing is as displayed on the
            website.
          </li>
        </ul>
      </Section>

      <Section title="2. Subscription and payments">
        <ul className="list-disc space-y-2 pl-5">
          <li>Pro subscriptions are processed by Creem (Merchant of Record). Available payment methods are shown at checkout.</li>
          <li>Subscriptions renew automatically each billing period. You may cancel anytime; Pro features remain active until the end of the current paid period, after which your account reverts to the Free plan.</li>
          <li>You can manage or cancel your subscription from the extension settings or via the Creem customer portal.</li>
        </ul>
      </Section>

      <Section title="3. Refunds">
        <p>
          If you are not satisfied with your Pro subscription, contact us within 7 days of purchase to request a
          refund; requests are handled on a case-by-case basis. Where applicable law provides otherwise, it prevails.
        </p>
      </Section>

      <Section title="4. Accounts and cloud sync">
        <ul className="list-disc space-y-2 pl-5">
          <li>Pro cloud sync requires signing in with a GitHub or Google account.</li>
          <li>Your grouping rules and extension settings sync to our servers (https://tabyard.jayden0.com) for use across devices. Your tab URLs and page titles are never uploaded — see the Privacy Policy.</li>
          <li>You are responsible for keeping your sign-in account secure.</li>
        </ul>
      </Section>

      <Section title="5. Acceptable use">
        <p>
          You agree not to use the Service for any unlawful purpose, not to disrupt its normal operation, and not to
          abuse or attempt to compromise its backend APIs. We reserve the right to restrict or terminate service in
          case of abuse.
        </p>
      </Section>

      <Section title="6. Disclaimer">
        <ul className="list-disc space-y-2 pl-5">
          <li>The Service is provided "as is"; we do not guarantee it will be uninterrupted or error-free.</li>
          <li>Grouping results follow the rules you configure; unexpected grouping due to your rule configuration is not a service defect.</li>
          <li>To the maximum extent permitted by law, we are not liable for indirect damages arising from use of the Service.</li>
        </ul>
      </Section>

      <Section title="7. Changes">
        <p>If this policy changes, we will update the "Last updated" date above and notify users where appropriate.</p>
      </Section>

      <Section title="8. Contact">
        <p>
          Questions about these terms or your subscription:{' '}
          <a className="underline" href="mailto:jayden.devwork@gmail.com">jayden.devwork@gmail.com</a>
          <br />
          Website: <a className="underline" href="https://tabyard.jayden0.com">https://tabyard.jayden0.com</a>
        </p>
      </Section>
    </div>
  );
}
