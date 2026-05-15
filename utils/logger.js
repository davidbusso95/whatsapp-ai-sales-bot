function sanitize(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const secretKeys = ['token', 'api_key', 'apikey', 'authorization', 'password', 'secret'];
  const clone = Array.isArray(value) ? [] : {};

  Object.keys(value).forEach((key) => {
    const lowerKey = key.toLowerCase();
    const currentValue = value[key];

    if (secretKeys.some((secretKey) => lowerKey.includes(secretKey))) {
      clone[key] = '[redacted]';
      return;
    }

    clone[key] = typeof currentValue === 'object' && currentValue !== null ? sanitize(currentValue) : currentValue;
  });

  return clone;
}

function info(message, data) {
  if (data !== undefined) {
    console.log(`[INFO] ${message}`, sanitize(data));
    return;
  }

  console.log(`[INFO] ${message}`);
}

function warn(message, data) {
  if (data !== undefined) {
    console.warn(`[WARN] ${message}`, sanitize(data));
    return;
  }

  console.warn(`[WARN] ${message}`);
}

function error(message, errorData) {
  if (errorData?.response) {
    console.error(`[ERROR] ${message}`, sanitize({
      status: errorData.response.status,
      data: errorData.response.data,
    }));
    return;
  }

  console.error(`[ERROR] ${message}`, sanitize(errorData?.stack || errorData?.message || errorData));
}

module.exports = {
  info,
  warn,
  error,
};
