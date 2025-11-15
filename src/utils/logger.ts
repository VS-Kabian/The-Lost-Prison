/**
 * Secure logging utility that prevents information disclosure in production
 * Only logs detailed errors in development mode
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Logs error details in development, silent in production
 * @param message - User-friendly error description
 * @param error - The actual error object (only logged in dev)
 */
export function logError(message: string, error?: unknown): void {
  if (isDevelopment && error) {
    console.error(`[DEV] ${message}:`, error);
  }
  // In production, errors should be sent to a monitoring service
  // TODO: Integrate with Sentry, LogRocket, or similar service
}

/**
 * Logs warning in development, silent in production
 * @param message - Warning message
 * @param data - Additional context (only logged in dev)
 */
export function logWarning(message: string, data?: unknown): void {
  if (isDevelopment) {
    console.warn(`[DEV] ${message}`, data ?? '');
  }
}

/**
 * Logs info in development, silent in production
 * @param message - Info message
 * @param data - Additional context (only logged in dev)
 */
export function logInfo(message: string, data?: unknown): void {
  if (isDevelopment) {
    console.log(`[DEV] ${message}`, data ?? '');
  }
}
