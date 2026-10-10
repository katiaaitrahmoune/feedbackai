const Feedback = require('../models/feedback.model');
const Company = require('../models/company.model');
const ai = require('./ai.service');
const logger = require('../utils/logger');

const analyzeAndSave = async (id, reason) => {
  const analysis = await ai.analyzeFeedback(reason);
  await Feedback.saveAnalysis(id, { ...analysis, status: 'ANALYZED' });
  logger.info('Feedback analyzed', id, analysis);
  return analysis;
};

exports.submit = async (data) => {
  const { id } = await Feedback.create(data); // saved first, never lost
  let analysis = null;
  try {
    analysis = await analyzeAndSave(id, data.reason); // always called on every submission
  } catch (err) {
    logger.error('AI analysis failed for', id, err.message);
  }
  return { id, analysis };
};

exports.getAll = async () => {
  const [feedbacks, company] = await Promise.all([Feedback.findAll(), Company.findCompany()]);
  return { company, feedbacks };
};

exports.getById = async (id) => {
  const item = await Feedback.findById(id);
  if (!item) {
    const err = new Error('Feedback not found');
    err.status = 404;
    throw err;
  }
  return item;
};

exports.reanalyze = async (id) => {
  const item = await exports.getById(id);
  return analyzeAndSave(id, item.reason);
}; 
exports.saveAiResponse = async (id, fields) => {
  await exports.getById(id);                  // throws 404 if the feedback doesn't exist
  await Feedback.saveAiResponse(id, fields);
  return { id, ...fields };
};