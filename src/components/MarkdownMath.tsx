'use client';

import { memo, useMemo } from 'react';
import katex from 'katex';
import { parseMarkdown, type Block, type Inline } from '@/lib/markdown/parser';
import { CopyButton } from './CopyButton';

/**
 * Renders tutor output: markdown structure plus KaTeX math.
 *
 * KaTeX is called directly rather than through a remark/rehype pipeline —
 * fewer moving parts, and a malformed expression degrades to readable source
 * text instead of throwing during a stream.
 */

function renderMath(value: string, displayMode: boolean): { html: string; failed: boolean } {
  try {
    return {
      html: katex.renderToString(value, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: false,
        output: 'html',
        errorColor: 'currentColor',
      }),
      failed: false,
    };
  } catch {
    return { html: '', failed: true };
  }
}

function MathSpan({ value, display }: { value: string; display: boolean }) {
  const { html, failed } = useMemo(() => renderMath(value, display), [value, display]);
  if (failed) return <code className="katex-error">{value}</code>;
  return display ? (
    <div className="katex-display-wrapper" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return <span key={i}>{node.value}</span>;
          case 'strong':
            return <strong key={i}><Inlines nodes={node.children} /></strong>;
          case 'em':
            return <em key={i}><Inlines nodes={node.children} /></em>;
          case 'del':
            return <del key={i}><Inlines nodes={node.children} /></del>;
          case 'code':
            return <code key={i}>{node.value}</code>;
          case 'link':
            return (
              <a key={i} href={node.href} target="_blank" rel="noopener noreferrer">
                <Inlines nodes={node.children} />
              </a>
            );
          case 'math':
            return <MathSpan key={i} value={node.value} display={false} />;
          default:
            return null;
        }
      })}
    </>
  );
}

function CodeBlock({ lang, value }: { lang: string | null; value: string }) {
  return (
    <div className="group relative my-3">
      <div className="flex items-center justify-between rounded-t-[10px] border border-b-0 border-line bg-surface-sunken px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          {lang ?? 'text'}
        </span>
        <CopyButton value={value} label="Copy code" subtle />
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={i}><Inlines nodes={block.children} /></p>;
          case 'heading': {
            const Tag = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const)[Math.min(block.depth, 6) - 1];
            return <Tag key={i}><Inlines nodes={block.children} /></Tag>;
          }
          case 'mathBlock':
            return <MathSpan key={i} value={block.value} display />;
          case 'code':
            return <CodeBlock key={i} lang={block.lang} value={block.value} />;
          case 'hr':
            return <hr key={i} />;
          case 'blockquote':
            return <blockquote key={i}><Blocks blocks={block.children} /></blockquote>;
          case 'list': {
            const items = block.items.map((item, j) => (
              <li key={j}><Blocks blocks={item} /></li>
            ));
            return block.ordered ? <ol key={i} start={block.start}>{items}</ol> : <ul key={i}>{items}</ul>;
          }
          case 'table':
            return (
              <div key={i} className="my-3 overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, j) => (
                        <th key={j} style={{ textAlign: block.align[j] ?? undefined }}>
                          <Inlines nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} style={{ textAlign: block.align[c] ?? undefined }}>
                            <Inlines nodes={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

export const MarkdownMath = memo(function MarkdownMath({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const blocks = useMemo(() => {
    try {
      return parseMarkdown(content);
    } catch {
      // Never let a parse failure blank the tutor's answer mid-stream.
      return [{ type: 'paragraph' as const, children: [{ type: 'text' as const, value: content }] }];
    }
  }, [content]);

  return (
    <div className={`prose-tutor ${streaming ? 'streaming-caret' : ''}`}>
      <Blocks blocks={blocks} />
    </div>
  );
});
