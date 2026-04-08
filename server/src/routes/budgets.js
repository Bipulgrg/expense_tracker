import { Router } from 'express';
import { MonthlyBudget } from '../models/MonthlyBudget.js';
import { upsertBudgetSchema } from '../lib/validation.js';

const router = Router();

router.get('/', async (req, res) => {
  const { year, month } = req.query;

  if (!year || !month) {
    const budgets = await MonthlyBudget.find({}).sort({ year: -1, month: -1 }).limit(24);
    return res.json({ budgets });
  }

  const y = Number(year);
  const m = Number(month);

  const budget = await MonthlyBudget.findOne({ year: y, month: m });
  res.json({ budget: budget || null });
});

router.put('/', async (req, res, next) => {
  try {
    const payload = upsertBudgetSchema.parse(req.body);

    const budget = await MonthlyBudget.findOneAndUpdate(
      { year: payload.year, month: payload.month },
      { $set: { amount: payload.amount } },
      { upsert: true, new: true }
    );

    res.json({ budget });
  } catch (err) {
    next(err);
  }
});

export default router;
