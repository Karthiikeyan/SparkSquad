import { describe, expect, it } from 'vitest';
import { extractJson, findObjectSpans, parseLenient, stripJsonNoise } from '../../src/plan';

describe('extractJson', () => {
  it('returns null when there is nothing', () => {
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('{ not: valid json ')).toBeNull();
  });

  it('parses a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('finds the first balanced object in prose', () => {
    expect(extractJson('Sure! {"sparksquad_plan":1,"t":"a}b"} thanks {"x":2}')).toEqual({
      sparksquad_plan: 1,
      t: 'a}b',
    });
  });

  it('prefers the object with sparksquad_plan', () => {
    expect(extractJson('{"x":1} and {"sparksquad_plan":1}')).toEqual({ sparksquad_plan: 1 });
  });

  it('tries fenced blocks in order', () => {
    const text = '```\n{"a":1}\n```\n```json\n{"sparksquad_plan":1,"b":2}\n```';
    expect(extractJson(text)).toEqual({ sparksquad_plan: 1, b: 2 });
  });

  it('finds an object inside a fenced block with extra text', () => {
    expect(extractJson('```json\nHere: {"sparksquad_plan":1}\n```')).toEqual({
      sparksquad_plan: 1,
    });
  });

  it('falls back to scanning when a fence is unterminated or empty', () => {
    expect(extractJson('```json\n```\n{"sparksquad_plan":1}')).toEqual({ sparksquad_plan: 1 });
  });

  it('handles json5-style input', () => {
    expect(extractJson("{sparksquad_plan: 1, title: 'x',}")).toEqual({
      sparksquad_plan: 1,
      title: 'x',
    });
  });

  it('keeps smart quotes inside valid JSON strings', () => {
    expect(extractJson('{"title":"The “best” plan"}')).toEqual({ title: 'The “best” plan' });
  });
});

describe('helpers', () => {
  it('stripJsonNoise removes comments and trailing commas but not string content', () => {
    const src = '{"url":"https://x.y/z", // c\n "a":[1,2,], /* block */ "s":"a,]"}';
    expect(JSON.parse(stripJsonNoise(src))).toEqual({ url: 'https://x.y/z', a: [1, 2], s: 'a,]' });
  });

  it('stripJsonNoise keeps escaped quotes', () => {
    expect(JSON.parse(stripJsonNoise('{"a":"say \\"hi\\"",}'))).toEqual({ a: 'say "hi"' });
  });

  it('parseLenient returns undefined for junk and empty', () => {
    expect(parseLenient('')).toBeUndefined();
    expect(parseLenient('{{{')).toBeUndefined();
    expect(parseLenient('“{”')).toBe('{');
  });

  it('findObjectSpans handles nesting and escapes', () => {
    expect(findObjectSpans('a {"b":{"c":"\\"}"}} d {}')).toEqual(['{"b":{"c":"\\"}"}}', '{}']);
  });
});
