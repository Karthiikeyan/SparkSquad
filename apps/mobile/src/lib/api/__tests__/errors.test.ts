import {
  ApiError,
  errorMessage,
  isPaywallError,
  isRetryable,
  NetworkError,
  toApiError,
} from '../errors';

describe('api errors', () => {
  it('classifies retryable errors', () => {
    expect(isRetryable(new NetworkError())).toBe(true);
    expect(isRetryable(new ApiError(429, 'RATE_LIMITED', ''))).toBe(true);
    expect(isRetryable(new ApiError(500, 'INTERNAL', ''))).toBe(true);
    expect(isRetryable(new ApiError(400, 'VALIDATION_FAILED', ''))).toBe(false);
    expect(isRetryable(new Error('boom'))).toBe(false);
  });

  it('flags paywall codes', () => {
    expect(isPaywallError(new ApiError(403, 'LIMIT_SQUADS_OWNED', ''))).toBe(true);
    expect(isPaywallError(new ApiError(403, 'FORBIDDEN', ''))).toBe(false);
  });

  it('parses unknown bodies defensively', () => {
    expect(toApiError(404, null).code).toBe('NOT_FOUND');
    expect(toApiError(401, { error: 'x' }).code).toBe('UNAUTHORIZED');
    expect(toApiError(403, { error: { code: 'NOPE' } }).code).toBe('FORBIDDEN');
    expect(toApiError(429, undefined).code).toBe('RATE_LIMITED');
    expect(toApiError(418, undefined).code).toBe('BAD_REQUEST');
    const e = toApiError(400, { error: { code: 'PLAN_INVALID', message: 'm', details: [1] } });
    expect(e).toMatchObject({ code: 'PLAN_INVALID', message: 'm', details: [1] });
  });

  it('maps errors to friendly copy', () => {
    expect(errorMessage(new NetworkError())).toMatch(/offline/i);
    expect(errorMessage(new ApiError(409, 'LIMIT_NUDGE_ALREADY_SENT', 'raw'))).toBe(
      'You already nudged them today.',
    );
    expect(errorMessage(new Error('raw internal detail'))).toBe('Something went wrong. Try again.');
  });
});
