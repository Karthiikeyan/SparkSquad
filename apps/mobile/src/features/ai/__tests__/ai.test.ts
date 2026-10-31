import sql30 from '../../../../../../templates/sql-30.sparksquad.json';
import { AiError, buildRequest, sendChat } from '../providers';
import { quickReplies, readReply, takeRequest, usedToday } from '../session';
import { clearPrefs, setPref } from '../../../lib/prefs';

const messages = [
  { role: 'user' as const, text: 'Hi' },
  { role: 'assistant' as const, text: 'Hello' },
];

describe('provider requests', () => {
  it('keeps the Gemini key in a header, never in the URL', () => {
    const r = buildRequest('gemini', 'AIzaSECRET', messages);
    expect(r.url).not.toContain('AIzaSECRET');
    expect(r.headers['x-goog-api-key']).toBe('AIzaSECRET');
    expect(r.body).toMatchObject({ contents: [{ role: 'user' }, { role: 'model' }] });
    expect(r.read({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })).toBe(
      'ab',
    );
  });

  it('builds OpenAI and Anthropic requests', () => {
    const o = buildRequest('openai', 'sk-x', messages);
    expect(o.headers.authorization).toBe('Bearer sk-x');
    expect(o.read({ choices: [{ message: { content: 'hey' } }] })).toBe('hey');
    const a = buildRequest('anthropic', 'sk-ant-x', messages);
    expect(a.headers['x-api-key']).toBe('sk-ant-x');
    expect(a.headers['anthropic-version']).toBe('2023-06-01');
    expect(a.read({ content: [{ type: 'text', text: 'yo' }] })).toBe('yo');
    expect(a.read(null)).toBe('');
  });

  it('maps failures to reasons without echoing the key', async () => {
    const respond = (status: number, body: unknown = {}) =>
      (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    await expect(sendChat('openai', 'sk-x', messages, respond(401))).rejects.toMatchObject({
      reason: 'auth',
    });
    await expect(sendChat('openai', 'sk-x', messages, respond(429))).rejects.toMatchObject({
      reason: 'rate',
    });
    await expect(sendChat('openai', 'sk-x', messages, respond(500))).rejects.toMatchObject({
      reason: 'server',
    });
    await expect(
      sendChat('openai', 'sk-x', messages, respond(200, { choices: [] })),
    ).rejects.toMatchObject({
      reason: 'empty',
    });
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const err = await sendChat('openai', 'sk-x', messages, offline).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(String((err as Error).message)).not.toContain('sk-x');
    await expect(
      sendChat(
        'openai',
        'sk-x',
        messages,
        respond(200, { choices: [{ message: { content: ' OK ' } }] }),
      ),
    ).resolves.toBe('OK');
  });
});

describe('reply handling', () => {
  it('turns short option lists into quick replies', () => {
    expect(
      quickReplies('Pick one:\n- Striver’s A2Z sheet\n- NeetCode 150\n- No preference'),
    ).toEqual(['Striver’s A2Z sheet', 'NeetCode 150', 'No preference']);
    expect(quickReplies('Only one:\n- a')).toEqual([]);
    expect(quickReplies(`1. ${'x'.repeat(50)}\n2. b`)).toEqual([]);
  });

  it('detects a valid plan, a broken plan and a plain message', () => {
    expect(readReply('What is your level?').kind).toBe('message');
    const ok = readReply(`Here you go:\n\`\`\`json\n${JSON.stringify(sql30)}\n\`\`\``);
    expect(ok.kind).toBe('plan');
    const bad = readReply('```json\n{"title": "x"}\n```');
    expect(bad).toMatchObject({ kind: 'invalid' });
  });
});

describe('daily cap', () => {
  afterEach(() => clearPrefs());
  it('counts requests per day and stops at the limit', () => {
    setPref('aiDailyLimit', 2);
    expect(takeRequest('2026-10-31')).toBe(true);
    expect(takeRequest('2026-10-31')).toBe(true);
    expect(takeRequest('2026-10-31')).toBe(false);
    expect(usedToday('2026-10-31')).toBe(2);
    expect(usedToday('2026-11-01')).toBe(0);
    expect(takeRequest('2026-11-01')).toBe(true);
  });
});
