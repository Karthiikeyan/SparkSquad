/** Stable API error codes (Architecture §4). The app maps them to copy and paywalls. */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'LIMIT_SQUADS_JOINED',
  'LIMIT_SQUADS_OWNED',
  'LIMIT_SQUAD_FULL',
  'LIMIT_COMMENTS_PER_DAY',
  'LIMIT_NUDGE_ALREADY_SENT',
  'PLUS_REQUIRED',
  'PLAN_INVALID',
  'CHECKIN_WINDOW_CLOSED',
  'CHECKIN_DAY_OUT_OF_RANGE',
  'CHALLENGE_NOT_ACTIVE',
  'CHALLENGE_ALREADY_ACTIVE',
  'DAY_LOCKED',
  'CONTENT_NOT_ALLOWED',
  'USERNAME_TAKEN',
  'INVITE_CODE_INVALID',
  'ALREADY_MEMBER',
  'REQUEST_PENDING',
  'BLOCKED',
  'OWNER_MUST_TRANSFER',
  'CONSENT_REQUIRED',
  'ACCOUNT_SUSPENDED',
  'UPLOAD_TOO_LARGE',
  'UPLOAD_TYPE_NOT_ALLOWED',
  'PAYMENTS_DISABLED',
  'APP_UPDATE_REQUIRED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** Codes that should route the user to a paywall. */
export const PAYWALL_CODES: readonly ErrorCode[] = [
  'LIMIT_SQUADS_JOINED',
  'LIMIT_SQUADS_OWNED',
  'PLUS_REQUIRED',
];
