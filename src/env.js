require('dotenv').config();

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON: ' + err.message);
  }
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  projectId: process.env.FIREBASE_PROJECT_ID,
  dcLocation: process.env.DC_LOCATION,
  dcServiceId: process.env.DC_SERVICE_ID,
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 30000,
  firebaseServiceAccount: loadServiceAccount(),

  // admin dashboard
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    jwtSecret: process.env.ADMIN_JWT_SECRET,
    tokenTtl: process.env.ADMIN_TOKEN_TTL || '8h',
  },
  // optional: lets n8n / internal tools call protected endpoints with an `x-api-key` header
  serviceApiKey: process.env.SERVICE_API_KEY,
};