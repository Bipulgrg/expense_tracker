import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { User } from '../models/User.js';
import { signToken } from '../lib/auth.js';
import { httpError } from '../lib/httpError.js';
import { z } from 'zod';

const router = Router();

const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

router.post('/signup', async (req, res, next) => {
  try {
    const payload = signupSchema.parse(req.body);

    const existing = await User.findOne({ email: payload.email.toLowerCase() });
    if (existing) {
      throw httpError(409, 'Email already in use');
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await User.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      passwordHash,
    });

    const token = signToken({ sub: user._id.toString(), email: user.email, name: user.name });

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);

    const user = await User.findOne({ email: payload.email.toLowerCase() });
    if (!user) {
      throw httpError(401, 'Invalid credentials');
    }

    const ok = await bcrypt.compare(payload.password, user.passwordHash);
    if (!ok) {
      throw httpError(401, 'Invalid credentials');
    }

    const token = signToken({ sub: user._id.toString(), email: user.email, name: user.name });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res) => {
  res.status(501).json({
    error: {
      message: 'Not implemented. Use Bearer token on protected endpoints instead.',
    },
  });
});

export default router;
