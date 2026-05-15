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

module.exports = {
  isValidPhone,
  cleanText,
  truncateMessage,
};
