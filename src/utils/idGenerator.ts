/**
 * ID Generation Utilities
 *
 * Uses crypto.randomUUID() for secure, unique ID generation.
 * Falls back to timestamp + random for older browsers.
 */

/**
 * Generate a cryptographically secure UUID
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a short ID (for display purposes)
 * Uses first 8 characters of UUID
 */
export function generateShortId(): string {
  return generateUUID().substring(0, 8);
}

/**
 * Generate an ID with a prefix
 * @param prefix - The prefix for the ID (e.g., 'load', 'invoice')
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}-${generateShortId()}`;
}

/**
 * Generate a timestamped ID
 * Format: prefix_timestamp_shortId
 */
export function generateTimestampedId(prefix: string): string {
  return `${prefix}_${Date.now()}_${generateShortId()}`;
}

/**
 * Generate a load number
 * Format: L-xxxxxxxx
 */
export function generateLoadNumber(): string {
  return `L-${generateShortId().toUpperCase()}`;
}

/**
 * Generate an invoice number
 * Format: INV-xxxxxxxx
 */
export function generateInvoiceNumber(): string {
  return `INV-${generateShortId().toUpperCase()}`;
}

/**
 * Generate a settlement ID
 * Format: STL-xxxxxxxx
 */
export function generateSettlementId(): string {
  return `STL-${generateShortId()}`;
}

/**
 * Generate a settlement number (display format)
 * Format: STL-XXXXXXXX
 */
export function generateSettlementNumber(): string {
  return `STL-${generateShortId().toUpperCase()}`;
}

/**
 * Generate an invoice ID
 * Format: inv-xxxxxxxx
 */
export function generateInvoiceId(): string {
  return `inv-${generateShortId()}`;
}

/**
 * Generate an employee ID
 * Format: EMP-xxxxxxxx
 */
export function generateEmployeeId(): string {
  return `EMP-${generateShortId()}`;
}

/**
 * Generate a task ID
 * Format: task-xxxxxxxx
 */
export function generateTaskId(): string {
  return `task-${generateShortId()}`;
}

/**
 * Generate an event ID
 * Format: event_timestamp_shortId
 */
export function generateEventId(): string {
  return generateTimestampedId('event');
}

/**
 * Generate an error ID
 * Format: error_timestamp_shortId
 */
export function generateErrorId(): string {
  return generateTimestampedId('error');
}

/**
 * Generate a warning ID
 * Format: warning_timestamp_shortId
 */
export function generateWarningId(): string {
  return generateTimestampedId('warning');
}

/**
 * Generate a payment ID
 * Format: pay-xxxxxxxx
 */
export function generatePaymentId(): string {
  return `pay-${generateShortId()}`;
}

/**
 * Generate a stop ID
 * Format: timestamp-shortId
 */
export function generateStopId(): string {
  return `${Date.now()}-${generateShortId()}`;
}
