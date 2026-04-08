import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { connectDb } from './lib/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

import transactionsRouter from './routes/transactions.js';
import categoriesRouter from './routes/categories.js';
import budgetsRouter from './routes/budgets.js';
import authRouter from './routes/auth.js';

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser requests (no Origin header)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/budgets', budgetsRouter);

app.use(notFound);
app.use(errorHandler);

try {
  await connectDb();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${PORT}`);
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err?.message || err);
  // eslint-disable-next-line no-console
  console.error('Tip: ensure MongoDB is running and MONGODB_URI is correct.');
  process.exit(1);
}
