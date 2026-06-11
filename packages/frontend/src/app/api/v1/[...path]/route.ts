import { NextRequest, NextResponse } from 'next/server';

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/$/, '');

const SKIP_HEADERS = new Set(['host', 'connection', 'transfer-encoding', 'content-length']);

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const url = `${BACKEND}/api/v1/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  try {
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody ? await req.arrayBuffer() : undefined;

    const upstream = await fetch(url, { method: req.method, headers, body });

    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    const data = await upstream.arrayBuffer();

    return new NextResponse(data, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (e: any) {
    const code = e?.cause?.code ?? e?.code ?? 'UNKNOWN';
    const msg = code === 'ECONNREFUSED'
      ? `Backend offline — ECONNREFUSED conectando em ${BACKEND}`
      : `Proxy error (${code}): ${e.message ?? String(e)}`;

    console.error('[api-proxy] ERRO:', msg, '| url:', url);

    return NextResponse.json(
      { statusCode: 502, message: msg },
      { status: 502 },
    );
  }
}

type Ctx = { params: { path: string[] } | Promise<{ path: string[] }> };

async function resolve(ctx: Ctx) {
  const p = await ctx.params;
  return p.path;
}

export async function GET(req: NextRequest, ctx: Ctx) { return proxy(req, await resolve(ctx)); }
export async function POST(req: NextRequest, ctx: Ctx) { return proxy(req, await resolve(ctx)); }
export async function PUT(req: NextRequest, ctx: Ctx) { return proxy(req, await resolve(ctx)); }
export async function PATCH(req: NextRequest, ctx: Ctx) { return proxy(req, await resolve(ctx)); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return proxy(req, await resolve(ctx)); }
