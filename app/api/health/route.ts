const LLAMA_BASE_URL =
  process.env.LLAMA_BASE_URL || 'http://localhost:8080/v1';

export async function GET() {
  try {
    const res = await fetch(`${LLAMA_BASE_URL}/models`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json(
        { status: 'error', message: `llama.cpp responded with ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    return Response.json({ status: 'ok', models: data.data ?? data });
  } catch {
    return Response.json(
      { status: 'error', message: 'llama.cpp server is not reachable' },
      { status: 503 },
    );
  }
}
