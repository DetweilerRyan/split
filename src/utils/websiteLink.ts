/**
 * The receipt's website as a link: an `http:` or `https:` URL as written, or a bare domain such as
 * `daenzoal29.com` over https. `null` for anything else a receipt's website line might hold, such as
 * an email address, another scheme, or a note.
 */
export function parseWebsiteLink(website: string): URL | null {
  let url: URL;
  try {
    // `URL.parse` would do without the try, but Safari only has it from 18.
    url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  } catch {
    return null;
  }
  // A bare `info@daenzoal29.com` parses with `info` as the username, and a bare `localhost` or a
  // note's first word as a single-label host: neither is a website.
  const isWebsite = url.hostname.includes('.') && !url.username && !url.password;
  return isWebsite ? url : null;
}
