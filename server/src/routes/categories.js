import { Router } from 'express';
import { Category } from '../models/Category.js';
import { createCategorySchema, objectIdSchema } from '../lib/validation.js';
import { httpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const categories = await Category.find({ userId: req.user.sub }).sort({ name: 1 });
  res.json({ categories });
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createCategorySchema.parse(req.body);

    const existing = await Category.findOne({ userId: req.user.sub, name: payload.name });
    if (existing) {
      throw httpError(409, 'Category already exists');
    }

    const category = await Category.create({ ...payload, userId: req.user.sub });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = objectIdSchema.parse(req.params.id);

    const deleted = await Category.findOneAndDelete({ _id: id, userId: req.user.sub });
    if (!deleted) {
      throw httpError(404, 'Category not found');
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
