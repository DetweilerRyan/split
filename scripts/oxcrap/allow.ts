// Reads the `@crap-allow` comments in a parsed file and matches each to the function it's above.
import type { Comment, Fn, Parsed } from './functions.ts';

export type Finding = { file: string; line: number; message: string };
export type Allow = {
  file: string;
  /** The comment's first and last lines. */
  line: number;
  lastLine: number;
  crap: number;
  complexity: number;
  reason: string;
};

export const FORM = '`// @crap-allow CRAP <score>, complexity <n>. <reason>`';
const DIRECTIVE = /^@crap-allow(?![\w-])/;
const FORMAT = /^@crap-allow CRAP (\d+(?:\.\d)?), complexity (\d+)\.(?: (\S.*))?$/;

/** A comment's text on one line: a block comment's line breaks and leading `*`s become spaces. */
export function commentText(comment: Comment) {
  return comment.value
    .split('\n')
    .map((line) => line.trim().replace(/^\*(?!\/)\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `source` with every comment blanked to spaces, keeping line breaks, so only code is left. */
function withoutComments(source: string, comments: Comment[]) {
  let code = '';
  let from = 0;
  for (const comment of comments) {
    code += source.slice(from, comment.start);
    code += source.slice(comment.start, comment.end).replace(/[^\n]/g, ' ');
    from = comment.end;
  }
  return code + source.slice(from);
}

/**
 * The line a comment points at: the first line after it with code on it, skipping lines that hold
 * only other comments, such as a lint directive or a JSX `{/* … *\/}`.
 */
function targetLine(code: string[], comment: Comment, parsed: Parsed) {
  const end = parsed.position(comment.end);
  const rest = code[end.line - 1].slice(end.column).trim();
  if (rest !== '' && rest !== '}') return end.line;
  for (let line = end.line + 1; line <= code.length; line++) {
    const trimmed = code[line - 1].trim();
    // A JSX comment, {/* … */}, leaves its braces behind once the comment is blanked.
    if (trimmed.replace(/\s+/g, '') !== '' && trimmed.replace(/\s+/g, '') !== '{}') return line;
  }
  return undefined;
}

export function findAllows(file: string, source: string, parsed: Parsed) {
  const problems: Finding[] = [];
  const allowed = new Map<Fn, Allow>();
  const code = withoutComments(source, parsed.comments).split('\n');

  for (const comment of parsed.comments) {
    const text = commentText(comment);
    if (!DIRECTIVE.test(text)) continue;
    const line = parsed.position(comment.start).line;
    const at = { file, line };
    const match = FORMAT.exec(text);
    if (!match) {
      problems.push({ ...at, message: `This @crap-allow comment isn’t in the form ${FORM}.` });
      continue;
    }

    const target = targetLine(code, comment, parsed);
    const starting = parsed.functions.filter((fn) => fn.start.line === target);
    // A function nested in another that starts on the same line belongs to the outer one.
    const candidates = starting.filter(
      (fn) => !starting.some((other) => fn.parents.includes(other)),
    );
    if (candidates.length === 0) {
      problems.push({
        ...at,
        message:
          'This @crap-allow comment isn’t directly above a function. Move it there, or delete it.',
      });
      continue;
    }
    if (candidates.length > 1) {
      problems.push({
        ...at,
        message: `${candidates.length} functions start on line ${target} (${candidates.map((fn) => fn.name).join(', ')}), so this @crap-allow comment could mean any of them. Put the function it's for on a line of its own.`,
      });
      continue;
    }

    const [fn] = candidates;
    if (allowed.has(fn)) {
      problems.push({ ...at, message: `${fn.name} already has a @crap-allow comment.` });
      continue;
    }
    const reason = (match[3] ?? '').trim();
    if (!reason) {
      problems.push({ ...at, message: `The @crap-allow comment for ${fn.name} gives no reason.` });
    }
    allowed.set(fn, {
      file,
      line,
      lastLine: parsed.position(comment.end).line,
      crap: Number(match[1]),
      complexity: Number(match[2]),
      reason,
    });
  }
  return { allowed, problems };
}
