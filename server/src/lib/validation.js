import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1).optional(),
});

export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().nonnegative(),
  note: z.string().optional(),
  categoryId: objectIdSchema.optional().nullable(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const upsertBudgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().nonnegative(),
});
