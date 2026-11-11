const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    soluong: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
  },
  { timestamps: false, versionKey: false, collection: 'products' }
);

module.exports = mongoose.model('Product', productSchema);