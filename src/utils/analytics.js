// Pure functions (no database, no network) -> easy to test.
// Input: the array returned by the ListFeedbacks query.

const DAY_MS = 24 * 60 * 60 * 1000;

const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ---------- churn detection ----------
// Heuristic keywords (FR / EN / Arabic / Darija / Arabizi) + competitor names.
// Edit freely: each entry is a regex tested on the normalized text.
const CHURN_PATTERNS = [
  /\b(cancel|cancell?ing|terminate|unsubscribe|quit|switch(ing)? (to|operator|provider)|another (operator|provider)|competitor)\b/,
  /\b(resili\w*|annul\w*|desabonn\w*|quitt\w*|migrer|changer d.?operateur|partir chez|aller chez)\b/,
  /\b(djezzy|jazzy|mobilis|idoom|algerie telecom)\b/,
  /(الغاء|نلغي|الغي|نبدل|نغير الشريحة|نخرج|نقطع|جازي|جيزي|موبيليس|اتصالات الجزائر)/,
  /\b(nbdel|nbaddel|nbadel|nghayer|nghayar|nkhrej|nroh (l|li|3and|3end|pour|chez))\b/,
];

const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u0652]/g, '') // accents + Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

const mentionsChurn = (text) => {
  const t = normalize(text);
  return CHURN_PATTERNS.some((re) => re.test(t));
};

// ---------- helpers ----------
const tally = (items, getKey) => {
  const map = new Map();
  for (const it of items) {
    const k = getKey(it);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
};

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

// ---------- statistics ----------
const computeStats = (feedbacks, now = Date.now()) => {
  const total = feedbacks.length;
  const analyzedItems = feedbacks.filter((f) => f.sentiment);
  const analyzed = analyzedItems.length;

  const bySentiment = Object.fromEntries(SENTIMENTS.map((s) => [s, 0]));
  const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
  for (const [k, v] of tally(analyzedItems, (f) => f.sentiment)) if (k in bySentiment) bySentiment[k] = v;
  for (const [k, v] of tally(analyzedItems, (f) => f.priority)) if (k in byPriority) byPriority[k] = v;

  const byCategory = [...tally(analyzedItems, (f) => f.category)]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // last 30 days (UTC), oldest -> newest
  const trend = [];
  const index = new Map();
  for (let i = 29; i >= 0; i--) {
    const date = dayKey(now - i * DAY_MS);
    index.set(date, trend.length);
    trend.push({ date, total: 0, negative: 0 });
  }
  for (const f of feedbacks) {
    const i = index.get(dayKey(f.createdAt));
    if (i === undefined) continue;
    trend[i].total += 1;
    if (f.sentiment === 'NEGATIVE') trend[i].negative += 1;
  }

  const inRange = (f, fromDays, toDays) => {
    const age = now - new Date(f.createdAt).getTime();
    return age >= fromDays * DAY_MS && age < toDays * DAY_MS;
  };

  return {
    total,
    analyzed,
    pending: total - analyzed,
    uniqueCustomers: new Set(feedbacks.map((f) => f.customerEmail.toLowerCase())).size,
    negativeRate: analyzed ? Math.round((bySentiment.NEGATIVE / analyzed) * 100) : 0,
    highOrUrgent: byPriority.HIGH + byPriority.URGENT,
    needsHuman: feedbacks.filter((f) => f.needsHuman).length,
    emailsSent: feedbacks.filter((f) => f.emailSent).length,
    last7Days: feedbacks.filter((f) => inRange(f, 0, 7)).length,
    previous7Days: feedbacks.filter((f) => inRange(f, 7, 14)).length,
    bySentiment,
    byPriority,
    byCategory,
    trend,
  };
};

// ---------- customers likely to leave ----------
const SENTIMENT_POINTS = { NEGATIVE: 2, NEUTRAL: 0, POSITIVE: 0 };
const PRIORITY_POINTS = { URGENT: 4, HIGH: 3, MEDIUM: 1, LOW: 0 };
const CHURN_WORDS_POINTS = 7;
const NON_PROBLEM_CATEGORIES = new Set(['SUGGESTION_COMPLIMENT', 'OTHER']);
const humanize = (code) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ');
const MIN_SCORE = 5;      // below this, the customer is not listed
const HIGH_SCORE = 10;    // from this, level = HIGH

const findAtRiskCustomers = (feedbacks, now = Date.now()) => {
  const byCustomer = new Map();
  for (const f of feedbacks) {
    const email = f.customerEmail.toLowerCase();
    if (!byCustomer.has(email)) byCustomer.set(email, []);
    byCustomer.get(email).push(f);
  }

  const result = [];
  for (const [email, items] of byCustomer) {
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first
    const last = items[0];

    let score = 0;
    let negativeCount = 0;
    let churnWords = false;
    let hasHighPriority = false;
    let needsHuman = false;

    for (const f of items) {
      score += (SENTIMENT_POINTS[f.sentiment] || 0) + (PRIORITY_POINTS[f.priority] || 0);
      if (f.sentiment === 'NEGATIVE') negativeCount += 1;
      if (f.priority === 'HIGH' || f.priority === 'URGENT') hasHighPriority = true;
      if (f.needsHuman) { score += 1; needsHuman = true; }
      if (f.sentiment !== 'POSITIVE' && mentionsChurn(f.reason)) {
        churnWords = true;
        score += CHURN_WORDS_POINTS;
      }
    }
    if (negativeCount >= 2) score += 3;
    if (negativeCount >= 3) score += 2;
    if (now - new Date(last.createdAt).getTime() <= 30 * DAY_MS) score += 1;

    if (score < MIN_SCORE) continue;

    const reasons = [];
    if (churnWords) reasons.push('Mentions cancelling or switching operator');
    if (negativeCount >= 2) reasons.push(`${negativeCount} negative feedbacks`);
    if (hasHighPriority) reasons.push('High / urgent priority issue');
    // same problem reported again and again (compliments / "other" don't count)
    const problems = items.filter((f) => f.sentiment !== 'POSITIVE' && f.category && !NON_PROBLEM_CATEGORIES.has(f.category));
    const topCategory = [...tally(problems, (f) => f.category)].sort((a, b) => b[1] - a[1])[0];
    if (topCategory && topCategory[1] >= 2) reasons.push(`Repeated issue: ${humanize(topCategory[0])}`);
    if (needsHuman) reasons.push('Needs human follow-up');
    if (!reasons.length) reasons.push('Negative experience');

    result.push({
      email,
      name: last.customerName,
      score,
      level: score >= HIGH_SCORE ? 'HIGH' : 'MEDIUM',
      reasons,
      feedbackCount: items.length,
      negativeCount,
      mentionedChurn: churnWords,
      lastFeedback: {
        id: last.id,
        createdAt: last.createdAt,
        mainIssue: last.mainIssue,
        category: last.category,
        priority: last.priority,
      },
    });
  }

  return result.sort((a, b) => b.score - a.score);
};

module.exports = { computeStats, findAtRiskCustomers, mentionsChurn };
