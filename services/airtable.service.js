const axios = require('axios');
const logger = require('../utils/logger');

const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';
const AIRTABLE_PRODUCTS_FALLBACK =
  'En este momento no puedo consultar los productos. Te derivo con una persona del equipo.';

function getTableName(envKey, fallback) {
  return String(process.env[envKey] || fallback || '').trim();
}

function getTableUrl(tableName) {
  const baseId = String(process.env.AIRTABLE_BASE_ID || '').trim();
  const cleanTableName = String(tableName || '').trim();

  return `${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent(cleanTableName)}`;
}

function getAirtableHeaders() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function getErrorPayload(error) {
  return {
    status: error.response?.status,
    data: error.response?.data,
    message: error.response?.data?.error?.message || error.message,
  };
}

function logAirtableResponseError(error) {
  if (error.response) {
    console.log('AIRTABLE ERROR STATUS:', error.response.status);
    console.log('AIRTABLE ERROR DATA:', JSON.stringify(error.response.data, null, 2));
  }
}

async function findRecordByPhone(tableName, phone) {
  const formula = `{telefono} = '${String(phone).replace(/'/g, "\\'")}'`;

  const response = await axios.get(getTableUrl(tableName), {
    headers: getAirtableHeaders(),
    params: {
      maxRecords: 1,
      filterByFormula: formula,
    },
  });

  return response.data?.records?.[0] || null;
}

async function getAvailableProducts() {
  try {
    const tableName = getTableName('AIRTABLE_PRODUCTS_TABLE', 'Productos');
    const url = getTableUrl(tableName);

    console.log('AIRTABLE DEBUG:', {
      AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
      AIRTABLE_PRODUCTS_TABLE: process.env.AIRTABLE_PRODUCTS_TABLE,
      AIRTABLE_API_KEY_EXISTS: Boolean(process.env.AIRTABLE_API_KEY),
      AIRTABLE_API_KEY_PREFIX: process.env.AIRTABLE_API_KEY?.slice(0, 3),
      FINAL_URL: url,
    });

    const response = await axios.get(url, {
      headers: getAirtableHeaders(),
    });

    const records = response.data?.records || [];

    console.log('Airtable raw products:', JSON.stringify(records, null, 2));

    return records
      .filter((record) => {
        const fields = record.fields || {};
        return Boolean(fields.disponible);
      })
      .map((record) => {
        const fields = record.fields || {};

        return {
          id: record.id,
          nombre: fields.nombre || '',
          categoria: fields.categoria || '',
          precio: fields.precio || 0,
          descripcion: fields.descripcion || '',
          disponible: Boolean(fields.disponible),
        };
      });
  } catch (error) {
    console.error('Error getting products from Airtable');

    if (error.response) {
      console.log('AIRTABLE ERROR STATUS:', error.response.status);
      console.log('AIRTABLE ERROR DATA:', error.response.data);
    } else {
      console.error(error.message);
    }

    return [];
  }
}

async function upsertCustomer({ phone, name, requiresHuman }) {
  try {
    const tableName = 'Clientes';
    const now = new Date().toISOString();
    const existingCustomer = await findRecordByPhone(tableName, phone);

    if (existingCustomer) {
      const payload = {
          fields: {
            nombre: name || existingCustomer.fields?.nombre || '',
            ultima_interaccion: now,
            requiere_humano:
              requiresHuman === undefined
                ? Boolean(existingCustomer.fields?.requiere_humano)
                : Boolean(requiresHuman),
          },
        };

      console.log('UPSERT CUSTOMER:', payload);

      const response = await axios.patch(
        `${getTableUrl(tableName)}/${existingCustomer.id}`,
        payload,
        { headers: getAirtableHeaders() }
      );

      console.log('CUSTOMER SAVED');

      return response.data;
    }

    const payload = {
      fields: {
        telefono: phone,
        nombre: name || '',
        ultima_interaccion: now,
        requiere_humano: Boolean(requiresHuman),
      },
    };

    console.log('UPSERT CUSTOMER:', payload);

    const response = await axios.post(
      getTableUrl(tableName),
      payload,
      { headers: getAirtableHeaders() }
    );

    console.log('CUSTOMER SAVED');

    return response.data;
  } catch (error) {
    logger.error('Error upserting customer in Airtable', getErrorPayload(error));
    logAirtableResponseError(error);
    return null;
  }
}

async function saveConversation({ phone, message, response: botResponse, responseBot }) {
  try {
    const tableName = 'Conversaciones';
    const payload = {
      fields: {
        telefono: phone,
        mensaje_usuario: message || '',
        respuesta_bot: responseBot || botResponse || '',
        timestamp: new Date().toISOString(),
      },
    };

    console.log('SAVE CONVERSATION:', payload);

    const airtableResponse = await axios.post(
      getTableUrl(tableName),
      payload,
      { headers: getAirtableHeaders() }
    );

    console.log('CONVERSATION SAVED');

    return airtableResponse.data;
  } catch (error) {
    logger.error('Error saving conversation in Airtable', getErrorPayload(error));
    logAirtableResponseError(error);
    return null;
  }
}

async function markHumanRequired(phone) {
  return upsertCustomer({
    phone,
    requiresHuman: true,
  });
}

async function createOrder({
  phone,
  customerName,
  orderDetail,
  estimatedTotal,
  address,
  paymentMethod,
  status,
}) {
  try {
    const tableName = getTableName('AIRTABLE_ORDERS_TABLE', 'Pedidos');

    const response = await axios.post(
      getTableUrl(tableName),
      {
        fields: {
          telefono: phone,
          nombre_cliente: customerName || '',
          detalle_pedido: orderDetail || '',
          total_estimado: estimatedTotal || 0,
          direccion: address || '',
          metodo_pago: paymentMethod || '',
          estado: status || 'pendiente_datos',
        },
      },
      { headers: getAirtableHeaders() }
    );

    return response.data;
  } catch (error) {
    logger.error('Error creating order in Airtable', getErrorPayload(error));
    return null;
  }
}

module.exports = {
  getAvailableProducts,
  upsertCustomer,
  saveConversation,
  markHumanRequired,
  createOrder,
  AIRTABLE_PRODUCTS_FALLBACK,
};
