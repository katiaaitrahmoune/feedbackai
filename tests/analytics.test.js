const { computeStats, findAtRiskCustomers, mentionsChurn } = require('../src/utils/analytics');

const NOW = new Date('2026-10-10T12:00:00Z').getTime();
const ago = (days) => new Date(NOW - days * 86400000).toISOString();
const fb = (o) => ({
  id: Math.random().toString(36).slice(2), customerName: 'Test', customerEmail: 'a@x.com', reason: 'hello there',
  sentiment: 'NEUTRAL', category: 'OTHER', priority: 'LOW', mainIssue: 'x', status: 'ANALYZED',
  needsHuman: false, emailSent: false, createdAt: ago(1), ...o,
});

describe('mentionsChurn', () => {
  test.each([
    'I want to cancel my subscription',
    'Je vais résilier mon abonnement',
    'je vais changer d’opérateur',
    'Mobilis est meilleur, je pars',
    'نبغي نلغي الاشتراك',
    'rani nroh l djezzy',
  ])('detects: %s', (t) => expect(mentionsChurn(t)).toBe(true));

  test.each(['Thank you, great service', 'Mon solde a disparu après la recharge', 'internet is slow'])(
    'ignores: %s', (t) => expect(mentionsChurn(t)).toBe(false));
});

describe('computeStats', () => {
  const data = [
    fb({ sentiment: 'NEGATIVE', priority: 'URGENT', category: 'NETWORK_COVERAGE', needsHuman: true, createdAt: ago(0) }),
    fb({ sentiment: 'NEGATIVE', priority: 'HIGH', category: 'NETWORK_COVERAGE', customerEmail: 'B@x.com', createdAt: ago(3) }),
    fb({ sentiment: 'POSITIVE', priority: 'LOW', category: 'SUGGESTION_COMPLIMENT', customerEmail: 'b@x.com', emailSent: true, createdAt: ago(9) }),
    fb({ sentiment: null, priority: null, category: null, createdAt: ago(40) }),
  ];
  const s = computeStats(data, NOW);

  test('totals', () => {
    expect(s.total).toBe(4);
    expect(s.analyzed).toBe(3);
    expect(s.pending).toBe(1);
    expect(s.uniqueCustomers).toBe(2); // emails are case-insensitive
    expect(s.needsHuman).toBe(1);
    expect(s.emailsSent).toBe(1);
  });
  test('distributions', () => {
    expect(s.bySentiment).toEqual({ POSITIVE: 1, NEUTRAL: 0, NEGATIVE: 2 });
    expect(s.byPriority).toEqual({ LOW: 1, MEDIUM: 0, HIGH: 1, URGENT: 1 });
    expect(s.byCategory[0]).toEqual({ key: 'NETWORK_COVERAGE', count: 2 });
    expect(s.negativeRate).toBe(67);
    expect(s.highOrUrgent).toBe(2);
  });
  test('trend and weekly counts', () => {
    expect(s.trend).toHaveLength(30);
    expect(s.trend[29]).toMatchObject({ date: '2026-10-10', total: 1, negative: 1 });
    expect(s.last7Days).toBe(2);
    expect(s.previous7Days).toBe(1);
  });
  test('empty input does not crash', () => {
    expect(computeStats([], NOW).negativeRate).toBe(0);
  });
});

describe('findAtRiskCustomers', () => {
  test('happy or neutral customers are not listed', () => {
    expect(findAtRiskCustomers([fb({ sentiment: 'POSITIVE' }), fb({ sentiment: 'NEUTRAL', priority: 'MEDIUM' })], NOW)).toEqual([]);
  });

  test('a single negative medium complaint is not enough', () => {
    expect(findAtRiskCustomers([fb({ sentiment: 'NEGATIVE', priority: 'MEDIUM' })], NOW)).toEqual([]);
  });

  test('a high-priority negative feedback is medium risk', () => {
    const [c] = findAtRiskCustomers([fb({ sentiment: 'NEGATIVE', priority: 'HIGH' })], NOW);
    expect(c.level).toBe('MEDIUM');
  });

  test('saying they will cancel makes a customer high risk', () => {
    const [c] = findAtRiskCustomers([fb({ sentiment: 'NEGATIVE', priority: 'MEDIUM', reason: 'Je vais résilier ma ligne' })], NOW);
    expect(c.level).toBe('HIGH');
    expect(c.mentionedChurn).toBe(true);
    expect(c.reasons).toContain('Mentions cancelling or switching operator');
  });

  test('praise that mentions a competitor is not flagged', () => {
    expect(findAtRiskCustomers([fb({ sentiment: 'POSITIVE', reason: 'Better than Djezzy, thanks!' })], NOW)).toEqual([]);
  });

  test('repeated complaints are grouped per customer (case-insensitive) and escalate', () => {
    const list = findAtRiskCustomers([
      fb({ customerEmail: 'Sam@x.com', sentiment: 'NEGATIVE', priority: 'MEDIUM', category: 'INTERNET_SPEED', createdAt: ago(5) }),
      fb({ customerEmail: 'sam@x.com', sentiment: 'NEGATIVE', priority: 'MEDIUM', category: 'INTERNET_SPEED', createdAt: ago(2) }),
      fb({ customerEmail: 'other@x.com', sentiment: 'POSITIVE' }),
    ], NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ email: 'sam@x.com', feedbackCount: 2, negativeCount: 2, level: 'HIGH' });
    expect(list[0].reasons).toContain('Repeated issue: Internet speed');
  });

  test('repeated compliments are not reported as a repeated issue', () => {
    const [c] = findAtRiskCustomers([
      fb({ sentiment: 'NEGATIVE', priority: 'HIGH', category: 'SUGGESTION_COMPLIMENT' }),
      fb({ sentiment: 'POSITIVE', priority: 'LOW', category: 'SUGGESTION_COMPLIMENT' }),
    ], NOW);
    expect(c.reasons.some((r) => r.startsWith('Repeated issue'))).toBe(false);
  });

  test('sorted by score, highest first', () => {
    const list = findAtRiskCustomers([
      fb({ customerEmail: 'a@x.com', sentiment: 'NEGATIVE', priority: 'HIGH' }),
      fb({ customerEmail: 'b@x.com', sentiment: 'NEGATIVE', priority: 'URGENT', reason: 'I will cancel' }),
    ], NOW);
    expect(list.map((c) => c.email)).toEqual(['b@x.com', 'a@x.com']);
  });

  test('feedback not analyzed yet can still be caught by wording', () => {
    const list = findAtRiskCustomers([fb({ sentiment: null, priority: null, reason: 'nbdel l mobilis' })], NOW);
    expect(list).toHaveLength(1);
  });
});
