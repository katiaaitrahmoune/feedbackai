const env = require('../env');
const { CATEGORIES, buildSystemPrompt } = require('../knowledge/company');

const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORY_CODES = CATEGORIES.map((c) => c.code);

const responseSchema = {
  type: 'OBJECT',
  properties: {
    sentiment: { type: 'STRING', format: 'enum', enum: SENTIMENTS },
    category: { type: 'STRING', format: 'enum', enum: CATEGORY_CODES },
    priority: { type: 'STRING', format: 'enum', enum: PRIORITIES },
    mainIssue: { type: 'STRING' },
  },
  required: ['sentiment', 'category', 'priority', 'mainIssue'],
};

const fail = (message) => {
  const err = new Error(message);
  err.status = 502;
  throw err;
};

// make sure the AI output is always valid, even if the model drifts
const sanitize = (raw) => ({
  sentiment: SENTIMENTS.includes(raw.sentiment) ? raw.sentiment : 'NEUTRAL',
  category: CATEGORY_CODES.includes(raw.category) ? raw.category : 'OTHER',
  priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'MEDIUM',
  mainIssue: String(raw.mainIssue || 'Not specified').trim().slice(0, 120),
});

exports.analyzeFeedback = async (reason) => {
  if (!env.geminiKey) fail('GEMINI_API_KEY is missing');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiKey },
      signal: AbortSignal.timeout(env.aiTimeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: [
          { role: 'user', parts: [{ text: `<customer_feedback>\n${reason}\n</customer_feedback>` }] },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema },
      }),
    });
  } catch (e) {
    fail(`AI request failed: ${e.message}`);
  }

  if (!res.ok) fail(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) fail('Empty AI response');

  try {
    return sanitize(JSON.parse(text));
  } catch {
    fail('AI returned invalid JSON');
  }
};