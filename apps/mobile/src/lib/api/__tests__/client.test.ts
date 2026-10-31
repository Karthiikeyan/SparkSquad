import { ApiError, NetworkError } from '../errors';
import { buildUrl, createApiClient } from '../client';

function jsonResponse(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function setup(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const onUpdateRequired = jest.fn();
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseUrl: 'https://api.test',
    appVersion: '1.2.3',
    getCookie: async () => 'better-auth.session_token=abc',
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(url, init);
    }) as unknown as typeof fetch,
    onUpdateRequired,
    onUnauthorized,
    timeoutMs: 50,
  });
  return { client, calls, onUpdateRequired, onUnauthorized };
}

describe('buildUrl', () => {
  it('drops empty query values and encodes the rest', () => {
    expect(buildUrl('https://a', '/v1/x', { q: 'a b', since: undefined, n: 0, e: '' })).toBe(
      'https://a/v1/x?q=a%20b&n=0',
    );
    expect(buildUrl('https://a', '/v1/x')).toBe('https://a/v1/x');
  });
});

describe('api client', () => {
  it('sends the session cookie, app version and JSON body', async () => {
    const { client, calls } = setup(() => jsonResponse(200, { ok: true }));
    await expect(client.put('/v1/checkins/K1', { a: 1 })).resolves.toEqual({ ok: true });
    const { url, init } = calls[0]!;
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://api.test/v1/checkins/K1');
    expect(init.method).toBe('PUT');
    expect(headers.cookie).toBe('better-auth.session_token=abc');
    expect(headers['x-app-version']).toBe('1.2.3');
    expect(headers['content-type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('maps error bodies to ApiError with the stable code', async () => {
    const { client } = setup(() =>
      jsonResponse(403, { error: { code: 'LIMIT_SQUADS_JOINED', message: 'nope' } }),
    );
    const err = await client.post('/v1/squads/join', { code: 'X' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'LIMIT_SQUADS_JOINED', message: 'nope' });
  });

  it('falls back to a code from the status when the body is not ours', async () => {
    const { client } = setup(() => new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(client.get('/v1/sync')).rejects.toMatchObject({ code: 'INTERNAL', status: 502 });
  });

  it('signals update-required and unauthorized', async () => {
    const upd = setup(() =>
      jsonResponse(426, { error: { code: 'APP_UPDATE_REQUIRED', message: 'update' } }),
    );
    await expect(upd.client.get('/v1/sync')).rejects.toBeInstanceOf(ApiError);
    expect(upd.onUpdateRequired).toHaveBeenCalledTimes(1);

    const unauth = setup(() =>
      jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }),
    );
    await expect(unauth.client.get('/v1/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(unauth.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('turns fetch failures and timeouts into NetworkError', async () => {
    const offline = setup(() => Promise.reject(new TypeError('Network request failed')));
    await expect(offline.client.get('/v1/sync')).rejects.toBeInstanceOf(NetworkError);

    const slow = setup(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await expect(slow.client.get('/v1/sync')).rejects.toBeInstanceOf(NetworkError);
  });

  it('returns null for 304 when allowed and undefined for 204', async () => {
    const notModified = setup(() => new Response(null, { status: 304 }));
    await expect(
      notModified.client.get('/v1/challenges/C1/plan', { allowNotModified: true }),
    ).resolves.toBeNull();
    const noContent = setup(() => new Response(null, { status: 204 }));
    await expect(noContent.client.del('/v1/blocks/U1')).resolves.toBeUndefined();
  });

  it('omits the cookie header when signed out', async () => {
    const calls: RequestInit[] = [];
    const client = createApiClient({
      baseUrl: 'https://api.test',
      appVersion: '1.0.0',
      getCookie: async () => '',
      fetch: (async (_u: string, init: RequestInit) => {
        calls.push(init);
        return jsonResponse(200, {});
      }) as unknown as typeof fetch,
    });
    await client.get('/v1/config');
    expect((calls[0]!.headers as Record<string, string>).cookie).toBeUndefined();
  });
});
