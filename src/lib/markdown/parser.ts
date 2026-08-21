/**
 * Markdown parser producing a small AST.
 *
 * Purpose-built for tutoring output: headings, lists, tables, code, blockquote,
 * emphasis, links, and — the part that matters here — math spans in every
 * delimiter style a model actually emits ($…$, $$…$$, \(…\), \[…\]).
 *
 * Zero dependencies and pure, so it is unit tested directly.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'del'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'math'; value: string; display: false };

/**
 * Column alignment in a GFM table.
 *
 * A literal union rather than `string`: these values are written straight into
 * a CSS `text-align`, whose React/csstype signature only accepts keywords. A
 * widened `string` here becomes a type error at the point of use.
 * `null` means the column had no alignment marker.
 */
export type TableAlign = 'left' | 'center' | 'right';

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'heading'; depth: number; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'code'; lang: string | null; value: string }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'table'; header: Inline[][]; align: (TableAlign | null)[]; rows: Inline[][][] }
  | { type: 'mathBlock'; value: string }
  | { type: 'hr' };

/* --------------------------------- inline -------------------------------- */

interface MathSpan {
  value: string;
  display: boolean;
}

/**
 * Pulls math spans out first and replaces them with placeholders, so markdown
 * rules never touch LaTeX. Without this, `x_1` and `a*b` inside math get
 * mangled into subscript/emphasis markup.
 */
export function extractMath(input: string): { text: string; spans: MathSpan[] } {
  const spans: MathSpan[] = [];
  let out = '';
  let i = 0;

  const push = (value: string, display: boolean) => {
    spans.push({ value, display });
    out += `\u0000M${spans.length - 1}\u0000`;
  };

  while (i < input.length) {
    const c = input[i];

    // escaped dollar stays literal
    if (c === '\\' && input[i + 1] === '$') {
      out += '$';
      i += 2;
      continue;
    }

    if (c === '\\' && (input[i + 1] === '[' || input[i + 1] === '(')) {
      const display = input[i + 1] === '[';
      const close = display ? '\\]' : '\\)';
      const end = input.indexOf(close, i + 2);
      if (end !== -1) {
        push(input.slice(i + 2, end).trim(), display);
        i = end + 2;
        continue;
      }
    }

    if (c === '$') {
      const display = input[i + 1] === '$';
      const delim = display ? '$$' : '$';
      const start = i + delim.length;
      const end = input.indexOf(delim, start);
      // A lone `$` (or `$5.00`) is not math: only close if a delimiter is found
      // and, for inline math, the content is on one line and non-empty.
      if (end !== -1) {
        const body = input.slice(start, end);
        // Inline math must hug its delimiters: "$x^2$" is math, but
        // "$5 and then $10" is two prices, not a formula.
        const hugs = body.length > 0 && !/^\s/.test(body) && !/\s$/.test(body);
        const valid = display || (hugs && !body.includes('\n'));
        if (valid) {
          push(body.trim(), display);
          i = end + delim.length;
          continue;
        }
      }
    }

    out += c;
    i++;
  }

  return { text: out, spans };
}

function restoreMath(text: string, spans: MathSpan[]): Inline[] {
  const parts = text.split(/\u0000M(\d+)\u0000/);
  const out: Inline[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const span = spans[Number(parts[i])];
      if (span) out.push({ type: 'math', value: span.value, display: false });
    } else if (parts[i]) {
      out.push({ type: 'text', value: parts[i] });
    }
  }
  return out;
}

