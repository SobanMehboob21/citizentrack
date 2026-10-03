require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const { PORT = 5000, MONGO_URI, JWT_SECRET } = process.env;
if (!MONGO_URI || !JWT_SECRET) {
  console.error('MONGO_URI and JWT_SECRET must be set (see .env.example)');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  })
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
