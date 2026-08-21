import '@/lib/subjects';
import { isConfigured } from '@/lib/core/env';
import { listSubjects } from '@/lib/core/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lets the UI show a precise setup message instead of a generic failure. */
export async function GET() {
  const configured = isConfigured();
  return Response.json({
    ok: configured,
    configured,
    message: configured
      ? 'Server is configured and ready.'
      : 'ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local, add your key, then restart the dev server.',
    subjects: listSubjects().map((s) => ({ id: s.id, name: s.name, status: s.status })),
    time: new Date().toISOString(),
  });
}
