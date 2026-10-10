const Joi = require('joi');

const createFeedback = Joi.object({
  customerName: Joi.string().trim().min(2).max(100).required(),
  customerEmail: Joi.string().trim().lowercase().email().max(254).required(),
  reason: Joi.string().trim().min(10).max(2000).required(),
});

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => d.message),
    });
  }
  req.body = value;
  next();
};
const saveAiResponse = Joi.object({
  aiResponse: Joi.string().trim().min(1).max(5000),
  needsHuman: Joi.boolean(),
  emailSent: Joi.boolean(),
}).or('aiResponse', 'needsHuman', 'emailSent');   // at least one is required
module.exports = { createFeedback, saveAiResponse, validate };

