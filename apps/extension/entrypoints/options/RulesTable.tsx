import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { parsePattern, type Group } from '@tabyard/shared';
import { COLOR_DOT } from './colors';

interface Row {
  groupId: string;
  index: number;
  pattern: string;
}

interface Props {
  groups: Group[];
  onChange: (groups: Group[]) => void;
}

type SortKey = 'type' | 'group';

const ALL = '__all__';
const features = tableFeatures({});
const col = createColumnHelper<typeof features, Row>();

export function RulesTable({ groups, onChange }: Props) {
  const { t } = useTranslation();
  const [filterGroup, setFilterGroup] = useState(ALL);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all: Row[] = groups.flatMap((g) =>
      g.patterns.map((pattern, index) => ({ groupId: g.id, index, pattern })));
    const filtered = all.filter((r) =>
      (filterGroup === ALL || r.groupId === filterGroup) && (!q || r.pattern.toLowerCase().includes(q)));
    if (!sort) return filtered;
    const value = (r: Row) =>
      sort.key === 'type' ? parsePattern(r.pattern).kind : groupById.get(r.groupId)?.name ?? '';
    const sign = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => sign * value(a).localeCompare(value(b)));
  }, [groups, filterGroup, search, sort, groupById]);

  const setPattern = (row: Row, pattern: string) =>
    onChange(groups.map((g) =>
      g.id === row.groupId ? { ...g, patterns: g.patterns.map((p, i) => (i === row.index ? pattern : p)) } : g));

  const removePattern = (row: Row) =>
    onChange(groups.map((g) =>
      g.id === row.groupId ? { ...g, patterns: g.patterns.filter((_, i) => i !== row.index) } : g));

  const moveToGroup = (row: Row, targetId: string) => {
    if (targetId === row.groupId) return;
    onChange(groups.map((g) => {
      if (g.id === row.groupId) return { ...g, patterns: g.patterns.filter((_, i) => i !== row.index) };
      if (g.id === targetId) return { ...g, patterns: [...g.patterns, row.pattern] };
      return g;
    }));
  };

  const addPattern = () => {
    const targetId = filterGroup !== ALL ? filterGroup : groups[0]?.id;
    if (!targetId) return;
    onChange(groups.map((g) => (g.id === targetId ? { ...g, patterns: [...g.patterns, ''] } : g)));
    setSearch('');
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key !== key ? { key, desc: false } : s.desc ? null : { key, desc: true }));

  const sortHeader = (key: SortKey, label: string) => (
    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort(key)}>
      {label}
      {sort?.key === key && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </button>
  );

  const columns = useMemo(() => col.columns([
    col.accessor('pattern', {
      header: t('table.pattern'),
      cell: ({ row }) => {
        const parsed = parsePattern(row.original.pattern);
        return (
          <Input
            value={row.original.pattern}
            placeholder={t('editor.patternPlaceholder')}
            aria-invalid={!!parsed.error}
            title={parsed.error}
            onChange={(e) => setPattern(row.original, e.target.value)}
          />
        );
      },
    }),
    col.display({
      id: 'type',
      header: () => sortHeader('type', t('table.type')),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.pattern.trim() && t(`kind.${parsePattern(row.original.pattern).kind}`)}
        </span>
      ),
    }),
    col.display({
      id: 'group',
      header: () => sortHeader('group', t('table.group')),
      cell: ({ row }) => (
        <Select value={row.original.groupId} onValueChange={(v) => moveToGroup(row.original, v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                <span className="flex items-center gap-2">
                  <span className={`inline-block size-3 rounded-full ${COLOR_DOT[g.color]}`} />
                  {g.name || '—'}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    }),
    col.display({
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => removePattern(row.original)}
          aria-label={t('editor.deletePattern')}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    }),
  ]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [groups, sort, t]);

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (r) => `${r.groupId}:${r.index}`,
  });

  const tableRows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('table.allGroups')}</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name || '—'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-56"
          value={search}
          placeholder={t('table.search')}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={addPattern} disabled={groups.length === 0}>
          <Plus />
          {t('editor.addPattern')}
        </Button>
      </div>

      <ScrollArea className="rounded-md border [&>[data-slot=scroll-area-viewport]]:max-h-[480px]">
        <Table containerClassName="overflow-visible">
          <TableHeader className="sticky top-0 z-10 bg-popover shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-0">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead key={header.id} className={header.column.id === 'actions' ? 'w-10' : undefined}>
                    <table.FlexRender header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {tableRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {t('table.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
