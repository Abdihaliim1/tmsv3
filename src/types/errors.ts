/**
 * Type-safe error definitions
 *
 * Provides strongly-typed error handling patterns to replace 'any' usage
 */

/**
 * Firebase Auth error codes
 */
export enum FirebaseAuthErrorCode {
  UserNotFound = 'auth/user-not-found',
  WrongPassword = 'auth/wrong-password',
  EmailAlreadyInUse = 'auth/email-already-in-use',
  WeakPassword = 'auth/weak-password',
  InvalidEmail = 'auth/invalid-email',
  UserDisabled = 'auth/user-disabled',
  TooManyRequests = 'auth/too-many-requests',
  NetworkRequestFailed = 'auth/network-request-failed',
}

/**
 * Firestore error codes
 */
export enum FirestoreErrorCode {
  PermissionDenied = 'permission-denied',
  NotFound = 'not-found',
  AlreadyExists = 'already-exists',
  FailedPrecondition = 'failed-precondition',
  Unavailable = 'unavailable',
  ResourceExhausted = 'resource-exhausted',
  InvalidArgument = 'invalid-argument',
  DeadlineExceeded = 'deadline-exceeded',
  Aborted = 'aborted',
}

/**
 * Application error codes
 */
export enum AppErrorCode {
  UnknownError = 'UNKNOWN_ERROR',
  ValidationError = 'VALIDATION_ERROR',
  NetworkError = 'NETWORK_ERROR',
  PermissionError = 'PERMISSION_ERROR',
  NotFoundError = 'NOT_FOUND_ERROR',
  ConflictError = 'CONFLICT_ERROR',
  TimeoutError = 'TIMEOUT_ERROR',
}

/**
 * Firebase error with code property
 */
export interface FirebaseError extends Error {
  code: FirebaseAuthErrorCode | FirestoreErrorCode | string;
  customData?: Record<string, unknown>;
}

/**
 * Type guard to check if error is a Firebase error
 */
export function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as FirebaseError).code === 'string'
  );
}

/**
 * Type guard to check if error is a Firebase Auth error
 */
export function isFirebaseAuthError(error: unknown): error is FirebaseError {
  return (
    isFirebaseError(error) &&
    (error.code as string).startsWith('auth/')
  );
}

/**
 * Type guard to check if error is a Firestore error
 */
export function isFirestoreError(error: unknown): error is FirebaseError {
  return (
    isFirebaseError(error) &&
    (Object.values(FirestoreErrorCode) as string[]).includes(error.code)
  );
}

/**
 * HTTP error with status code
 */
export interface HTTPError extends Error {
  status: number;
  statusText: string;
  response?: unknown;
}

/**
 * Type guard for HTTP errors
 */
export function isHTTPError(error: unknown): error is HTTPError {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof (error as HTTPError).status === 'number'
  );
}

/**
 * Validation error with field-specific messages
 */
export interface ValidationError extends Error {
  code: AppErrorCode.ValidationError;
  fieldErrors: Record<string, string[]>;
}

/**
 * Type guard for validation errors
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as ValidationError).code === AppErrorCode.ValidationError &&
    'fieldErrors' in error
  );
}

/**
 * Network error type
 */
export interface NetworkError extends Error {
  code: AppErrorCode.NetworkError;
  isOffline: boolean;
}

/**
 * Type guard for network errors
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return (
    error instanceof Error &&
    ('code' in error && (error as NetworkError).code === AppErrorCode.NetworkError ||
    error.message.toLowerCase().includes('network'))
  );
}

/**
 * Generic error handler type
 */
export type ErrorHandler = (error: unknown) => void;

/**
 * Async error handler type
 */
export type AsyncErrorHandler = (error: unknown) => Promise<void>;

/**
 * Error with cause (for error chaining)
 */
export interface ErrorWithCause extends Error {
  cause?: unknown;
}

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return 'An unknown error occurred';
}

/**
 * Safely extracts error code from unknown error type
 */
export function getErrorCode(error: unknown): string {
  if (isFirebaseError(error)) {
    return error.code;
  }

  if (error instanceof Error && 'code' in error) {
    return String((error as { code: unknown }).code);
  }

  if (isHTTPError(error)) {
    return `HTTP_${error.status}`;
  }

  return AppErrorCode.UnknownError;
}

/**
 * Creates a typed error
 */
export function createTypedError(
  message: string,
  code: AppErrorCode | FirebaseAuthErrorCode | FirestoreErrorCode,
  cause?: unknown
): ErrorWithCause {
  const error = new Error(message) as ErrorWithCause & { code: string };
  error.code = code;
  error.cause = cause;
  return error;
}
