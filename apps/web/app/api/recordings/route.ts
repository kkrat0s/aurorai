import { NextResponse } from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Public filesystem ingestion bypassed Auth/RLS, exposed participant metadata and
// equated sessions with independent sites. Keep exports local until managed ingest exists.
function unavailable(){return NextResponse.json({success:false,code:'PRIVATE_INGESTION_NOT_CONFIGURED',error:'Private authenticated upload and deletion are not configured. Use local JSON export; no recording was uploaded.'},{status:503,headers:{'Cache-Control':'no-store'}});}
export async function GET(){return unavailable();}
export async function POST(){return unavailable();}
