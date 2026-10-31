import { isErrorCode, PAYWALL_CODES, type ErrorCode } from '@sparksquad/shared';
import { t, tMaybe } from '../../i18n';

/** An error response from our API with a stable code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** No response at all (offline, DNS, timeout). Safe to retry later. */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError;
}

/** Network failures, rate limits and server errors may succeed later; 4xx will not. */
export function isRetryable(e: unknown): boolean {
  if (isNetworkError(e)) return true;
  if (isApiError(e)) return e.status === 429 || e.status >= 500;
  return false;
}

export function isPaywallError(e: unknown): boolean {
  return isApiError(e) && PAYWALL_CODES.includes(e.code);
}

/** Parses an error body defensively; unknown shapes become INTERNAL/BAD_REQUEST. */
export function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    if (err && typeof err === 'object') {
      const { code, message, details } = err as {
        code?: unknown;
        message?: unknown;
        details?: unknown;
      };
      if (isErrorCode(code)) {
        return new ApiError(status, code, typeof message === 'string' ? message : code, details);
      }
    }
  }
  const fallback: ErrorCode =
    status === 401
      ? 'UNAUTHORIZED'
      : status === 403
        ? 'FORBIDDEN'
        : status === 404
          ? 'NOT_FOUND'
          : status === 429
            ? 'RATE_LIMITED'
            : status >= 500
              ? 'INTERNAL'
              : 'BAD_REQUEST';
  return new ApiError(status, fallback, fallback);
}

/** Friendly, translated copy for any error thrown by the API layer. */
export function errorMessage(e: unknown): string {
  if (isNetworkError(e)) return t('errors.NETWORK');
  if (isApiError(e)) return tMaybe(`errors.${e.code}`) ?? t('errors.UNKNOWN');
  return t('errors.UNKNOWN');
}
