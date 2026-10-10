const Joi = require('joi');

const login = Joi.object({
  email: Joi.string().trim().max(254).required(),
  password: Joi.string().max(200).required(),
});

module.exports = { login };
