# FeedbackAI – Admin dashboard

## Install (3 steps)
1. Copy the files of this folder into your backend project, keeping the same paths
   (it REPLACES: src/config/swagger.js, src/app.js, src/env.js, src/routes/index.js, src/routes/feedback.routes.js).
2. `npm install jsonwebtoken`
3. Add to your `.env` (and to your hosting env vars):

       ADMIN_EMAIL=you@yourcompany.com
       ADMIN_PASSWORD=a-long-password
       ADMIN_JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
       ADMIN_TOKEN_TTL=8h
       SERVICE_API_KEY=<optional, for n8n: sent as the x-api-key header>

Run `npm run dev` then open http://localhost:5000/admin

## What you get
| Route | Access | Purpose |
|---|---|---|
| GET /admin | public page | login + dashboard UI |
| POST /api/admin/login | public (10 tries / 15 min / IP) | returns a JWT |
| GET /api/admin/dashboard | admin | stats + at-risk customers + all feedbacks |
| POST /api/admin/feedbacks/:id/analyze | admin | re-run the AI analysis |
| GET /api/feedback, GET /api/feedback/:id | admin token OR x-api-key | were public before, now protected |

## How "customers likely to leave" is computed (src/utils/analytics.js)
Feedbacks are grouped by email, then scored:
- negative sentiment +2, priority URGENT +4 / HIGH +3 / MEDIUM +1, needs human +1
- cancel / switch-operator wording (FR, EN, Arabic, Darija, Arabizi, Djezzy / Mobilis...) +7
- 2+ negative feedbacks +3, 3+ +2 more, last feedback within 30 days +1
Score >= 5 = medium risk, >= 10 = high risk. Weights and keywords are constants at the top of the file.

## Tests
`npx jest tests/analytics.test.js tests/admin.test.js`
