import mongoose from 'mongoose';

const MonthlyBudgetSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

MonthlyBudgetSchema.index({ year: 1, month: 1 }, { unique: true });

export const MonthlyBudget = mongoose.model('MonthlyBudget', MonthlyBudgetSchema);
