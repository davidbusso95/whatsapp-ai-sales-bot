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

async function upsertCustomer({ phone, name }) {
  try {
    const tableName = getTableName('AIRTABLE_CUSTOMERS_TABLE', 'Clientes');
    const now = new Date().toISOString();
    const existingCustomer = await findRecordByPhone(tableName, phone);

    if (existingCustomer) {
      const response = await axios.patch(
        `${getTableUrl(tableName)}/${existingCustomer.id}`,
        {
          fields: {
            nombre: name || existingCustomer.fields?.nombre || '',
            ultima_interaccion: now,
          },
        },
        { headers: getAirtableHeaders() }
      );

      return response.data;
    }

    const response = await axios.post(
      getTableUrl(tableName),
      {
        fields: {
          telefono: phone,
          nombre: name || '',
          ultima_interaccion: now,
        },
      },
      { headers: getAirtableHeaders() }
    );

    return response.data;
  } catch (error) {
    logger.error('Error upserting customer in Airtable', getErrorPayload(error));
    return null;
  }
}

async function saveConversation({ phone, message, status, requiresHuman }) {
  try {
    const tableName = getTableName('AIRTABLE_CONVERSATIONS_TABLE', 'Conversaciones');

    const response = await axios.post(
      getTableUrl(tableName),
      {
        fields: {
          telefono: phone,
          ultimo_mensaje: message,
          estado: status || 'activa',
          requiere_humano: Boolean(requiresHuman),
          fecha: new Date().toISOString(),
        },
      },
      { headers: getAirtableHeaders() }
    );

    return response.data;
  } catch (error) {
    logger.error('Error saving conversation in Airtable', getErrorPayload(error));
    return null;
  }
}

async function markHumanRequired(phone) {
  return saveConversation({
    phone,
    message: 'Cliente requiere atencion humana',
    status: 'requiere_humano',
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
