import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdown, parseInline, extractMath, type Block, type Inline } from '../src/lib/markdown/parser';

const text = (nodes: Inline[]): string =>
  nodes
    .map((n) =>
      n.type === 'text'
        ? n.value
        : n.type === 'math'
          ? `[math:${n.value}]`
          : n.type === 'code'
            ? `[code:${n.value}]`
            : 'children' in n
              ? text(n.children)
              : '',
    )
    .join('');

test('extracts math in every delimiter style', () => {
  assert.deepEqual(extractMath('$x^2$').spans, [{ value: 'x^2', display: false }]);
  assert.deepEqual(extractMath('$$x^2$$').spans, [{ value: 'x^2', display: true }]);
  assert.deepEqual(extractMath('\\(a+b\\)').spans, [{ value: 'a+b', display: false }]);
  assert.deepEqual(extractMath('\\[a+b\\]').spans, [{ value: 'a+b', display: true }]);
});

test('does not treat currency as math', () => {
  const { spans } = extractMath('It costs $5 and then $10 total');
  assert.equal(spans.length, 0);

  const escaped = extractMath('costs \\$5');
  assert.equal(escaped.spans.length, 0);
  assert.equal(escaped.text, 'costs $5');
});

test('math content is never mangled by markdown rules', () => {
  const nodes = parseInline('The value $a_1 * b_2$ and **bold**');
  assert.equal(text(nodes), 'The value [math:a_1 * b_2] and bold');
  const math = nodes.find((n) => n.type === 'math');
  assert.equal((math as { value: string }).value, 'a_1 * b_2');
});

test('display math becomes its own block', () => {
  const blocks = parseMarkdown('Solve it:\n\n$$2x = 10$$\n\nDone.');
  assert.deepEqual(blocks.map((b) => b.type), ['paragraph', 'mathBlock', 'paragraph']);
  assert.equal((blocks[1] as { value: string }).value, '2x = 10');
});

test('display math inline with prose is split out', () => {
  const blocks = parseMarkdown('First $$x=1$$ then more text');
  assert.deepEqual(blocks.map((b) => b.type), ['paragraph', 'mathBlock', 'paragraph']);
});

test('parses headings, hr, and blockquote', () => {
  const blocks = parseMarkdown('# Title\n\n---\n\n> quoted **text**');
  assert.equal(blocks[0].type, 'heading');
  assert.equal((blocks[0] as { depth: number }).depth, 1);
  assert.equal(blocks[1].type, 'hr');
  assert.equal(blocks[2].type, 'blockquote');
});

test('parses fenced code with language and leaves contents untouched', () => {
  const blocks = parseMarkdown('```python\nx = 1 * 2\nprint(f"${x}")\n```');
  const code = blocks[0] as Extract<Block, { type: 'code' }>;
  assert.equal(code.type, 'code');
  assert.equal(code.lang, 'python');
  assert.equal(code.value, 'x = 1 * 2\nprint(f"${x}")');
});

test('handles an unterminated code fence while streaming', () => {
  const blocks = parseMarkdown('```\nhalf a block');
  assert.equal(blocks[0].type, 'code');
  assert.equal((blocks[0] as { value: string }).value, 'half a block');
});

test('parses ordered and unordered lists including nesting', () => {
  const blocks = parseMarkdown('1. first\n2. second\n   - nested\n   - items\n3. third');
  const list = blocks[0] as Extract<Block, { type: 'list' }>;
  assert.equal(list.type, 'list');
  assert.equal(list.ordered, true);
  assert.equal(list.items.length, 3);
  const nested = list.items[1].find((b) => b.type === 'list') as Extract<Block, { type: 'list' }>;
  assert.ok(nested, 'second item should contain a nested list');
  assert.equal(nested.items.length, 2);
});

test('list items keep math intact', () => {
  const blocks = parseMarkdown('- Subtract 5: $2x = 10$\n- Divide by 2: $x = 5$');
  const list = blocks[0] as Extract<Block, { type: 'list' }>;
  assert.equal(list.items.length, 2);
  const first = list.items[0][0] as Extract<Block, { type: 'paragraph' }>;
  assert.equal(text(first.children), 'Subtract 5: [math:2x = 10]');
});

test('parses gfm tables with alignment', () => {
  const blocks = parseMarkdown('| a | b |\n| :- | --: |\n| 1 | 2 |\n| 3 | 4 |');
  const table = blocks[0] as Extract<Block, { type: 'table' }>;
  assert.equal(table.type, 'table');
  assert.equal(table.header.length, 2);
  assert.deepEqual(table.align, ['left', 'right']);
  assert.equal(table.rows.length, 2);
});

test('parses emphasis, links, strikethrough, and inline code', () => {
  assert.equal(text(parseInline('**bold** and *em* and ~~gone~~')), 'bold and em and gone');
  const link = parseInline('[docs](https://example.com)')[0] as Extract<Inline, { type: 'link' }>;
  assert.equal(link.type, 'link');
  assert.equal(link.href, 'https://example.com');
  assert.equal(text(parseInline('use `npm test` now')), 'use [code:npm test] now');
});

test('underscores inside words do not become emphasis', () => {
  assert.equal(text(parseInline('snake_case_name')), 'snake_case_name');
});

test('empty and whitespace input produce no blocks', () => {
  assert.deepEqual(parseMarkdown(''), []);
  assert.deepEqual(parseMarkdown('   \n\n  '), []);
});

test('parses a realistic tutor response end to end', () => {
  const source = [
    '## Solving $2x + 5 = 15$',
    '',
    'Subtract 5 from both sides:',
    '',
    '$$2x = 10$$',
    '',
    'Then divide by 2:',
    '',
    '1. $x = \\frac{10}{2}$',
    '2. So $x = 5$',
    '',
    '**Check:** $2(5) + 5 = 15$ ✓',
  ].join('\n');
  const blocks = parseMarkdown(source);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['heading', 'paragraph', 'mathBlock', 'paragraph', 'list', 'paragraph'],
  );
});
