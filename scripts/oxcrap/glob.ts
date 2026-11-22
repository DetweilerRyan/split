// Matches `/`-separated paths against globs, as the config's `files` and `ignorePatterns` use them.
// Node's own fs.glob and path.matchesGlob aren't stable in every Node version oxCrap supports.

/**
 * The regular expression for a glob, matching a whole path:
 * - `**` any number of folders, including none;
 * - `*` any characters but `/`;
 * - `?` one character but `/`;
 * - `{a,b}` either alternative;
 * - `\` before a character takes it literally.
 */
export function globToRegExp(glob: string) {
  return new RegExp(`^${source(glob)}$`);
}

function source(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '\\' && i + 1 < glob.length) {
      out += escape(glob[++i]);
    } else if (char === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        i++;
        out += '(?:.*/)?';
      } else {
        out += '.*';
      }
    } else if (char === '*') {
      out += '[^/]*';
    } else if (char === '?') {
      out += '[^/]';
    } else if (char === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        out += escape(char);
        continue;
      }
      out += `(?:${glob
        .slice(i + 1, end)
        .split(',')
        .map(source)
        .join('|')})`;
      i = end;
    } else {
      out += escape(char);
    }
  }
  return out;
}

const escape = (char: string) => char.replace(/[.+^$()|[\]\\{}*?]/g, '\\$&');

/** Whether `path` matches any of `globs`. */
export const matchesAny = (path: string, globs: RegExp[]) => globs.some((glob) => glob.test(path));

/** The folder a glob's matches all sit under: its segments before the first wildcard. */
export function baseOf(glob: string) {
  const segments = glob.split('/');
  const fixed: string[] = [];
  for (const segment of segments.slice(0, -1)) {
    if (/[*?{\\]/.test(segment)) break;
    fixed.push(segment);
  }
  return fixed.join('/') || '.';
}

/** A glob matching exactly `path`, with any glob characters in it taken literally. */
export const literal = (path: string) => path.replace(/[*?{}\\]/g, '\\$&');
