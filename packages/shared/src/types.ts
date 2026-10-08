export const GROUP_COLORS = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];

export interface Group {
  id: string;
  name: string;
  color: GroupColor;
  enabled: boolean;
  patterns: string[];
}
