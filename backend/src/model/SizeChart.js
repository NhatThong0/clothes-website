const mongoose = require('mongoose');

const SizeRuleSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true },
    heightMin: { type: Number, min: 0 },
    heightMax: { type: Number, min: 0 },
    weightMin: { type: Number, min: 0 },
    weightMax: { type: Number, min: 0 },
    chestMin: { type: Number, min: 0 },
    chestMax: { type: Number, min: 0 },
    waistMin: { type: Number, min: 0 },
    waistMax: { type: Number, min: 0 },
    hipMin: { type: Number, min: 0 },
    hipMax: { type: Number, min: 0 },
    footLengthMin: { type: Number, min: 0 },
    footLengthMax: { type: Number, min: 0 },
    priority: { type: Number, default: 0 },
  },
  { _id: false }
);

const SizeChartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true },
    categoryKey: {
      type: String,
      enum: ['shirt', 'pants', 'dress', 'skirt', 'shoes', 'outerwear', 'accessory', 'generic'],
      default: 'generic',
      index: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'unisex'],
      default: 'unisex',
      index: true,
    },
    fit: {
      type: String,
      enum: ['slim', 'regular', 'relaxed', 'oversize', 'skinny', 'straight', 'wide', 'unisex', 'other'],
      default: 'regular',
    },
    sizeFormat: {
      type: String,
      enum: ['alpha', 'numeric', 'mixed'],
      default: 'mixed',
    },
    unit: { type: String, default: 'cm' },
    notes: { type: String, default: '' },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    sizes: { type: [SizeRuleSchema], default: [] },
  },
  { timestamps: true }
);

SizeChartSchema.index({ categoryKey: 1, gender: 1, fit: 1, isDefault: 1 });

module.exports = mongoose.model('SizeChart', SizeChartSchema);