/** Parses emphasis, code, links; math is already stashed as placeholders. */
function parseInlineText(input: string, spans: MathSpan[]): Inline[] {
  const out: Inline[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      out.push(...restoreMath(buffer, spans));
      buffer = '';
    }
  };

  let i = 0;
  while (i < input.length) {
    const rest = input.slice(i);

    if (input[i] === '\\' && i + 1 < input.length && /[\\`*_{}[\]()#+\-.!]/.test(input[i + 1])) {
      buffer += input[i + 1];
      i += 2;
      continue;
    }

    // inline code
    if (input[i] === '`') {
      const fence = /^`+/.exec(rest)![0];
      const end = input.indexOf(fence, i + fence.length);
      if (end !== -1) {
        flush();
        out.push({ type: 'code', value: input.slice(i + fence.length, end).trim() });
        i = end + fence.length;
        continue;
      }
    }

    // link
    const link = /^\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest);
    if (link) {
      flush();
      out.push({ type: 'link', href: link[2], children: parseInlineText(link[1], spans) });
      i += link[0].length;
      continue;
    }

    // strong / em / strikethrough
    const strong = /^(\*\*|__)([\s\S]+?)\1/.exec(rest);
    if (strong) {
      flush();
      out.push({ type: 'strong', children: parseInlineText(strong[2], spans) });
      i += strong[0].length;
      continue;
    }
    const del = /^~~([\s\S]+?)~~/.exec(rest);
    if (del) {
      flush();
      out.push({ type: 'del', children: parseInlineText(del[1], spans) });
      i += del[0].length;
      continue;
    }
    const em = /^(\*|_)(?!\s)([\s\S]+?)(?<!\s)\1/.exec(rest);
    if (em) {
      // `_` only opens emphasis at a word boundary, so identifiers such as
      // snake_case_name and LaTeX subscripts survive intact.
      const prev = i > 0 ? input[i - 1] : '';
      const next = input[i + em[0].length] ?? '';
      const wordChar = /[A-Za-z0-9]/;
      const ok = em[1] === '*' || (!wordChar.test(prev) && !wordChar.test(next));
      if (ok) {
        flush();
        out.push({ type: 'em', children: parseInlineText(em[2], spans) });
        i += em[0].length;
        continue;
      }
    }

    buffer += input[i];
    i++;
  }

  flush();
  return out;
}

export function parseInline(input: string): Inline[] {
  const { text, spans } = extractMath(input);
  return parseInlineText(text, spans);
}

/* --------------------------------- blocks -------------------------------- */

const isHr = (line: string) => /^ {0,3}([-*_])\s*(\1\s*){2,}$/.test(line);
const bulletRe = /^(\s*)([-*+])\s+(.*)$/;
const orderedRe = /^(\s*)(\d+)[.)]\s+(.*)$/;

/** Reads one cell of a GFM delimiter row, e.g. `:-`, `--:`, `:-:`. */
export function parseAlignment(cell: string): TableAlign | null {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

export function parseMarkdown(input: string): Block[] {
  // Display math is extracted at block level so $$…$$ becomes its own block
  // even when the model puts it inline with surrounding prose.
  const source = String(input ?? '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  const takeParagraph = (buffer: string[]) => {
    const text = buffer.join('\n').trim();
    if (!text) return;
    const { text: stripped, spans } = extractMath(text);
    // A paragraph that is nothing but one display-math span becomes a math block.
    const only = /^\u0000M(\d+)\u0000$/.exec(stripped.trim());
    if (only && spans[Number(only[1])]?.display) {
      blocks.push({ type: 'mathBlock', value: spans[Number(only[1])].value });
      return;
    }
    // Split mixed content so display math still renders on its own line.
    const parts = stripped.split(/\u0000M(\d+)\u0000/);
    let pending = '';
    const flushPending = () => {
      if (pending.trim()) blocks.push({ type: 'paragraph', children: parseInlineText(pending, spans) });
      pending = '';
    };
    for (let p = 0; p < parts.length; p++) {
      if (p % 2 === 1) {
        const span = spans[Number(parts[p])];
        if (span?.display) {
          flushPending();
          blocks.push({ type: 'mathBlock', value: span.value });
        } else {
          pending += `\u0000M${parts[p]}\u0000`;
        }
      } else {
        pending += parts[p];
      }
    }
    flushPending();
  };

  let paragraph: string[] = [];
  const flushParagraph = () => {
    takeParagraph(paragraph);
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = /^ {0,3}(```+|~~~+)\s*([^\s`]*)/.exec(line);
    if (fence) {
      flushParagraph();
      const marker = fence[1][0].repeat(3);
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${marker.replace(/[`~]/g, '\\$&')}+\\s*$`).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence (or EOF while streaming)
      blocks.push({ type: 'code', lang: fence[2] || null, value: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      i++;
      continue;
    }

    if (isHr(line)) {
      flushParagraph();
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    const heading = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', depth: heading[1].length, children: parseInline(heading[2]) });
      i++;
      continue;
    }

    // blockquote
    if (/^ {0,3}>/.test(line)) {
      flushParagraph();
      const body: string[] = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
        body.push(lines[i].replace(/^ {0,3}>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', children: parseMarkdown(body.join('\n')) });
      continue;
    }

    // table (GFM)
    if (line.includes('|') && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      flushParagraph();
      const splitRow = (row: string) =>
        row
          .replace(/^\s*\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((c) => c.trim());
      const header = splitRow(line).map(parseInline);
      const align = splitRow(lines[i + 1]).map(parseAlignment);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ type: 'table', header, align, rows });
      continue;
    }

    // lists
    const bullet = bulletRe.exec(line);
    const ordered = orderedRe.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      const start = ordered ? Number(ordered[2]) : 1;
      const baseIndent = (bullet ?? ordered)![1].length;
      const items: Block[][] = [];
      let current: string[] = [];

      const pushItem = () => {
        if (current.length) items.push(parseMarkdown(current.join('\n')));
        current = [];
      };

      while (i < lines.length) {
        const l = lines[i];
        const b = bulletRe.exec(l);
        const o = orderedRe.exec(l);
        const marker = b ?? o;

        if (marker && marker[1].length <= baseIndent) {
          // a different list type at the same level ends this list
          if (Boolean(o) !== isOrdered) break;
          pushItem();
          current.push(marker[3]);
          i++;
          continue;
        }
        if (!l.trim()) {
          // blank line: keep going only if the list continues
          const next = lines[i + 1] ?? '';
          if (bulletRe.test(next) || orderedRe.test(next) || /^\s{2,}\S/.test(next)) {
            current.push('');
            i++;
            continue;
          }
          break;
        }
        if (/^\s{2,}/.test(l) || marker) {
          current.push(l.replace(new RegExp(`^\\s{0,${baseIndent + 2}}`), ''));
          i++;
          continue;
        }
        // lazy continuation of the current item
        current.push(l);
        i++;
      }
      pushItem();
      blocks.push({ type: 'list', ordered: isOrdered, start, items });
      continue;
    }

    paragraph.push(line);
    i++;
  }

  flushParagraph();
  return blocks;
}
