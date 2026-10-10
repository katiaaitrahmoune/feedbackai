const feedbackService = require('../services/feedback.service');

exports.create = async (req, res, next) => {
  try {
    const { id, analysis } = await feedbackService.submit(req.body);
    res.status(201).json({
      id,
      analysis,
      message: 'Thank you, your feedback has been received.',
    });
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    res.json(await feedbackService.getAll());
  } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try {
    res.json(await feedbackService.getById(req.params.id));
  } catch (e) { next(e); }
};

exports.analyze = async (req, res, next) => {
  try {
    const analysis = await feedbackService.reanalyze(req.params.id);
    res.json({ id: req.params.id, analysis });
  } catch (e) { next(e); }
};
exports.saveAiResponse = async (req, res, next) => {
  try {
    const result = await feedbackService.saveAiResponse(req.params.id, req.body);
    res.json({ ...result, message: 'Feedback updated.' });
  } catch (e) { next(e); }
};