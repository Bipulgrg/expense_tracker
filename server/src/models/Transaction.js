import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
    },
    date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ date: -1 });
TransactionSchema.index({ type: 1, date: -1 });

export const Transaction = mongoose.model('Transaction', TransactionSchema);
