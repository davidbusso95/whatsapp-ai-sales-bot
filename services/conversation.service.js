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
    'delivery',
    'envio',
    'envío',
    'quiero una',
    'quiero un',
    'quiero',
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

function extractOrderCompletionData(text, profileName = '') {
  const nameMatch = text.match(/mi nombre es\s+(.+?)(?=,|\s+la direcci[oó]n\b|\s+direccion\b|\s+y\s+pago\b|\s+pago\b|$)/i);
  const addressMatch = text.match(/(?:la\s+)?direcci[oó]n\s+es\s+(.+?)(?=\s+y\s+pago\b|\s+pago\b|,|$)/i);
  const normalizedText = normalizeIntentText(text);

  let metodoPago = '';

  if (normalizedText.includes('mercado pago')) {
    metodoPago = 'Mercado Pago';
  } else if (normalizedText.includes('transferencia')) {
    metodoPago = 'Transferencia';
  } else if (normalizedText.includes('efectivo')) {
    metodoPago = 'Efectivo';
  } else if (normalizedText.includes('tarjeta')) {
    metodoPago = 'Tarjeta';
  }

  return {
    nombre: nameMatch?.[1]?.trim() || profileName || '',
    direccion: addressMatch?.[1]?.trim() || '',
    metodo_pago: metodoPago,
  };
}

function hasOrderCompletionSignal(text) {
  const normalizedText = normalizeIntentText(text);

  return (
    normalizedText.includes('mi nombre es') ||
    normalizedText.includes('direccion es') ||
    normalizedText.includes('la direccion es') ||
    normalizedText.includes('efectivo') ||
    normalizedText.includes('transferencia') ||
    normalizedText.includes('mercado pago') ||
    normalizedText.includes('tarjeta')
  );
}

function normalizeProductText(text) {
  return normalizeIntentText(text)
    .replace(/\b\d+([.,]\d+)?\s*(ml|l|lt|lts|g|gr|kg|cc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productMatchesOrder(productName, orderText) {
  const normalizedOrder = normalizeProductText(orderText);
  const normalizedProduct = normalizeProductText(productName);

  if (!normalizedProduct) {
    return false;
  }

  if (normalizedOrder.includes(normalizedProduct)) {
    return true;
  }

  const productTokens = normalizedProduct
    .split(' ')
    .filter((token) => token.length > 2);

  return productTokens.length > 0 && productTokens.every((token) => normalizedOrder.includes(token));
}

function calculateOrderTotal(orderText, products) {
  if (!orderText || !products?.length) {
    return {
      total: 0,
      matchedProducts: [],
    };
  }

  const matchedProducts = products.filter((product) => productMatchesOrder(product.nombre, orderText));
  const total = matchedProducts.reduce((sum, product) => sum + Number(product.precio || 0), 0);

  return {
    total,
    matchedProducts,
  };
}

function formatProductNames(products, fallbackText) {
  const productNames = products
    .map((product) => product.nombre)
    .filter(Boolean);

  if (!productNames.length) {
    return fallbackText || 'Pedido inicial';
  }

  if (productNames.length === 1) {
    return productNames[0];
  }

  return `${productNames.slice(0, -1).join(', ')} y ${productNames[productNames.length - 1]}`;
}

function formatConfirmedOrderResponse({ nombre, pedido, direccion, metodoPago, total }) {
  return `Perfecto ${nombre} ✅

Tu pedido quedó confirmado:

Pedido:
${pedido}

Dirección:
${direccion}

Método de pago:
${metodoPago}

Total estimado: $${total}

Ya avisamos al equipo para prepararlo.`;
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

  // C) Detectar intención de hablar con humano
  if (detectHumanIntent(userMessage)) {
    return 'Te derivo con una persona del equipo para que pueda ayudarte mejor.';
  }

  // D) Detectar intención de pedido
  if (detectOrderIntent(userMessage)) {
    return 'Perfecto 👌 Tomé tu pedido inicial. Para completarlo, indicame dirección de entrega y método de pago.';
  }

  // E) Respuesta por defecto
  return 'Gracias por tu mensaje. Puedo ayudarte con productos, precios o pedidos. Escribime qué estás buscando y te ayudo.';
}

async function processIncomingMessage(incomingMessage) {
  const from = incomingMessage.from;
  const phone = from;
  const text = cleanText(incomingMessage.text);
  const profileName = incomingMessage.profileName || '';

  if (!phone || !text) {
    logger.warn('Incoming message skipped because phone or text is missing', { phone });
    return;
  }

  await whatsappService.markMessageAsRead(incomingMessage.messageId);
  await airtableService.upsertCustomer({ phone, name: profileName });

  if (detectHumanIntent(text)) {
    await airtableService.markHumanRequired(phone);
    await airtableService.saveConversation({
      phone,
      message: text,
      responseBot: HUMAN_HANDOFF_MESSAGE,
    });
    await whatsappService.sendTextMessage(phone, HUMAN_HANDOFF_MESSAGE);
    return;
  }

  const pendingOrder = await airtableService.findPendingOrderByPhone(phone);

  if (pendingOrder) {
    console.log('PENDING ORDER FOUND', pendingOrder.id);

    const completionData = extractOrderCompletionData(text, profileName);

    console.log('ORDER COMPLETION DATA', completionData);

    if (!hasOrderCompletionSignal(text) || !completionData.direccion || !completionData.metodo_pago) {
      const missingDataResponse =
        'Para completar tu pedido necesito dirección de entrega y método de pago.';

      await airtableService.saveConversation({
        phone,
        message: text,
        responseBot: missingDataResponse,
      });

      await whatsappService.sendTextMessage(phone, missingDataResponse);
      return;
    }

    const products = await airtableService.getAvailableProducts();
    const pendingOrderText = pendingOrder.fields?.productos || '';
    const { total, matchedProducts } = calculateOrderTotal(pendingOrderText, products);
    const updatedOrder = await airtableService.updateOrder(pendingOrder.id, {
      cliente_nombre: completionData.nombre || profileName || '',
      direccion: completionData.direccion,
      metodo_pago: completionData.metodo_pago,
      estado: 'Confirmado',
      total,
    });

    console.log('ORDER UPDATED', updatedOrder);

    const finalResponse = formatConfirmedOrderResponse({
      nombre: completionData.nombre || profileName || '',
      pedido: formatProductNames(matchedProducts, pendingOrderText),
      direccion: completionData.direccion,
      metodoPago: completionData.metodo_pago,
      total,
    });

    await airtableService.saveConversation({
      phone,
      message: text,
      responseBot: finalResponse,
    });

    await whatsappService.sendTextMessage(phone, finalResponse);
    return;
  }

  if (detectOrderIntent(text)) {
    console.log('ORDER INTENT DETECTED', { phone: from, text });

    const orderPayload = {
      telefono: phone,
      cliente_nombre: profileName || '',
      productos: text,
      direccion: '',
      metodo_pago: '',
      estado: 'Pendiente',
      total: 0,
      created_at: new Date().toISOString(),
    };

    console.log('CREATE ORDER PAYLOAD', orderPayload);

    const result = await airtableService.createOrder(orderPayload);

    console.log('ORDER SAVED', result);

    const orderResponse =
      'Perfecto 👌 Tomé tu pedido inicial. Para completarlo, indicame dirección de entrega y método de pago.';

    await airtableService.saveConversation({
      phone,
      message: text,
      responseBot: orderResponse,
    });

    await whatsappService.sendTextMessage(phone, orderResponse);
    return;
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

  await airtableService.saveConversation({
    phone,
    message: text,
    responseBot: answer,
  });

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
