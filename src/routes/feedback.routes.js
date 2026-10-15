const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/feedback.controller');
const { createFeedback, validate,saveAiResponse } = require('../validators/feedback.validator');
const auth = require('../middleware/auth.middleware');


const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, try again later.' },
});

router.post('/', submitLimiter, validate(createFeedback), ctrl.create); 
router.get('/', ctrl.list);                                    
router.get('/:id',  ctrl.getOne);                                 
router.post('/:id/analyze', ctrl.analyze);   
router.patch('/:id/ai-response', validate(saveAiResponse), ctrl.saveAiResponse);
module.exports = router;