// 规则包：解析、导出、导入计划
import { parsePattern, validatePack, type Group, type RulePack } from '@tabyard/shared';
import { uid } from './rules';

export type { RulePack };

export function parsePack(text: string): RulePack {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error((e as Error).message);
  }
  return validatePack(json);
}

export function toPack(groups: Group[], name: string): RulePack {
  return {
    format: 'tabyard/pack',
    version: 1,
    meta: { id: 'user-' + Date.now().toString(36), name },
    groups: groups.map((g) => ({
      name: g.name,
      color: g.color,
      ...(g.enabled ? {} : { enabled: false }),
      patterns: g.patterns,
    })),
  };
}

/** 同名分组沿用 base 中的 id，反复解析同一份文本得到相同结果 */
export function packToGroups(pack: RulePack, base: Group[]): Group[] {
  const used = new Set<string>();
  return pack.groups.map((g) => {
    const id = base.find((b) => b.name === g.name && !used.has(b.id))?.id ?? uid();
    used.add(id);
    return {
      id,
      name: g.name,
      color: g.color,
      enabled: g.enabled !== false,
      patterns: g.patterns,
    };
  });
}

export type GroupMapping =
  | { type: 'new' }
  | { type: 'existing'; groupId: string };

export interface ImportItem {
  id: string;
  pattern: string;
  packGroupIndex: number;
  conflictWith?: { groupId: string; name: string };
}

export interface ImportPlan {
  items: ImportItem[];
  duplicates: number;
}

/** 已有同名分组则并入，否则新建 */
export function defaultMapping(groups: Group[], pack: RulePack): GroupMapping[] {
  return pack.groups.map((pg) => {
    const same = groups.find((g) => g.name === pg.name);
    if (same) return { type: 'existing', groupId: same.id };
    return { type: 'new' };
  });
}

export function planImport(groups: Group[], pack: RulePack, mapping: GroupMapping[]): ImportPlan {
  const owners = new Map<string, Group>();
  for (const g of groups) {
    for (const p of g.patterns) {
      const key = parsePattern(p).value;
      if (key && !owners.has(key)) owners.set(key, g);
    }
  }

  const seen = new Set<string>();
  const items: ImportItem[] = [];
  let duplicates = 0;
  pack.groups.forEach((pg, gi) => {
    const target = mapping[gi];
    if (!target) return;
    for (let pi = 0; pi < pg.patterns.length; pi++) {
      const pattern = pg.patterns[pi]!;
      const key = parsePattern(pattern).value;
      const owner = owners.get(key);
      const targetId = target.type === 'existing' ? target.groupId : undefined;
      if (seen.has(key) || (owner && owner.id === targetId)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      items.push({
        id: `${gi}:${pi}`,
        pattern,
        packGroupIndex: gi,
        conflictWith: owner ? { groupId: owner.id, name: owner.name } : undefined,
      });
    }
  });
  return { items, duplicates };
}

/** picked 中的冲突项表示「使用导入」：从原分组移走，放进目标分组 */
export function applyImport(
  groups: Group[],
  pack: RulePack,
  mapping: GroupMapping[],
  plan: ImportPlan,
  picked: Set<string>,
): Group[] {
  const next = groups.map((g) => ({ ...g, patterns: [...g.patterns] }));
  const created = new Map<number, Group>();

  for (const item of plan.items) {
    if (!picked.has(item.id)) continue;
    if (item.conflictWith) {
      const key = parsePattern(item.pattern).value;
      const owner = next.find((g) => g.id === item.conflictWith!.groupId);
      if (owner) owner.patterns = owner.patterns.filter((p) => parsePattern(p).value !== key);
    }
    const target = mapping[item.packGroupIndex]!;
    let group: Group | undefined;
    if (target.type === 'existing') {
      group = next.find((g) => g.id === target.groupId);
    } else {
      group = created.get(item.packGroupIndex);
      if (!group) {
        const pg = pack.groups[item.packGroupIndex]!;
        group = { id: uid(), name: pg.name, color: pg.color, enabled: true, patterns: [] };
        created.set(item.packGroupIndex, group);
        next.push(group);
      }
    }
    group?.patterns.push(item.pattern);
  }
  return next;
}
