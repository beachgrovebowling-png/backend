require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');

async function createAdmin() {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
  const name = String(process.env.BOOTSTRAP_ADMIN_NAME || 'Store owner').trim();
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set a valid BOOTSTRAP_ADMIN_EMAIL for this one-time command.');
  if (password.length < 12 || password.length > 128) throw new Error('Set BOOTSTRAP_ADMIN_PASSWORD to a unique password of 12–128 characters.');

  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await Admin.findOne({ email });
  if (existing) throw new Error('An admin with that email already exists; use password change after signing in.');
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ email, name, passwordHash, role: 'owner' });
  console.log('Initial owner admin created. Remove bootstrap variables from the environment now.');
}

createAdmin().catch(error => {
  console.error(`Could not create admin: ${error.message}`);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());