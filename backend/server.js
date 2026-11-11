require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Product = require('./models/Product');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ảnh base64 khá nặng

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Đã kết nối MongoDB Atlas'))
  .catch((e) => console.error('Lỗi kết nối:', e.message));

// Middleware kiểm tra đã đăng nhập
const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Phiên đăng nhập hết hạn, hãy đăng nhập lại' });
  }
};

// Kiểm tra dữ liệu sản phẩm
const clean = (b) => {
  const name = (b.name || '').trim();
  const price = Number(b.price);
  const soluong = Number(b.soluong);
  if (!name) throw new Error('Tên sản phẩm không được để trống');
  if (!Number.isFinite(price) || price < 0) throw new Error('Giá phải là số không âm');
  if (!Number.isInteger(soluong) || soluong < 0) throw new Error('Số lượng phải là số nguyên không âm');
  return { name, price, soluong, image: b.image || '' };
};

// Đăng nhập admin
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }
  res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
});

app.get('/api/products', auth, async (req, res) => {
  res.json(await Product.find().sort({ _id: -1 }));
});

app.post('/api/products', auth, async (req, res) => {
  try {
    res.status(201).json(await Product.create(clean(req.body)));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, clean(req.body), { new: true });
    if (!p) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json(p);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.delete('/api/products/:id', auth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Đã xóa' });
});

app.listen(process.env.PORT, () =>
  console.log(`Server chạy ở http://localhost:${process.env.PORT}`)
);