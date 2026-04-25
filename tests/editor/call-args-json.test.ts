import { describe, expect, it } from 'vitest';
import { parseCallArgsJson } from '../../src/editor/callArgsJson';

describe('parseCallArgsJson', () => {
  it('accepts an object with shallow primitive values', () => {
    expect(parseCallArgsJson('{\"foo\":\"bar\",\"n\":1,\"b\":true,\"z\":null}')).toEqual({
      ok: true,
      value: { foo: 'bar', n: 1, b: true, z: null },
    });
  });

  it('treats empty input as empty args', () => {
    expect(parseCallArgsJson('   ')).toEqual({ ok: true, value: {} });
  });

  it('rejects non-object JSON values', () => {
    expect(parseCallArgsJson('[1,2,3]').ok).toBe(false);
    expect(parseCallArgsJson('\"hi\"').ok).toBe(false);
    expect(parseCallArgsJson('null').ok).toBe(false);
  });

  it('rejects nested objects/arrays', () => {
    expect(parseCallArgsJson('{\"a\": {\"b\": 1}}').ok).toBe(false);
    expect(parseCallArgsJson('{\"a\": [1,2]}').ok).toBe(false);
  });
});

