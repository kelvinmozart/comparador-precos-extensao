const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LEVEL = "info";
const MAX_STRING_LENGTH = 300;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 4;

function getConfiguredLevel() {
  const level = String(process.env.LOG_LEVEL || DEFAULT_LEVEL).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : DEFAULT_LEVEL;
}

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[getConfiguredLevel()];
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSensitiveKey(key) {
  return /api[_-]?key|authorization|bearer|token|secret|password/i.test(String(key || ""));
}

function shouldOmitKey(key) {
  return /^raw$/i.test(String(key || ""));
}

function truncateString(value) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

function sanitizeValue(value, depth = 0, key = "") {
  if (isSensitiveKey(key)) {
    return "[redacted]";
  }

  if (shouldOmitKey(key)) {
    return "[omitted]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message || ""),
      statusCode: value.statusCode,
    };
  }

  if (depth >= MAX_DEPTH) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1));

    if (value.length > MAX_ARRAY_LENGTH) {
      items.push(`[${value.length - MAX_ARRAY_LENGTH} more items]`);
    }

    return items;
  }

  if (typeof value === "object") {
    return Object.keys(value).reduce((payload, objectKey) => {
      payload[objectKey] = sanitizeValue(value[objectKey], depth + 1, objectKey);
      return payload;
    }, {});
  }

  return String(value);
}

function write(level, message, metadata) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = sanitizeValue(metadata || {});
  const hasMetadata = payload && typeof payload === "object" && Object.keys(payload).length > 0;
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  const writer = level === "debug"
    ? console.debug
    : level === "warn"
      ? console.warn
      : level === "error"
        ? console.error
        : console.info;

  if (hasMetadata) {
    writer(line, payload);
    return;
  }

  writer(line);
}

module.exports = {
  createRequestId,
  debug: (message, metadata) => write("debug", message, metadata),
  info: (message, metadata) => write("info", message, metadata),
  warn: (message, metadata) => write("warn", message, metadata),
  error: (message, metadata) => write("error", message, metadata),
};
