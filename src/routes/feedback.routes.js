const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/feedback.controller');
const { createFeedback, validate,saveAiResponse } = require('../validators/feedback.validator');
const auth = require('../middleware/auth.middleware');

// public endpoint: limit spam (10 submissions / 15 min / IP)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, try again later.' },
});

router.post('/', submitLimiter, validate(createFeedback), ctrl.create); // public (customers)
router.get('/', ctrl.list);                                      // team only
router.get('/:id',  ctrl.getOne);                                 // team only
router.post('/:id/analyze', ctrl.analyze);   // team / n8n: re-run the analysis
router.patch('/:id/ai-response', validate(saveAiResponse), ctrl.saveAiResponse);
module.exports = router;