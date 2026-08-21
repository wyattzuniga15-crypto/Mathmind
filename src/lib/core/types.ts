/**
 * Shared types for the tutoring platform.
 *
 * Nothing in this file is math-specific. Adding `subjects/science` means
 * implementing SubjectModule and registering it — no changes here.
 */

export type StudentLevel =
  | 'elementary'
  | 'middle'
  | 'high'
  | 'college'
  | 'auto';

export interface SubjectMode {
  id: string;
  label: string;
  description: string;
  /** Short blurb shown in the UI. */
  hint: string;
  /** Appended to the subject's base system prompt. */
  instructions: string;
  /** Icon key resolved by the frontend. */
  icon: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolExecutionContext {
  subjectId: string;
  mode: string;
  level: StudentLevel;
}

export interface ToolResultPayload {
  ok: boolean;
  /** Compact, model-readable result. */
  data?: unknown;
  error?: string;
  /** Optional structured payload the UI can render (graphs, tables). */
  display?: { type: string; payload: unknown };
}

export type ToolExecutor = (
  input: Record<string, unknown>,
  context: ToolExecutionContext,
) => Promise<ToolResultPayload> | ToolResultPayload;

export interface SubjectTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

export interface PromptContext {
  mode: string;
  level: StudentLevel;
  /** Rolling summary of earlier turns, when the conversation was trimmed. */
  memorySummary?: string;
  /** Facts the tutor should keep in mind (current problem, known weak spots). */
  sessionNotes?: string[];
  hasImages?: boolean;
}

export interface SubjectModule {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  accent: string;
  /** Modes available for this subject. */
  modes: SubjectMode[];
  defaultMode: string;
  /** Deterministic tools this subject exposes to the model. */
  tools: SubjectTool[];
  /** Builds the full system prompt for a request. */
  buildSystemPrompt: (context: PromptContext) => string;
  /** Example prompts for the empty state. */
  suggestions: { label: string; prompt: string; mode?: string }[];
  /** Subject is fully implemented and selectable. */
  status: 'available' | 'coming-soon';
}

export type ChatRole = 'user' | 'assistant';

export interface ImageAttachment {
  /** base64 payload without the data-url prefix */
  data: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  name?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  images?: ImageAttachment[];
  createdAt: number;
  /** Tool activity recorded for this assistant turn. */
  toolCalls?: ToolCallRecord[];
  error?: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: ToolResultPayload;
  durationMs?: number;
}

export interface Conversation {
  id: string;
  subjectId: string;
  title: string;
  messages: ChatMessage[];
  mode: string;
  level: StudentLevel;
  createdAt: number;
  updatedAt: number;
  /** Rolling summary produced when the transcript is trimmed. */
  memorySummary?: string;
}

/* ----------------------------- stream events ---------------------------- */

export type StreamEvent =
  | { type: 'start'; messageId: string; model: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: ToolResultPayload; durationMs: number }
  | { type: 'thinking'; delta: string }
  | {
      type: 'done';
      usage: { inputTokens: number; outputTokens: number };
      stopReason: string | null;
      toolCalls: ToolCallRecord[];
    }
  | { type: 'error'; message: string; code: string; retryable: boolean };
