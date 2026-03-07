const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  image:    { type: String, required: true },
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
  link:     { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  order:    { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);