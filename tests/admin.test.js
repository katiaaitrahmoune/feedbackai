process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';
process.env.ADMIN_JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.SERVICE_API_KEY = 'svc-key';

jest.mock('../src/config/firebase', () => ({ admin: {}, dataConnect: {} }));
jest.mock('../src/models/feedback.model');
jest.mock('../src/models/company.model');

const request = require('supertest');
const Feedback = require('../src/models/feedback.model');
const Company = require('../src/models/company.model');
const app = require('../src/app');

const sample = [
  { id: '1', customerName: 'Amine', customerEmail: 'amine@x.com', reason: 'Je vais résilier, réseau nul', sentiment: 'NEGATIVE',
    category: 'NETWORK_COVERAGE', priority: 'HIGH', mainIssue: 'No network', status: 'ANALYZED', needsHuman: false, emailSent: false, createdAt: new Date().toISOString() },
];

beforeEach(() => {
  Feedback.findAll.mockResolvedValue(sample);
  Company.findCompany.mockResolvedValue({ name: 'Ooredoo Algérie', divisions: [] });
});

const login = async () => (await request(app).post('/api/admin/login').send({ email: 'admin@test.com', password: 'correct-horse-battery' })).body.token;

describe('admin login', () => {
  test('wrong password -> 401', async () => {
    const res = await request(app).post('/api/admin/login').send({ email: 'admin@test.com', password: 'nope' });
    expect(res.status).toBe(401);
  });
  test('missing fields -> 400', async () => {
    expect((await request(app).post('/api/admin/login').send({})).status).toBe(400);
  });
  test('good credentials -> token', async () => {
    const res = await request(app).post('/api/admin/login').send({ email: 'ADMIN@test.com', password: 'correct-horse-battery' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });
});

describe('admin dashboard', () => {
  test('requires a token', async () => {
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    expect((await request(app).get('/api/admin/dashboard').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });
  test('returns stats, at-risk customers and feedbacks', async () => {
    const token = await login();
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.company.name).toBe('Ooredoo Algérie');
    expect(res.body.stats.total).toBe(1);
    expect(res.body.atRisk[0]).toMatchObject({ email: 'amine@x.com', level: 'HIGH' });
    expect(res.body.feedbacks).toHaveLength(1);
  });
});

describe('admin page', () => {
  test('is served with a strict CSP', async () => {
    const res = await request(app).get('/admin/');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.text).toContain('Admin sign in');
    expect((await request(app).get('/admin/admin.js')).status).toBe(200);
  });
});
