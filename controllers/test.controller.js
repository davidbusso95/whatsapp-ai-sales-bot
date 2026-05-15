const whatsappService = require('../services/whatsapp.service');
const airtableService = require('../services/airtable.service');
const openaiService = require('../services/openai.service');
const { cleanText } = require('../utils/validators');

function testRoute(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Test route working',
  });
}

async function sendTestMessage(req, res) {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({
      status: 'error',
      message: 'Fields "to" and "message" are required',
    });
  }

  const result = await whatsappService.sendTextMessage(to, cleanText(message));

  return res.status(result.success ? 200 : 502).json(result);
}

async function getProducts(req, res) {
  const products = await airtableService.getAvailableProducts();

  res.status(200).json({
    status: 'ok',
    products,
  });
}

async function testAI(req, res) {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      status: 'error',
      message: 'Field "message" is required',
    });
  }

  const products = await airtableService.getAvailableProducts();
  const answer = await openaiService.generateAIResponse({
    userMessage: cleanText(message),
    products,
    businessName: process.env.BUSINESS_NAME,
    businessDescription: process.env.BUSINESS_DESCRIPTION,
  });

  return res.status(200).json({
    status: 'ok',
    answer,
  });
}

module.exports = {
  testRoute,
  sendTestMessage,
  getProducts,
  testAI,
};
