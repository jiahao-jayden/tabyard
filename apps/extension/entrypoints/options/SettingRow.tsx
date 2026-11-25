import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** 设置项：左侧标题和说明，右侧放开关或选择器 */
export function SettingRow({ id, label, hint, children }: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="max-w-[60ch] text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
