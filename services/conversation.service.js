const airtableService = require('./airtable.service');
const openaiService = require('./openai.service');
const whatsappService = require('./whatsapp.service');
const logger = require('../utils/logger');
const { cleanText } = require('../utils/validators');

const HUMAN_HANDOFF_MESSAGE =
  'Te derivo con una persona del equipo para que pueda ayudarte mejor.';

function normalizeIntentText(text) {
  return cleanText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectGreeting(text) {
  const normalizedText = normalizeIntentText(text);
  const greetingPhrases = ['hola', 'buenas', 'buen día', 'buenas tardes', 'buenas noches', 'buenos días'];

  return greetingPhrases.some((phrase) => normalizedText.includes(normalizeIntentText(phrase)));
}

function detectProductsIntent(text) {
  const normalizedText = normalizeIntentText(text);
  const productPhrases = [
    'productos',
    'menú',
    'menu',
    'carta',
    'hamburguesa',
    'hamburguesas',
    'precio',
    'precios',
    'tienen',
  ];

  return productPhrases.some((phrase) => normalizedText.includes(normalizeIntentText(phrase)));
}

function detectHumanIntent(text) {
  const normalizedText = normalizeIntentText(text);
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

  return humanPhrases.some((phrase) => normalizedText.includes(normalizeIntentText(phrase)));
}

function detectOrderIntent(text) {
  const normalizedText = normalizeIntentText(text);
  const orderPhrases = [
    'pedido',
    'quiero pedir',
    'comprar',
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

  return orderPhrases.some((phrase) => normalizedText.includes(normalizeIntentText(phrase)));
}

function formatProductsList(products) {
  if (!products || !products.length) {
    return 'En este momento no puedo consultar los productos. Te derivo con una persona del equipo.';
  }

  const productList = products
    .map((product) => {
      const name = product.nombre || 'Producto';
      const price = product.precio !== undefined && product.precio !== null ? `: $${product.precio}` : '';
      return `- ${name}${price}`;
    })
    .join('\n');

  return `Estos son algunos productos disponibles:\n${productList}\n¿Querés que te ayude a armar un pedido?`;
}

function fallbackManualResponse({ userMessage, products }) {
  // A) Detectar saludo
  if (detectGreeting(userMessage)) {
    return 'Hola 👋 Gracias por escribirnos. Puedo ayudarte con productos, precios o tomar tu pedido. ¿Qué estás buscando?';
  }

  // B) Detectar intención de productos
  if (detectProductsIntent(userMessage)) {
    return formatProductsList(products);
  }

  // C) Detectar intención de pedido
  if (detectOrderIntent(userMessage)) {
    return 'Perfecto. Para tomar tu pedido necesito que me indiques: productos, nombre, dirección y método de pago.';
  }

  // D) Detectar intención de hablar con humano
  if (detectHumanIntent(userMessage)) {
    return 'Te derivo con una persona del equipo para que pueda ayudarte mejor.';
  }

  // E) Respuesta por defecto
  return 'Gracias por tu mensaje. Puedo ayudarte con productos, precios o pedidos. Escribime qué estás buscando y te ayudo.';
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

  let answer;
  try {
    answer = await openaiService.generateAIResponse({
      userMessage: text,
      products,
      businessName: process.env.BUSINESS_NAME,
      businessDescription: process.env.BUSINESS_DESCRIPTION,
    });

    if (!isValidAIResponse(answer)) {
      logger.warn('OpenAI failed, using manual fallback');
      answer = fallbackManualResponse({ userMessage: text, products });
      logger.info('Using manual fallback response');
    } else {
      logger.info('Using AI response');
    }
  } catch (error) {
    logger.error('OpenAI failed, using manual fallback', error);
    answer = fallbackManualResponse({ userMessage: text, products });
    logger.info('Using manual fallback response');
  }

  await whatsappService.sendTextMessage(phone, answer);
}

function isValidAIResponse(answer) {
  const cleanedAnswer = cleanText(answer);

  return Boolean(cleanedAnswer) && cleanedAnswer !== openaiService.OPENAI_FALLBACK;
}

module.exports = {
  processIncomingMessage,
  detectHumanIntent,
  detectOrderIntent,
  fallbackManualResponse,
  formatProductsList,
  isValidAIResponse,
};
