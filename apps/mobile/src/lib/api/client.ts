import { NetworkError, toApiError, type ApiError } from './errors';

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Return null instead of throwing on 304 (used with If-None-Match). */
  allowNotModified?: boolean;
}

export interface ApiClientDeps {
  baseUrl: string;
  appVersion: string;
  getCookie: () => Promise<string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Called once when the server says this app version is too old. */
  onUpdateRequired?: () => void;
  /** Called when the session is no longer valid. */
  onUnauthorized?: () => void;
}

export interface ApiClient {
  request<T>(method: string, path: string, opts?: RequestOptions): Promise<T>;
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  del<T>(path: string, opts?: RequestOptions): Promise<T>;
}

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>) {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
}

export function createApiClient(deps: ApiClientDeps): ApiClient {
  const doFetch = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 20_000;

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-app-version': deps.appVersion,
      ...opts.headers,
    };
    const cookie = await deps.getCookie();
    if (cookie) headers.cookie = cookie;
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort);

    let res: Response;
    try {
      res = await doFetch(buildUrl(deps.baseUrl, path, opts.query), {
        method,
        headers,
        body,
        signal: controller.signal,
        credentials: 'omit',
      });
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      throw new NetworkError(e instanceof Error ? e.message : undefined);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }

    if (res.status === 304 && opts.allowNotModified) return null as T;
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
    }

    if (!res.ok) {
      const err: ApiError = toApiError(res.status, parsed);
      if (err.code === 'APP_UPDATE_REQUIRED') deps.onUpdateRequired?.();
      if (err.status === 401) deps.onUnauthorized?.();
      throw err;
    }
    return parsed as T;
  }

  return {
    request,
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
    del: (path, opts) => request('DELETE', path, opts),
  };
}
