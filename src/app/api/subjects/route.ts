import '@/lib/subjects';
import { describePlatform } from '@/lib/core/registry';

export const runtime = 'nodejs';

/**
 * The UI renders subjects, modes, and suggestions from this payload, so adding
 * a subject module makes it appear in the interface with no frontend changes.
 */
export async function GET() {
  return Response.json(describePlatform());
}
