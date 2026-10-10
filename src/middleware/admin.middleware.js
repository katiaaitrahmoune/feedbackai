const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../env');

// constant-time comparison (hash first so lengths always match)
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const readAdminToken = (req) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token || !env.admin.jwtSecret) return null;
  try {
    const payload = jwt.verify(token, env.admin.jwtSecret);
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
};

// admin dashboard only
const requireAdmin = (req, res, next) => {
  const admin = readAdminToken(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  req.admin = admin;
  next();
};

// admin dashboard OR internal tools (n8n) using the x-api-key header
const requireAdminOrApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (env.serviceApiKey && key && safeEqual(key, env.serviceApiKey)) return next();
  return requireAdmin(req, res, next);
};

module.exports = { requireAdmin, requireAdminOrApiKey, safeEqual };
