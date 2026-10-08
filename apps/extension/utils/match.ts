import { matchPattern, parsePattern, specificity, type Group, type TabLike } from '@tabyard/shared';

/** 在所有启用分组的模式里选出命中且最具体的；平局时靠前的分组与模式胜出 */
export function findBestGroup(tab: TabLike, groups: Group[]): Group | null {
  let best: Group | null = null;
  let bestScore = -1;
  for (const group of groups) {
    if (!group.enabled || !group.name.trim()) continue;
    for (const raw of group.patterns) {
      const p = parsePattern(raw);
      if (!matchPattern(p, tab)) continue;
      const score = specificity(p);
      if (score > bestScore) {
        best = group;
        bestScore = score;
      }
    }
  }
  return best;
}
