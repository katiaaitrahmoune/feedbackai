const { dataConnect } = require('../config/firebase');

const create = async ({ customerName, customerEmail, reason }) => {
  const res = await dataConnect.executeMutation('CreateFeedback', {
    customerName,
    customerEmail,
    reason,
  });
  return res.data.feedback_insert; // { id }
};

const saveAnalysis = async (id, { sentiment, category, priority, mainIssue, status }) => {
  await dataConnect.executeMutation('UpdateFeedbackAnalysis', {
    id,
    sentiment,
    category,
    priority,
    mainIssue,
    status,
  });
};

const findAll = async () => {
  const res = await dataConnect.executeQuery('ListFeedbacks');
  return res.data.feedbacks;
};

const findById = async (id) => {
  const res = await dataConnect.executeQuery('GetFeedback', { id });
  return res.data.feedback;
};
const saveAiResponse = async (id, { aiResponse, needsHuman, emailSent }) => {
  const vars = { id };
  if (aiResponse !== undefined) vars.aiResponse = aiResponse;
  if (needsHuman !== undefined) vars.needsHuman = needsHuman;
  if (emailSent !== undefined) vars.emailSent = emailSent;
  await dataConnect.executeMutation('UpdateFeedbackAiResponse', vars);
};

module.exports = { create, saveAnalysis, findAll, findById,saveAiResponse };