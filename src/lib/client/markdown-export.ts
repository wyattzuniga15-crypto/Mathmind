import type { Conversation } from '../core/types';

/**
 * Renders a conversation as plain Markdown for pasting into notes, a
 * homework doc, or anywhere else that isn't this app. Complements the
 * PDF export (window.print()): PDF is for a page that looks like the app,
 * this is for text someone wants to edit or drop into something else.
 */
export function conversationToMarkdown(conversation: Conversation): string {
  const lines: string[] = [`# ${conversation.title}`, ''];

  for (const message of conversation.messages) {
    lines.push(message.role === 'user' ? '**You:**' : '**Assistant:**');
    if (message.images?.length) {
      lines.push(`_(${message.images.length} image${message.images.length === 1 ? '' : 's'} attached)_`);
    }
    if (message.content.trim()) {
      lines.push(message.content.trim());
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
