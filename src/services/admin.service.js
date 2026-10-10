const jwt = require('jsonwebtoken');
const env = require('../env');
const Feedback = require('../models/feedback.model');
const Company = require('../models/company.model');
const feedbackService = require('./feedback.service');
const { safeEqual } = require('../middleware/admin.middleware');
const { computeStats, findAtRiskCustomers } = require('../utils/analytics');

const httpError = (status, message) => Object.assign(new Error(message), { status });

exports.login = ({ email, password }) => {
  const { email: adminEmail, password: adminPassword, jwtSecret, tokenTtl } = env.admin;
  if (!adminEmail || !adminPassword || !jwtSecret) {
    throw httpError(503, 'Admin login is not configured on the server');
  }
  // evaluate both checks (no early exit) to keep timing uniform
  const emailOk = safeEqual(email.toLowerCase(), adminEmail.toLowerCase());
  const passwordOk = safeEqual(password, adminPassword);
  if (!(emailOk && passwordOk)) throw httpError(401, 'Invalid email or password');

  const token = jwt.sign({ role: 'admin', email: adminEmail }, jwtSecret, { expiresIn: tokenTtl });
  return { token, email: adminEmail, expiresIn: tokenTtl };
};

exports.getDashboard = async () => {
  const [feedbacks, company] = await Promise.all([Feedback.findAll(), Company.findCompany()]);
  return {
    company: company ? { name: company.name } : null,
    stats: computeStats(feedbacks),
    atRisk: findAtRiskCustomers(feedbacks),
    feedbacks,
  };
};

exports.reanalyze = (id) => feedbackService.reanalyze(id);
