import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GROUP_COLORS, parsePattern, type Group, type GroupColor } from '@tabyard/shared';
import { canEnableMoreGroups, enabledCount, groupLimit, type Plan } from '@/utils/plan';
import { uid } from '@/utils/rules';
import { COLOR_DOT } from './colors';

const COLLAPSE_THRESHOLD = 10;

interface Props {
  groups: Group[];
  plan: Plan;
  onChange: (groups: Group[]) => void;
}

export function GroupEditor({ groups, plan, onChange }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const canAdd = canEnableMoreGroups(plan, groups);
  const limit = groupLimit(plan);

  const patch = (id: string, change: Partial<Group>) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, ...change } : g)));

  const focusPattern = (groupId: string, index: number) =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>(`[data-pat="${groupId}:${index}"]`)?.focus());

  const owners = new Map<string, Group[]>();
  for (const g of groups) {
    for (const p of g.patterns) {
      const key = parsePattern(p).value;
      if (key) owners.set(key, [...(owners.get(key) ?? []), g]);
    }
  }

  const addGroup = () =>
    onChange([...groups, { id: uid(), name: '', color: 'blue', enabled: true, patterns: [''] }]);

  const removeGroup = (g: Group) => {
    if (window.confirm(t('editor.confirmDelete', { name: g.name, count: g.patterns.length }))) {
      onChange(groups.filter((x) => x.id !== g.id));
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          {t('editor.empty')}
        </p>
      )}

      {groups.map((g) => {
        const collapsed = g.patterns.length > COLLAPSE_THRESHOLD && !expanded.has(g.id);
        const collapsible = g.patterns.length > COLLAPSE_THRESHOLD;
        return (
          <div
            key={g.id}
            className={`flex flex-col gap-4 rounded-lg border p-4 sm:flex-row ${g.enabled ? '' : 'opacity-60'}`}
          >
            <div className="w-full shrink-0 space-y-2 sm:w-56">
              <div className="flex items-center gap-2">
                <Select value={g.color} onValueChange={(v) => patch(g.id, { color: v as GroupColor })}>
                  <SelectTrigger className="w-20 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block size-3 rounded-full ${COLOR_DOT[c]}`} />
                          {t(`color.${c}`)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={g.name}
                  placeholder={t('editor.groupName')}
                  onChange={(e) => patch(g.id, { name: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Switch
                  checked={g.enabled}
                  disabled={!g.enabled && !canAdd}
                  onCheckedChange={(v) => patch(g.id, { enabled: v })}
                  aria-label={t('editor.enableGroup')}
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {t('editor.patternCount', { count: g.patterns.length })}
                  </span>
                  {collapsible && (
                    <Button variant="ghost" size="xs" onClick={() => toggleExpanded(g.id)}>
                      {collapsed ? t('editor.expand') : t('editor.collapse')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeGroup(g)}
                    aria-label={t('editor.deleteGroup')}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1 space-y-2">
                {g.patterns.map((raw, i) => {
                  const parsed = parsePattern(raw);
                  const others = (owners.get(parsed.value) ?? []).filter((o) => o.id !== g.id);
                  const setPatterns = (patterns: string[]) => patch(g.id, { patterns });
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2">
                        <Input
                          data-pat={`${g.id}:${i}`}
                          value={raw}
                          placeholder={t('editor.patternPlaceholder')}
                          aria-invalid={!!parsed.error}
                          onChange={(e) => setPatterns(g.patterns.map((p, j) => (j === i ? e.target.value : p)))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              setPatterns([...g.patterns.slice(0, i + 1), '', ...g.patterns.slice(i + 1)]);
                              focusPattern(g.id, i + 1);
                            } else if (e.key === 'Backspace' && raw === '' && g.patterns.length > 1) {
                              e.preventDefault();
                              setPatterns(g.patterns.filter((_, j) => j !== i));
                              focusPattern(g.id, Math.max(0, i - 1));
                            }
                          }}
                        />
                        <span className="w-12 shrink-0 text-xs text-muted-foreground">
                          {raw.trim() && t(`kind.${parsed.kind}`)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setPatterns(g.patterns.filter((_, j) => j !== i))}
                          aria-label={t('editor.deletePattern')}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      {parsed.error && <p className="mt-1 text-xs text-destructive">{parsed.error}</p>}
                      {others.length > 0 && (
                        <p className="mt-1 text-xs text-amber-600">
                          {t('editor.alsoIn', { names: others.map((o) => o.name || '—').join('、') })}
                        </p>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    patch(g.id, { patterns: [...g.patterns, ''] });
                    focusPattern(g.id, g.patterns.length);
                  }}
                >
                  <Plus />
                  {t('editor.addPattern')}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={addGroup} disabled={!canAdd}>
          <Plus />
          {t('editor.newGroup')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {Number.isFinite(limit)
            ? canAdd
              ? t('editor.used', { used: enabledCount(groups), limit })
              : t('editor.limitReached', { limit })
            : null}
        </span>
      </div>
    </div>
  );
}
