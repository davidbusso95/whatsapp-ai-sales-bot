const logger = require('../utils/logger');

const REQUIRED_ENV_VARS = [
  'VERIFY_TOKEN',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
  'OPENAI_API_KEY',
];

function validateEnv() {
  const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    logger.warn('Missing critical environment variables. The server will keep running, but some features may fail.', {
      missingVars,
    });
  }
}

module.exports = {
  validateEnv,
};
