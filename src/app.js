const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const healthRoutes = require('./routes/health.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger (before helmet, otherwise helmet blocks the UI scripts)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// Admin dashboard (static files). Mounted before helmet with its own strict CSP:
// scripts and styles only from this server, no inline scripts.
app.use(
  '/admin',
  (req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'"
    );
    next();
  },
  express.static(path.join(__dirname, '../public/admin'))
);

app.use(helmet());

app.use('/', healthRoutes);
app.use('/api', routes);

app.use(errorHandler);

module.exports = app;