const mongoose = require('mongoose');

const STATUSES = ['Submitted', 'Under Verification', 'Approved', 'Rejected', 'Ready for Collection'];
const TYPES = ['New ID', 'Renewal', 'Correction'];

const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['staff', 'admin'], default: 'staff' },
}, { timestamps: true }));

const Application = mongoose.model('Application', new mongoose.Schema({
  trackingId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  idNumber: { type: String, required: true, match: /^\d{5}-\d{7}-\d$/ }, // fake CNIC-style: 12345-1234567-1
  type: { type: String, enum: TYPES, required: true },
  city: { type: String, required: true, trim: true },
  status: { type: String, enum: STATUSES, default: 'Submitted', index: true },
  history: [{
    status: String,
    remark: String,
    by: String,
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true }));

const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({
  action: String,
  actor: String,
  target: String,
  detail: String,
}, { timestamps: true }));

module.exports = { User, Application, AuditLog, STATUSES, TYPES };
