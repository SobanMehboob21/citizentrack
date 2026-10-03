const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Application, AuditLog, STATUSES } = require('./models');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const audit = (action, actor, target, detail = '') =>
  AuditLog.create({ action, actor, target, detail }).catch((e) => console.error('audit failed', e.message));

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again.' });
  }
};

// Health: used later by Docker/K8s probes and CI smoke tests
app.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'db-down' });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    audit('login_failed', username || 'unknown', 'auth');
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  const token = jwt.sign({ sub: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  audit('login', user.username, 'auth');
  res.json({ token, username: user.username, role: user.role });
});

// Citizen: submit
app.post('/api/applications', async (req, res) => {
  try {
    const trackingId = 'CT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const { name, idNumber, type, city } = req.body;
    const doc = await Application.create({
      trackingId, name, idNumber, type, city,
      history: [{ status: 'Submitted', remark: 'Application received', by: 'system' }],
    });
    audit('application_submitted', 'citizen', trackingId);
    res.status(201).json({ trackingId: doc.trackingId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Citizen: track (limited fields only)
app.get('/api/applications/:trackingId', async (req, res) => {
  const doc = await Application.findOne({ trackingId: req.params.trackingId.toUpperCase() });
  if (!doc) return res.status(404).json({ error: 'No application found with that tracking number.' });
  res.json({
    trackingId: doc.trackingId, name: doc.name, type: doc.type, city: doc.city,
    status: doc.status, history: doc.history.map(({ status, remark, at }) => ({ status, remark, at })),
  });
});

// Staff: list with filters
app.get('/api/applications', auth, async (req, res) => {
  const { status, type } = req.query;
  const q = {};
  if (status) q.status = status;
  if (type) q.type = type;
  res.json(await Application.find(q).sort({ createdAt: -1 }).limit(200));
});

// Staff: update status
app.patch('/api/applications/:id', auth, async (req, res) => {
  const { status, remark } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const doc = await Application.findById(req.params.id).catch(() => null);
  if (!doc) return res.status(404).json({ error: 'Application not found.' });
  doc.status = status;
  doc.history.push({ status, remark: remark || '', by: req.user.sub });
  await doc.save();
  audit('status_changed', req.user.sub, doc.trackingId, `${status}: ${remark || ''}`);
  res.json(doc);
});

// Admin: audit log
app.get('/api/audit', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(100));
});

module.exports = app;
