import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    color: {
      type: String,
      default: '#64748b',
    },
  },
  { timestamps: true }
);

export const Category = mongoose.model('Category', CategorySchema);
