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
      : 'GROQ_API_KEY is not set. Add it in Vercel under Settings -> Environment Variables, then redeploy.',
    subjects: listSubjects().map((s) => ({ id: s.id, name: s.name, status: s.status })),
    time: new Date().toISOString(),
  });
}
