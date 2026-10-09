import { z } from 'zod';
import { LIMITS } from './pack-schema';
import { GROUP_COLORS } from './types';

export const SYNC_MAX_BYTES = 512_000;

export const syncDataSchema = z.object({
  settings: z.object({
    enabled: z.boolean(),
    fallback: z.enum(['domain', 'other', 'none']),
    otherGroupName: z.string().max(LIMITS.maxNameLength),
    otherColor: z.enum(GROUP_COLORS),
    autoCollapse: z.boolean(),
    insertPosition: z.enum(['end', 'start']).default('end'),
  }),
  groups: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().max(LIMITS.maxNameLength),
        color: z.enum(GROUP_COLORS),
        enabled: z.boolean(),
        patterns: z.array(z.string().max(LIMITS.maxPatternLength)).max(LIMITS.maxPatternsPerGroup),
      }),
    )
    .max(LIMITS.maxGroups),
});

export type SyncData = z.infer<typeof syncDataSchema>;

export const syncPutSchema = z.object({
  data: syncDataSchema,
  modifiedAt: z.number().int().positive(),
});

export interface SyncRecord {
  data: SyncData;
  modifiedAt: number;
}
