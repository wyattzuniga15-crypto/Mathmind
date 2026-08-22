import { test } from 'node:test';
import assert from 'node:assert/strict';

import { conversationToMarkdown } from '../src/lib/client/markdown-export';
import type { Conversation } from '../src/lib/core/types';

const base: Conversation = {
  id: 'conv_1',
  subjectId: 'math',
  title: 'Solving a linear equation',
  mode: 'solve',
  level: 'auto',
  createdAt: 0,
  updatedAt: 0,
  messages: [
    { id: 'm1', role: 'user', content: '2x + 5 = 15', createdAt: 0 },
    { id: 'm2', role: 'assistant', content: 'x = 5, verified by substitution.', createdAt: 0 },
  ],
};

test('conversation exports as readable markdown with the title as a heading', () => {
  const md = conversationToMarkdown(base);
  assert.match(md, /^# Solving a linear equation\n/);
  assert.match(md, /\*\*You:\*\*\n2x \+ 5 = 15/);
  assert.match(md, /\*\*Tutor:\*\*\nx = 5, verified by substitution\./);
});

test('an attached image is noted by count, never by its data', () => {
  const withImage: Conversation = {
    ...base,
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'What is this?',
        images: [{ data: 'AAAABBBBCCCC', mediaType: 'image/png' }],
        createdAt: 0,
      },
    ],
  };
  const md = conversationToMarkdown(withImage);
  assert.match(md, /\(1 image attached\)/);
  // The base64 payload is exactly what a pasted-elsewhere export should never
  // carry: it is meaningless outside the app and would bloat anything it is
  // pasted into.
  assert.ok(!md.includes('AAAABBBBCCCC'));
});

test('multiple images pluralise, and an image-only message needs no blank content line', () => {
  const md = conversationToMarkdown({
    ...base,
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: '',
        images: [
          { data: 'a', mediaType: 'image/png' },
          { data: 'b', mediaType: 'image/png' },
        ],
        createdAt: 0,
      },
    ],
  });
  assert.match(md, /\(2 images attached\)/);
});

test('an empty conversation still produces a valid, non-empty document', () => {
  const md = conversationToMarkdown({ ...base, messages: [] });
  assert.equal(md, '# Solving a linear equation\n');
});
