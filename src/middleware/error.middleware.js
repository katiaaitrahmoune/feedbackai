const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
};
