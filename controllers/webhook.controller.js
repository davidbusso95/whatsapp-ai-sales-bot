const { parseIncomingMessage } = require('../utils/messageParser');
const conversationService = require('../services/conversation.service');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../utils/logger');

function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    logger.info('Meta webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('Meta webhook verification failed', { mode });
  return res.sendStatus(403);
}

function receiveMessage(req, res) {
  logger.info('Incoming webhook body received', req.body);

  const incomingMessage = parseIncomingMessage(req.body);

  res.sendStatus(200);

  setImmediate(async () => {
    try {
      if (!incomingMessage) {
        logger.info('Webhook ignored because it does not contain a supported message');
        return;
      }

      if (incomingMessage.unsupportedType) {
        await whatsappService.sendTextMessage(
          incomingMessage.from,
          'Por ahora puedo responder mensajes de texto. Escribime tu consulta y te ayudo.'
        );
        return;
      }

      await conversationService.processIncomingMessage(incomingMessage);
    } catch (error) {
      logger.error('Error processing incoming WhatsApp message', error);
    }
  });
}

module.exports = {
  verifyWebhook,
  receiveMessage,
};
