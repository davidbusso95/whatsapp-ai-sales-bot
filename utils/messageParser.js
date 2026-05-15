function parseIncomingMessage(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return null;
  }

  const contact = value?.contacts?.[0];
  const baseMessage = {
    from: message.from,
    messageId: message.id,
    timestamp: message.timestamp,
    profileName: contact?.profile?.name || '',
  };

  if (message.type !== 'text') {
    return {
      ...baseMessage,
      unsupportedType: message.type || 'unknown',
    };
  }

  return {
    ...baseMessage,
    text: message.text?.body || '',
  };
}

module.exports = {
  parseIncomingMessage,
};
