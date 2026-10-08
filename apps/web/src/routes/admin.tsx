import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import type { Discount, OrderRow } from '~/server/billing';
import { addDiscount, fetchAdmin, removeDiscount } from '~/server/fns';

export const Route = createFileRoute('/admin')({
  loader: () => fetchAdmin(),
  component: Admin,
});

const fmt = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' });

function Admin() {
  const data = Route.useLoaderData();
  if (!data) {
    return (
      <p className="p-10 text-center text-ink/60">
        无权访问，请先用管理员账号在 <a className="underline" href="/login">登录页</a> 登录。
      </p>
    );
  }
  const { orders, discounts } = data;
  const unpaid = orders.filter((o) => !o.paid);
  const paid = orders.filter((o) => o.paid);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-5 py-10">
      <h1 className="text-3xl font-medium tracking-tight">后台</h1>
      <Discounts discounts={discounts} />
      <Orders title={`已下单未付款（${unpaid.length}）`} rows={unpaid} />
      <Orders title={`已付款（${paid.length}）`} rows={paid} />
    </div>
  );
}

const input = 'w-full rounded-full bg-white/70 px-4 py-2 text-sm outline-none ring-1 ring-white/70 focus:ring-lake';

function Discounts({ discounts }: { discounts: Discount[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const max = String(f.get('max') ?? '');
    const expiry = String(f.get('expiry') ?? '');
    setBusy(true);
    setError('');
    try {
      await addDiscount({
        data: {
          name: String(f.get('name')),
          code: String(f.get('code')),
          type: f.get('type') as 'percentage' | 'fixed',
          value: Number(f.get('value')),
          maxRedemptions: max ? Number(max) : undefined,
          expiryDate: expiry ? new Date(expiry).toISOString() : undefined,
        },
      });
      form.reset();
      await router.invalidate();
    } catch {
      setError('创建失败，请检查填写内容（折扣码只能包含字母、数字、- 和 _，3-30 位）');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('确定删除这个折扣码？')) return;
    await removeDiscount({ data: id });
    await router.invalidate();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">折扣码</h2>
      <form onSubmit={submit} className="frost grid gap-3 rounded-[20px] p-5 sm:grid-cols-3">
        <input name="name" required placeholder="名称（内部用）" className={input} />
        <input name="code" required placeholder="折扣码，如 LAUNCH50" className={input} />
        <select name="type" className={input}>
          <option value="percentage">百分比（%）</option>
          <option value="fixed">固定金额（USD）</option>
        </select>
        <input name="value" type="number" step="any" min="0.01" required placeholder="折扣数值" className={input} />
        <input name="max" type="number" min="1" placeholder="最多使用次数（可选）" className={input} />
        <input name="expiry" type="date" className={input} aria-label="过期日期（可选）" />
        <div className="flex items-center gap-3 sm:col-span-3">
          <button
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2 text-sm text-white transition hover:bg-ink/85 disabled:opacity-50"
          >
            创建折扣码
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>

      <div className="frost mt-4 overflow-hidden rounded-[20px]">
        {discounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink/50">暂无折扣码</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-ink/50">
              <tr>
                <th className="px-5 py-3 font-normal">折扣码</th>
                <th className="px-5 py-3 font-normal">优惠</th>
                <th className="px-5 py-3 font-normal">已用 / 上限</th>
                <th className="px-5 py-3 font-normal">过期</th>
                <th className="px-5 py-3 font-normal">专属链接</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} className="border-t border-white/60">
                  <td className="px-5 py-3 font-mono">{d.code}</td>
                  <td className="px-5 py-3">
                    {d.type === 'percentage' ? `${d.percentage}%` : `$${((d.amount ?? 0) / 100).toFixed(2)}`}
                  </td>
                  <td className="px-5 py-3 tabular-nums">
                    {d.redeemCount} / {d.maxRedemptions ?? '∞'}
                  </td>
                  <td className="px-5 py-3">{d.expiryDate ? fmt.format(new Date(d.expiryDate)) : '—'}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="text-lake underline"
                      onClick={() => navigator.clipboard.writeText(`${location.origin}/api/checkout?code=${d.code}`)}
                    >
                      复制
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button type="button" className="text-red-600" onClick={() => remove(d.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Orders({ title, rows }: { title: string; rows: OrderRow[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      <div className="frost overflow-hidden rounded-[20px]">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink/50">暂无</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-ink/50">
              <tr>
                <th className="px-5 py-3 font-normal">用户</th>
                <th className="px-5 py-3 font-normal">邮箱</th>
                <th className="px-5 py-3 font-normal">下单时间</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-t border-white/60">
                  <td className="px-5 py-3">{o.name}</td>
                  <td className="px-5 py-3">{o.email}</td>
                  <td className="px-5 py-3 tabular-nums">{fmt.format(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
