require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = [
    { username: 'staff', password: process.env.SEED_STAFF_PASSWORD || 'staff12345', role: 'staff' },
    { username: 'admin', password: process.env.SEED_ADMIN_PASSWORD || 'admin12345', role: 'admin' },
  ];
  for (const u of users) {
    await User.updateOne(
      { username: u.username },
      { username: u.username, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) },
      { upsert: true },
    );
    console.log('seeded', u.username);
  }
  await mongoose.disconnect();
})();
