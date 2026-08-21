/**
 * Browser entry point used by the local harness (scripts/dev-harness.mjs).
 *
 * Next.js normally does this mounting for us. This file exists so the exact
 * same component tree can be bundled and run in a real browser for end-to-end
 * testing without a Next.js install. It is not used by `next build`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatApp } from '../components/ChatApp';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from the page');

createRoot(container).render(
  <StrictMode>
    <ChatApp />
  </StrictMode>,
);
