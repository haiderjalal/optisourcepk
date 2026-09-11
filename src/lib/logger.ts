type Level = "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

/**
 * Structured logging.
 *
 * Emits one JSON line per event so Vercel's log drain can index it. Swap the
 * sink here for a hosted logger without touching call sites.
 *
 * Never pass raw personal data — pass identifiers and counts.
 */
function emit(level: Level, message: string, fields: LogFields = {}): void {
  const entry = JSON.stringify({
    level,
    message,
    at: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    emit("error", message, fields),
};
