import { describe, expect, it } from 'vitest';
import { qrSvgPath } from '../utils/qr';

describe('qrSvgPath', () => {
  it('is deterministic and non-empty', () => {
    const a = qrSvgPath('https://example.com/room/abc');
    expect(a.path.length).toBeGreaterThan(0);
    expect(qrSvgPath('https://example.com/room/abc')).toEqual(a);
  });

  it('pads with a quiet zone and grows with data', () => {
    const small = qrSvgPath('a', 0);
    expect(qrSvgPath('a', 2).size).toBe(small.size + 4);
    expect(qrSvgPath('x'.repeat(200)).size).toBeGreaterThan(qrSvgPath('a').size);
  });
});
