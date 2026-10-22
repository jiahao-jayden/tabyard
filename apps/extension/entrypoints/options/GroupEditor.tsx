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
import { uid } from '@/utils/rules';
import { COLOR_DOT } from './colors';

const PREVIEW_COUNT = 6;

interface Props {
  groups: Group[];
  onChange: (groups: Group[]) => void;
}

export function GroupEditor({ groups, onChange }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const addGroup = () => {
    const id = uid();
    setExpanded((prev) => new Set(prev).add(id));
    onChange([...groups, { id, name: '', color: 'blue', enabled: true, patterns: [''] }]);
  };

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
        const collapsed = !expanded.has(g.id);
        return (
          <div key={g.id} className={`space-y-3 rounded-lg border p-4 ${g.enabled ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <Select value={g.color} onValueChange={(v) => patch(g.id, { color: v as GroupColor })}>
                <SelectTrigger className="w-32 shrink-0">
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
                className="min-w-0 flex-1"
                value={g.name}
                placeholder={t('editor.groupName')}
                onChange={(e) => patch(g.id, { name: e.target.value })}
              />
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('editor.patternCount', { count: g.patterns.length })}
              </span>
              <Switch
                checked={g.enabled}
                onCheckedChange={(v) => patch(g.id, { enabled: v })}
                aria-label={t('editor.enableGroup')}
              />
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

            {collapsed && (
              <div className="flex flex-wrap items-center gap-1.5">
                {g.patterns.slice(0, PREVIEW_COUNT).map((p, i) => (
                  <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {p}
                  </span>
                ))}
                <Button variant="ghost" size="xs" onClick={() => toggleExpanded(g.id)}>
                  {t('editor.expandAll', { count: g.patterns.length })}
                </Button>
              </div>
            )}

            {!collapsed && (
              <div className="space-y-2">
                <div className={'max-h-72 space-y-2 overflow-y-auto pr-2'}>
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
                </div>
                <div className="flex items-center gap-1">
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
                  <Button variant="ghost" size="sm" onClick={() => toggleExpanded(g.id)}>
                    {t('editor.collapse')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={addGroup}>
          <Plus />
          {t('editor.newGroup')}
        </Button>
      </div>
    </div>
  );
}
