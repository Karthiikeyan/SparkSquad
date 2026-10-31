import type { ErrorCode } from '@sparksquad/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const errors = {
  badRequest: (message = 'That request was not valid.', details?: unknown) =>
    new ApiError(400, 'BAD_REQUEST', message, details),
  validation: (details: unknown) =>
    new ApiError(400, 'VALIDATION_FAILED', 'Some fields need fixing.', details),
  unauthorized: () => new ApiError(401, 'UNAUTHORIZED', 'Please sign in again.'),
  forbidden: (message = 'You can’t do that in this squad.') =>
    new ApiError(403, 'FORBIDDEN', message),
  notFound: (what = 'That') => new ApiError(404, 'NOT_FOUND', `${what} wasn’t found.`),
  conflict: (code: ErrorCode, message: string) => new ApiError(409, code, message),
  limit: (code: ErrorCode, message: string) => new ApiError(403, code, message),
  rateLimited: () =>
    new ApiError(429, 'RATE_LIMITED', 'Too many requests. Wait a moment and try again.'),
  content: (message = 'That text includes words we don’t allow. Please rephrase it.') =>
    new ApiError(422, 'CONTENT_NOT_ALLOWED', message),
};
