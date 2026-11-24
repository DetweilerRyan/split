import { describe, expect, it } from 'vitest';
import { mapsLink, parseWebsiteLink, phoneLink } from './restaurantLinks';

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

describe('mapsLink', () => {
  it('searches Google Maps for the restaurant at its address', () => {
    expect(mapsLink('Trattoria Da Enzo', 'Via dei Vascellari 29, Rome').href).toBe(
      'https://www.google.com/maps/search/?api=1&query=Trattoria+Da+Enzo+Via+dei+Vascellari+29%2C+Rome',
    );
  });
});

describe('phoneLink', () => {
  it('calls the number with only its digits and its leading +', () => {
    expect(phoneLink('+39 06 581 2260').href).toBe('tel:+39065812260');
    expect(phoneLink('(06) 581-2260').href).toBe('tel:065812260');
  });
});
