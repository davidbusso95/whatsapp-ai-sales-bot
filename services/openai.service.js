const axios = require('axios');
const logger = require('../utils/logger');
const { truncateMessage } = require('../utils/validators');

const OPENAI_FALLBACK =
  'Ahora no pude procesar tu consulta correctamente. Te derivo con una persona del equipo para ayudarte mejor.';

function formatProducts(products = []) {
  if (!products.length) {
    return 'No hay productos disponibles cargados en este momento.';
  }

  return products
    .map((product) => {
      const parts = [
        `Nombre: ${product.nombre}`,
        product.categoria ? `Categoria: ${product.categoria}` : null,
        product.precio !== undefined && product.precio !== null ? `Precio: ${product.precio}` : null,
        product.descripcion ? `Descripcion: ${product.descripcion}` : null,
      ].filter(Boolean);

      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}

async function generateAIResponse({ userMessage, products, businessName, businessDescription }) {
  try {
    const name = businessName || 'el negocio';
    const description = businessDescription || 'Negocio con atencion por WhatsApp';

    const systemPrompt = [
      `Sos un asistente de ventas por WhatsApp para ${name}.`,
      'Respondés de forma breve, clara, amable y natural.',
      'Tu objetivo es ayudar al cliente, responder dudas y avanzar hacia una venta o pedido.',
      'No inventes precios, productos ni promociones.',
      'Usá solo la información de productos disponible.',
      'Si no sabés algo, ofrecé derivar a una persona del equipo.',
      'Si el cliente quiere hacer un pedido, pedile los datos necesarios: nombre, productos, dirección y método de pago.',
      'Respondé en español con tono humano, simple y profesional.',
      'La respuesta debe tener como máximo 700 caracteres.',
    ].join(' ');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              `Descripcion del negocio: ${description}`,
              '',
              'Productos disponibles:',
              formatProducts(products),
              '',
              `Mensaje del cliente: ${userMessage}`,
            ].join('\n'),
          },
        ],
        max_tokens: 220,
        temperature: 0.6,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const answer = response.data?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      logger.warn('OpenAI returned an empty answer');
      return OPENAI_FALLBACK;
    }

    return truncateMessage(answer, 700);
  } catch (error) {
    logger.error('Error generating OpenAI response', error);
    return OPENAI_FALLBACK;
  }
}

module.exports = {
  generateAIResponse,
  OPENAI_FALLBACK,
};
