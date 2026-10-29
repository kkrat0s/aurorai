import { createAgentPostHandler } from '@aurorasense/coordinator/server';

export const runtime='nodejs';
export const maxDuration=180;

export async function POST(request:Request) {
  return createAgentPostHandler({
    supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secretKey:process.env.SUPABASE_SECRET_KEY,
    metaKey:process.env.META_MODEL_API_KEY,
  })(request);
}
