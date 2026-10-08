import { z } from 'zod';
import { parsePattern } from './pattern';
import { GROUP_COLORS } from './types';

export const LIMITS = {
  maxGroups: 50,
  maxPatternsPerGroup: 500,
  maxPatternLength: 200,
  maxPackBytes: 200_000,
  maxNameLength: 60,
  maxAuthorLength: 40,
  maxDescriptionLength: 500,
} as const;

/** 去掉容易混淆的 0/O、1/I/L */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const GENERATED_CODE_LENGTH = 8;
const CODE_RE = /^[A-Z0-9]{3,12}$/;

/** 去掉空格和连字符并转大写；格式不合法时返回 null */
export function normalizeCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** 拒绝带嵌套量词的正则，例如 (a+)+，避免灾难性回溯 */
function hasNestedQuantifier(source: string): boolean {
  return /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,?\d*\})/.test(source);
}

const patternSchema = z
  .string()
  .max(LIMITS.maxPatternLength)
  .superRefine((raw, ctx) => {
    const parsed = parsePattern(raw);
    if (parsed.kind !== 'regex') return;
    if (parsed.error) ctx.addIssue({ code: 'custom', message: `Invalid regex: ${parsed.error}` });
    else if (hasNestedQuantifier(parsed.value.slice(1, -1))) {
      ctx.addIssue({ code: 'custom', message: 'Regex with nested quantifiers is not allowed' });
    }
  });

export const packSchema = z.object({
  format: z.literal('tabyard/pack'),
  version: z.literal(1),
  meta: z.object({
    id: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(LIMITS.maxNameLength),
    author: z.string().max(LIMITS.maxAuthorLength).optional(),
    description: z.string().max(LIMITS.maxDescriptionLength).optional(),
  }),
  groups: z.array(z.object({
    name: z.string().trim().min(1).max(LIMITS.maxNameLength),
    color: z.enum(GROUP_COLORS),
    enabled: z.boolean().optional(),
    patterns: z.array(patternSchema).max(LIMITS.maxPatternsPerGroup),
  })).max(LIMITS.maxGroups),
});

export type RulePack = z.infer<typeof packSchema>;

/** 校验并整理：模式去空白、去重；失败时抛出带路径的 Error */
export function validatePack(json: unknown): RulePack {
  const result = packSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new Error(`${issue.path.join('.') || 'root'}: ${issue.message}`);
  }
  const pack = result.data;
  return {
    ...pack,
    groups: pack.groups.map((g) => ({
      ...g,
      patterns: [...new Set(g.patterns.map((p) => p.trim()).filter(Boolean))],
    })),
  };
}
