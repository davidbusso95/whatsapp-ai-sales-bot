function isValidPhone(phone) {
  return typeof phone === 'string' && /^[0-9]{8,18}$/.test(phone);
}

function cleanText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text.replace(/\s+/g, ' ').trim();
}

function truncateMessage(text, maxLength) {
  const cleanedText = cleanText(text);

  if (!maxLength || cleanedText.length <= maxLength) {
    return cleanedText;
  }

  return cleanedText.slice(0, maxLength - 3).trimEnd() + '...';
}

function normalizeWhatsAppRecipient(phone) {
  if (typeof phone !== 'string') {
    return '';
  }

  const cleanedPhone = phone.replace(/\D/g, '');

  if (cleanedPhone.startsWith('549')) {
    return `54${cleanedPhone.slice(3)}`;
  }

  return cleanedPhone;
}

module.exports = {
  isValidPhone,
  cleanText,
  truncateMessage,
  normalizeWhatsAppRecipient,
};
