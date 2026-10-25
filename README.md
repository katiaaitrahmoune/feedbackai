# FeedbackAI

AI-powered customer feedback platform. Customers submit feedback through a website, the backend analyzes it with AI, generates a personalized reply, and routes urgent cases to the right human team.

## Features

1. **Feedback submission**: customers send their name, email, and reason through the website.
2. **AI analysis**: sentiment, category, priority, and a short main problem summary.
3. **AI-generated reply**: a personalized response based on the analysis and a company knowledge document.
4. **Automatic email**: the reply is sent to the customer by email.
5. **Storage**: feedback, analysis, and reply are saved in the database.
6. **Human escalation**: critical cases are forwarded to the appropriate team (handled through an n8n workflow).
7. **Analytics and admin dashboard**: sentiment, categories, priorities, full feedback list, and churn-risk customers.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Firebase SQL Connect (PostgreSQL)
- **AI**: LLM-based analysis and reply generation
- **Automation**: n8n (case ID, escalation, follow-up)
- **API docs**: Swagger / OpenAPI

## Project Structure

```
feedbackai/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── validators/
├── env.js
├── server.js
├── .env.example
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with SQL Connect enabled
- An API key for the AI provider

### Installation

```bash
git clone https://github.com/<your-username>/feedbackai.git
cd feedbackai
npm install
cp .env.example .env
```

Fill in `.env` with your own values (see below), then start the server:

```bash
npm run dev
```

The API runs on `http://localhost:3000` by default.

### Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port |
| `DATABASE_URL` | Database connection string |
| `AI_API_KEY` | API key for the AI provider |
| `EMAIL_HOST` / `EMAIL_USER` / `EMAIL_PASS` | SMTP settings for sending replies |
| `N8N_WEBHOOK_URL` | n8n webhook for escalation |
| `JWT_SECRET` | Secret for admin authentication |

## API Documentation

Swagger UI is available at:

```
http://localhost:3000/api-docs
```

### Main Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/feedback` | Submit a new feedback |
| `GET` | `/api/feedback` | List all feedbacks (admin) |
| `GET` | `/api/analytics` | Sentiment, category, and priority stats (admin) |
| `GET` | `/api/analytics/churn-risk` | Customers likely to leave (admin) |
| `POST` | `/api/admin/login` | Admin login |

### Example Request

```json
POST /api/feedback
{
  "name": "Amine",
  "email": "amine@example.com",
  "reason": "My internet has been down for two days."
}
```

### Example Response

```json
{
  "id": "fb_123",
  "sentiment": "negative",
  "category": "network",
  "priority": "high",
  "mainProblem": "Internet outage for 2 days"
}
```

## Roadmap

- [x] Feedback submission
- [x] AI analysis
- [ ] AI-generated replies and email sending
- [ ] n8n escalation workflow
- [ ] Admin dashboard (login, stats, feedback list, churn risk)

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes
4. Open a pull request

## License

MIT
