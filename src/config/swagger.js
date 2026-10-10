module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'FeedbackAI API',
    version: '1.0.0',
    description: 'API for customer feedback submission, AI analysis and management.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'Local' }],
  tags: [{ name: 'Feedback' }, { name: 'Admin' }, { name: 'Health' }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Server health check',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/feedback': {
      post: {
        tags: ['Feedback'],
        summary: 'Submit a customer feedback (public)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Feedback received',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
          },
          429: { description: 'Too many requests' },
        },
      },
      get: {
        tags: ['Feedback'],
        summary: 'List all feedbacks (team only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Company info and the list of feedbacks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    company: { type: 'object', nullable: true },
                    feedbacks: { type: 'array', items: { $ref: '#/components/schemas/Feedback' } },
                  },
                },
              },
            },
          },
          401: { description: 'Missing or invalid token' },
        },
      },
    },
    '/api/feedback/{id}': {
      get: {
        tags: ['Feedback'],
        summary: 'Get one feedback by id (team only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Feedback',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Feedback' } } },
          },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Feedback not found' },
        },
      },
    },    '/api/feedback/{id}/ai-response': {
      patch: {
        tags: ['Feedback'],
        summary: 'Save the AI response and/or update needsHuman and emailSent (team only)',
        description: 'Send at least one of aiResponse, needsHuman, emailSent. Only the fields sent are updated.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  aiResponse: { type: 'string', minLength: 1, maxLength: 5000, example: 'Dear Amine, we are sorry about the top-up issue...' },
                  needsHuman: { type: 'boolean', example: true },
                  emailSent: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Feedback updated (lists only the fields that were sent)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    aiResponse: { type: 'string' },
                    needsHuman: { type: 'boolean' },
                    emailSent: { type: 'boolean' },
                    message: { type: 'string', example: 'Feedback updated.' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error (empty body or wrong type)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
          },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Feedback not found' },
        },
      },
    },'/api/feedback/{id}/analyze': {
  post: {
    tags: ['Feedback'],
    summary: 'Re-run the AI analysis on a feedback (team only)',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      200: {
        description: 'Analysis saved',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                analysis: {
                  type: 'object',
                  properties: {
                    sentiment: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
                    category: { type: 'string', example: 'BILLING_PAYMENT' },
                    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                    mainIssue: { type: 'string', example: 'Top-up deducted but not credited' },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Missing or invalid token' },
      404: { description: 'Feedback not found' },
      502: { description: 'AI service failed' },
    },
  },
},
    '/api/admin/login': {
      post: {
        tags: ['Admin'],
        summary: 'Admin login (returns a JWT)',
        description: 'Limited to 10 failed attempts per 15 minutes per IP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@example.com' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Logged in',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'Send as Authorization: Bearer <token>' },
                    email: { type: 'string' },
                    expiresIn: { type: 'string', example: '8h' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
          },
          401: { description: 'Invalid email or password' },
          429: { description: 'Too many login attempts' },
          503: { description: 'Admin login is not configured on the server' },
        },
      },
    },
    '/api/admin/me': {
      get: {
        tags: ['Admin'],
        summary: 'Check the current admin session',
        security: [{ adminAuth: [] }],
        responses: {
          200: {
            description: 'Current admin',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { email: { type: 'string' }, role: { type: 'string', example: 'admin' } } },
              },
            },
          },
          401: { description: 'Missing or invalid token' },
        },
      },
    },
    '/api/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Statistics, at-risk customers and all feedbacks',
        security: [{ adminAuth: [] }],
        responses: {
          200: {
            description: 'Dashboard data',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Dashboard' } } },
          },
          401: { description: 'Missing or invalid token' },
        },
      },
    },
    '/api/admin/feedbacks/{id}/analyze': {
      post: {
        tags: ['Admin'],
        summary: 'Re-run the AI analysis on a feedback',
        security: [{ adminAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Analysis saved (same body as POST /api/feedback/{id}/analyze)' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Feedback not found' },
          502: { description: 'AI service failed' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' },
      adminAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token returned by POST /api/admin/login' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'SERVICE_API_KEY, for n8n / internal tools' },
    },
    schemas: {
      FeedbackInput: {
        type: 'object',
        required: ['customerName', 'customerEmail', 'reason'],
        properties: {
          customerName: { type: 'string', minLength: 2, maxLength: 100, example: 'Amine Benali' },
          customerEmail: { type: 'string', format: 'email', example: 'amine@example.com' },
          reason: {
            type: 'string',
            minLength: 10,
            maxLength: 2000,
            example: 'My order arrived late and the box was damaged.',
          },
        },
      },
      Feedback: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          customerName: { type: 'string' },
          customerEmail: { type: 'string', format: 'email' },
          reason: { type: 'string' },
          sentiment: { type: 'string', nullable: true, example: 'NEGATIVE' },
          category: { type: 'string', nullable: true, example: 'DELIVERY' },
          priority: { type: 'string', nullable: true, example: 'HIGH' },
          mainIssue: { type: 'string', nullable: true },
          aiResponse: { type: 'string', nullable: true },
          status: { type: 'string', example: 'NEW' },
          needsHuman: { type: 'boolean' },
          emailSent: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Dashboard: {
        type: 'object',
        properties: {
          company: { type: 'object', nullable: true, properties: { name: { type: 'string' } } },
          stats: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              analyzed: { type: 'integer' },
              pending: { type: 'integer' },
              uniqueCustomers: { type: 'integer' },
              negativeRate: { type: 'integer', description: 'Percent of analyzed feedbacks that are negative' },
              highOrUrgent: { type: 'integer' },
              needsHuman: { type: 'integer' },
              emailsSent: { type: 'integer' },
              last7Days: { type: 'integer' },
              previous7Days: { type: 'integer' },
              bySentiment: { type: 'object', example: { POSITIVE: 7, NEUTRAL: 12, NEGATIVE: 26 } },
              byPriority: { type: 'object', example: { LOW: 7, MEDIUM: 19, HIGH: 10, URGENT: 9 } },
              byCategory: {
                type: 'array',
                items: { type: 'object', properties: { key: { type: 'string', example: 'NETWORK_COVERAGE' }, count: { type: 'integer' } } },
              },
              trend: {
                type: 'array',
                description: 'Last 30 days, oldest first',
                items: { type: 'object', properties: { date: { type: 'string', example: '2026-10-10' }, total: { type: 'integer' }, negative: { type: 'integer' } } },
              },
            },
          },
          atRisk: { type: 'array', items: { $ref: '#/components/schemas/AtRiskCustomer' } },
          feedbacks: { type: 'array', items: { $ref: '#/components/schemas/Feedback' } },
        },
      },
      AtRiskCustomer: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          score: { type: 'integer', example: 12 },
          level: { type: 'string', enum: ['MEDIUM', 'HIGH'] },
          reasons: { type: 'array', items: { type: 'string' }, example: ['Mentions cancelling or switching operator', '2 negative feedbacks'] },
          feedbackCount: { type: 'integer' },
          negativeCount: { type: 'integer' },
          mentionedChurn: { type: 'boolean' },
          lastFeedback: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              createdAt: { type: 'string', format: 'date-time' },
              mainIssue: { type: 'string', nullable: true },
              category: { type: 'string', nullable: true },
              priority: { type: 'string', nullable: true },
            },
          },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          details: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};