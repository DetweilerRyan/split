// Reads the `@crap-allow` comments in a parsed file and matches each to the function it's above.
import type { Comment, Fn, Parsed } from './functions.ts';

export type Finding = { readonly file: string; readonly line: number; readonly message: string };
export type Allow = {
  readonly file: string;
  /** The comment's first and last lines. */
  readonly line: number;
  readonly lastLine: number;
  readonly crap: number;
  readonly complexity: number;
  readonly reason: string;
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
function withoutComments(source: string, comments: readonly Comment[]) {
  // Stryker disable next-line StringLiteral: text before line 1 only shifts what `targetLine` reads after a comment on line 1 further left, into the comment's own blanks, since a @crap-allow comment FORMAT accepts is over 30 characters long.
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
function targetLine(code: readonly string[], comment: Comment, parsed: Parsed) {
  const end = parsed.position(comment.end);
  // The rest of the comment's own line, then each line after it.
  const offset = code.slice(end.line - 1).findIndex((text, index) => {
    if (index === 0) {
      const rest = text.slice(end.column).trim();
      return rest !== '' && rest !== '}';
    }
    // A JSX comment, {/* … */}, leaves its braces behind once the comment is blanked.
    const bare = text.replace(/\s/g, '');
    return bare !== '' && bare !== '{}';
  });
  return offset === -1 ? undefined : end.line + offset;
}

/** The outermost of `functions`: those not nested in another of them. */
function outermost<F extends Fn>(functions: readonly F[]) {
  return functions.filter((fn) => !functions.some((other) => fn.parents.includes(other)));
}

/**
 * The functions a comment above `line` could mean: those starting on it, outermost first. Failing
 * that, the outermost functions passed straight to a call in the simple statement starting on it,
 * so a call a formatter wrapped, with its callback on the line below, still counts.
 */
function functionsAt<F extends Fn>(line: number | undefined, parsed: Parsed, among: readonly F[]) {
  const starting = outermost(among.filter((fn) => fn.start.line === line));
  if (starting.length > 0) return { candidates: starting, where: `start on line ${line}` };
  // Statements are listed outermost first, so this is the widest one starting on the line.
  const statement = parsed.statements.find((s) => parsed.position(s.start).line === line);
  const inside =
    statement !== undefined
      ? among.filter((fn) => fn.offset.start >= statement.start && fn.offset.end <= statement.end)
      : [];
  const callbacks = outermost(inside).filter((fn) => fn.passedToCall);
  return { candidates: callbacks, where: `are passed to calls in the statement on line ${line}` };
}

/** The one function a comment is for, or the problem that stops it being matched to one. */
function functionFor(
  comment: Comment,
  code: readonly string[],
  parsed: Parsed,
): { readonly fn: Fn } | { readonly problem: string } {
  const target = targetLine(code, comment, parsed);
  const { candidates, where } = functionsAt(target, parsed, parsed.functions);
  const [inner] =
    candidates.length === 0 ? functionsAt(target, parsed, parsed.nested).candidates : [];
  if (inner !== undefined) {
    const [outer] = inner.parents;
    return {
      problem: `This @crap-allow comment is above ${inner.name}, which is inside ${outer.name} and counts towards it. Move the comment above ${outer.name}, with its numbers.`,
    };
  }
  const [fn] = candidates;
  if (fn === undefined) {
    return {
      problem:
        'This @crap-allow comment isn’t directly above a function. Move it there, or delete it.',
    };
  }
  if (candidates.length > 1) {
    return {
      problem: `${candidates.length} functions ${where} (${candidates.map((fn) => fn.name).join(', ')}), so this @crap-allow comment could mean any of them. Put the function it's for on a line of its own.`,
    };
  }
  return { fn };
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
    if (match === null) {
      problems.push({ ...at, message: `This @crap-allow comment isn’t in the form ${FORM}.` });
      continue;
    }
    const found = functionFor(comment, code, parsed);
    if ('problem' in found) {
      problems.push({ ...at, message: found.problem });
      continue;
    }
    const { fn } = found;
    if (allowed.has(fn)) {
      problems.push({ ...at, message: `${fn.name} already has a @crap-allow comment.` });
      continue;
    }
    const reason = match[3] ?? '';
    if (reason === '') {
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
