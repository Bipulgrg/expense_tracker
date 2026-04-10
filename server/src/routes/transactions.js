import { Router } from 'express';
import { Transaction } from '../models/Transaction.js';
import { Category } from '../models/Category.js';
import {
  createTransactionSchema,
  objectIdSchema,
  updateTransactionSchema,
} from '../lib/validation.js';
import { httpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

function parseDateInput(value) {
  // supports full ISO or YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(value);
}

router.get('/', async (req, res, next) => {
  try {
    const {
      from,
      to,
      type,
      categoryId,
      page = '1',
      limit = '50',
    } = req.query;

    const filter = { userId: req.user.sub };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = parseDateInput(String(from));
      if (to) filter.date.$lte = parseDateInput(String(to));
    }

    if (type) {
      if (!['income', 'expense'].includes(String(type))) {
        throw httpError(400, 'Invalid type');
      }
      filter.type = String(type);
    }

    if (categoryId) {
      filter.categoryId = objectIdSchema.parse(String(categoryId));
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limitNum),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      transactions: items,
      page: pageNum,
      limit: limitNum,
      total,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createTransactionSchema.parse(req.body);

    let categoryId = payload.categoryId ?? undefined;
    if (categoryId === null) categoryId = undefined;

    if (categoryId) {
      const exists = await Category.exists({ _id: categoryId, userId: req.user.sub });
      if (!exists) {
        throw httpError(400, 'Category does not exist');
      }
    }

    const tx = await Transaction.create({
      userId: req.user.sub,
      type: payload.type,
      amount: payload.amount,
      note: payload.note ?? '',
      categoryId,
      date: parseDateInput(payload.date),
    });

    res.status(201).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const payload = updateTransactionSchema.parse(req.body);

    const update = { ...payload };

    if (typeof payload.date === 'string') {
      update.date = parseDateInput(payload.date);
    }

    if (payload.categoryId === null) {
      update.categoryId = undefined;
    }

    if (payload.categoryId) {
      const exists = await Category.exists({ _id: payload.categoryId, userId: req.user.sub });
      if (!exists) {
        throw httpError(400, 'Category does not exist');
      }
    }

    const tx = await Transaction.findOneAndUpdate({ _id: id, userId: req.user.sub }, update, { new: true });
    if (!tx) {
      throw httpError(404, 'Transaction not found');
    }

    res.json({ transaction: tx });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);

    const tx = await Transaction.findOneAndDelete({ _id: id, userId: req.user.sub });
    if (!tx) {
      throw httpError(404, 'Transaction not found');
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/summary/monthly', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const y = Number(year);
    const m = Number(month);

    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
      throw httpError(400, 'year and month are required (month 1-12)');
    }

    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));

    const match = {
      userId: req.user.sub,
      date: {
        $gte: start,
        $lt: end,
      },
    };

    const results = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { type: '$type', day: { $dayOfMonth: '$date' } },
          total: { $sum: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.type',
          byDay: {
            $push: { day: '$_id.day', total: '$total' },
          },
          total: { $sum: '$total' },
        },
      },
    ]);

    const out = {
      income: { total: 0, byDay: [] },
      expense: { total: 0, byDay: [] },
    };

    for (const row of results) {
      if (row._id === 'income' || row._id === 'expense') {
        out[row._id] = { total: row.total, byDay: row.byDay };
      }
    }

    res.json({
      year: y,
      month: m,
      summary: out,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
