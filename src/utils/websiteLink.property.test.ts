import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseWebsiteLink } from './websiteLink';

/** A scheme written in any mix of cases, as a receipt might print it. */
function anyCase(scheme: string) {
  return fc
    .array(fc.boolean(), { minLength: scheme.length, maxLength: scheme.length })
    .map((upper) => [...scheme].map((c, i) => (upper[i] ? c.toUpperCase() : c)).join(''));
}

const webUrl = fc.webUrl({ validSchemes: ['http', 'https'], withQueryParameters: true });

/** What a receipt's website line might hold: websites, and the things that only look like one. */
const websiteLine = fc.oneof(
  fc.domain(),
  webUrl,
  fc.webUrl({ authoritySettings: { withUserInfo: true } }),
  fc.tuple(fc.emailAddress(), fc.constantFrom('', 'mailto:', 'https://')).map(([a, p]) => p + a),
  fc
    .tuple(fc.constantFrom('javascript:', 'ftp://', 'tel:', 'data:'), fc.string())
    .map(([s, r]) => s + r),
  fc.string(),
);

describe('parseWebsiteLink', () => {
  it('only ever links a web address on a named host, with no credentials in it', () => {
    fc.assert(
      fc.property(websiteLine, (website) => {
        const url = parseWebsiteLink(website);
        if (!url) return;
        expect(['http:', 'https:']).toContain(url.protocol);
        expect(url.hostname).toContain('.');
        expect(url.username).toBe('');
        expect(url.password).toBe('');
      }),
      { numRuns: 500 },
    );
  });

  it('links a bare domain to that domain over https', () => {
    fc.assert(
      fc.property(fc.domain(), (domain) => {
        const url = parseWebsiteLink(domain);
        expect(url?.protocol).toBe('https:');
        expect(url?.hostname).toBe(new URL(`http://${domain}`).hostname);
      }),
    );
  });

  it('links an http or https URL as written, whatever case its scheme is in', () => {
    const written = webUrl.chain((url) => {
      const scheme = url.slice(0, url.indexOf(':'));
      return anyCase(scheme).map((cased) => ({ url, written: cased + url.slice(scheme.length) }));
    });
    fc.assert(
      fc.property(written, ({ url, written }) => {
        expect(parseWebsiteLink(written)?.href).toBe(new URL(url).href);
      }),
    );
  });
});
