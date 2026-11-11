require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const Product = require('./models/Product');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const items = await Product.find().lean();
  fs.writeFileSync('products.json', JSON.stringify(items, null, 2), 'utf8');
  console.log(`Đã xuất ${items.length} sản phẩm ra products.json`);
  process.exit();
})();