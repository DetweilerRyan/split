import { describe, expect, it } from 'vitest';
import { parseWebsiteLink } from './websiteLink';

describe('parseWebsiteLink', () => {
  it('links a bare domain over https', () => {
    expect(parseWebsiteLink('daenzoal29.com')?.href).toBe('https://daenzoal29.com/');
    expect(parseWebsiteLink('daenzoal29.com/menu')?.href).toBe('https://daenzoal29.com/menu');
  });

  it('links an http or https URL as written', () => {
    expect(parseWebsiteLink('http://daenzoal29.com/menu')?.href).toBe('http://daenzoal29.com/menu');
    expect(parseWebsiteLink('HTTPS://DaEnzoAl29.com')?.href).toBe('https://daenzoal29.com/');
  });

  it.each([
    ['an email address', 'info@daenzoal29.com'],
    ['a URL with a username', 'https://info@daenzoal29.com'],
    ['a mailto link', 'mailto:info@daenzoal29.com'],
    ['a script', 'javascript:alert(1)'],
    ['a note', 'Ask at the till'],
    ['a host with no dot', 'localhost'],
  ])('links nothing for %s', (_kind, website) => {
    expect(parseWebsiteLink(website)).toBeNull();
  });
});
