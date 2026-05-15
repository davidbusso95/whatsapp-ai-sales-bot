const airtableService = require('./airtable.service');
const openaiService = require('./openai.service');
const whatsappService = require('./whatsapp.service');
const logger = require('../utils/logger');
const { cleanText } = require('../utils/validators');

const HUMAN_HANDOFF_MESSAGE =
  'Te derivo con una persona del equipo para que pueda ayudarte mejor.';

function detectHumanIntent(text) {
  const normalizedText = cleanText(text).toLowerCase();
  const humanPhrases = [
    'humano',
    'persona',
    'asesor',
    'hablar con alguien',
    'atencion humana',
    'atención humana',
    'vendedor',
    'representante',
    'llamame',
    'quiero hablar',
  ];

  return humanPhrases.some((phrase) => normalizedText.includes(phrase));
}

function detectOrderIntent(text) {
  const normalizedText = cleanText(text).toLowerCase();
  const orderPhrases = [
    'quiero pedir',
    'hago un pedido',
    'quiero comprar',
    'me llevas',
    'me llevás',
    'delivery',
    'envio',
    'envío',
    'direccion',
    'dirección',
    'pago',
  ];

  return orderPhrases.some((phrase) => normalizedText.includes(phrase));
}

async function processIncomingMessage(incomingMessage) {
  const phone = incomingMessage.from;
  const text = cleanText(incomingMessage.text);
  const profileName = incomingMessage.profileName || '';

  if (!phone || !text) {
    logger.warn('Incoming message skipped because phone or text is missing', { phone });
    return;
  }

  await whatsappService.markMessageAsRead(incomingMessage.messageId);
  await airtableService.upsertCustomer({ phone, name: profileName });
  await airtableService.saveConversation({
    phone,
    message: text,
    status: 'recibida',
    requiresHuman: false,
  });

  if (detectHumanIntent(text)) {
    await airtableService.markHumanRequired(phone);
    await whatsappService.sendTextMessage(phone, HUMAN_HANDOFF_MESSAGE);
    return;
  }

  if (detectOrderIntent(text)) {
    await airtableService.createOrder({
      phone,
      customerName: profileName,
      orderDetail: text,
      estimatedTotal: 0,
      address: '',
      paymentMethod: '',
      status: 'pendiente_datos',
    });
  }

  const products = await airtableService.getAvailableProducts();

  if (!products.length) {
    await airtableService.markHumanRequired(phone);
    await whatsappService.sendTextMessage(phone, airtableService.AIRTABLE_PRODUCTS_FALLBACK);
    return;
  }

  const answer = await openaiService.generateAIResponse({
    userMessage: text,
    products,
    businessName: process.env.BUSINESS_NAME,
    businessDescription: process.env.BUSINESS_DESCRIPTION,
  });

  await whatsappService.sendTextMessage(phone, answer);
}

module.exports = {
  processIncomingMessage,
  detectHumanIntent,
  detectOrderIntent,
};
