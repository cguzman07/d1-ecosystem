/**
 * Structured logging helpers for status transitions and notification sends.
 */

type LogPayload = Record<string, unknown>;

function log(level: "info" | "warn" | "error", event: string, payload: LogPayload = {}) {
  const entry = {
    level,
    event,
    at: new Date().toISOString(),
    ...payload,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, payload?: LogPayload) => log("info", event, payload),
  warn: (event: string, payload?: LogPayload) => log("warn", event, payload),
  error: (event: string, payload?: LogPayload) => log("error", event, payload),
  statusTransition: (payload: {
    orderId: string;
    previousStatus: string | null;
    newStatus: string;
    changedById: string;
  }) => log("info", "order_status_transition", payload),
  notificationSent: (payload: {
    recipientId: string;
    type: string;
    channel: string;
    orderId?: string | null;
  }) => log("info", "notification_sent", payload),
};
