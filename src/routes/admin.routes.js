const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/admin.controller');
const { validate } = require('../validators/feedback.validator');
const { login } = require('../validators/admin.validator');
const { requireAdmin } = require('../middleware/admin.middleware');

// brute-force protection: 10 failed attempts / 15 min / IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, try again later.' },
});

router.post('/login', loginLimiter, validate(login), ctrl.login);

router.use(requireAdmin); // everything below needs a valid admin token
router.get('/me', ctrl.me);
router.get('/dashboard', ctrl.dashboard);             // stats + at-risk customers + all feedbacks
router.post('/feedbacks/:id/analyze', ctrl.analyze);  // re-run the AI analysis

module.exports = router;
