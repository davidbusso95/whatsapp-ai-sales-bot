const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { validateEnv } = require('./config/env');
const webhookRoutes = require('./routes/webhook.routes');
const testRoutes = require('./routes/test.routes');
const logger = require('./utils/logger');

validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'WhatsApp AI Sales Bot backend running',
  });
});

app.use('/webhook', webhookRoutes);
app.use('/test', testRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled server error', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
