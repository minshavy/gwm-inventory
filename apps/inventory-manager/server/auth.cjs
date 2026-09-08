// Auth helpers: password hashing + JWT issuing/verification + Express
// middleware. Two roles exist:
//   - 'admin'    -> full access to everything (this is "you")
//   - 'supplier' -> scoped access to only their own products + their share
//                   of profit from sales of those products

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
const TOKEN_EXPIRY = '30d';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, supplierId: user.supplierId || null },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// Verifies the Bearer token and attaches { id, username, role, supplierId }
// to req.user. Every route mounted after this runs requires a valid login.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }
  next();
}

function requireSupplier(req, res, next) {
  if (!req.user || req.user.role !== 'supplier' || !req.user.supplierId) {
    return res.status(403).json({ error: 'Supplier account only' });
  }
  next();
}

module.exports = {
  hashPassword, comparePassword, signToken,
  authenticate, requireAdmin, requireSupplier,
  JWT_SECRET,
};
