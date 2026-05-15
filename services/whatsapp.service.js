const axios = require('axios');
const logger = require('../utils/logger');
const { truncateMessage } = require('../utils/validators');

function getWhatsAppUrl() {
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function sendTextMessage(to, message) {
  try {
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: truncateMessage(message, 4096),
      },
    };

    const response = await axios.post(getWhatsAppUrl(), body, {
      headers: getHeaders(),
    });

    logger.info('WhatsApp text message sent', { to, messageId: response.data?.messages?.[0]?.id });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    logger.error('Error sending WhatsApp text message', error);

    return {
      success: false,
      message: 'Could not send WhatsApp message',
    };
  }
}

async function markMessageAsRead(messageId) {
  if (!messageId) {
    return {
      success: false,
      message: 'messageId is required',
    };
  }

  try {
    const body = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    const response = await axios.post(getWhatsAppUrl(), body, {
      headers: getHeaders(),
    });

    logger.info('WhatsApp message marked as read', { messageId });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    logger.error('Error marking WhatsApp message as read', error);

    return {
      success: false,
      message: 'Could not mark message as read',
    };
  }
}

module.exports = {
  sendTextMessage,
  markMessageAsRead,
};
