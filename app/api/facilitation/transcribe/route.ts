import { writeFile, unlink, mkdir } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { appendTranscript, getSession } from '@/lib/session-store';

const execFileAsync = promisify(execFile);

const WHISPER_CLI = process.env.WHISPER_CLI || '/opt/homebrew/bin/whisper-cli';
const WHISPER_MODEL =
  process.env.WHISPER_MODEL ||
  join(
    process.env.HOME || '/Users',
    '.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin',
  );

// Per-session sequential processing queue
const processingLocks = new Map<string, Promise<unknown>>();

export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get('audio') as File | null;
  const sessionId = (formData.get('sessionId') as string) || randomUUID();
  const language = (formData.get('language') as string) || 'ja';

  if (!audio) {
    return Response.json({ error: 'No audio provided' }, { status: 400 });
  }

  // Chain onto previous chunk processing for this session
  const prevLock = processingLocks.get(sessionId) ?? Promise.resolve();
  const resultPromise = prevLock.then(() =>
    processChunk(audio, sessionId, language),
  );
  processingLocks.set(sessionId, resultPromise.catch(() => {}));

  try {
    const result = await resultPromise;
    return Response.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Transcription failed';
    return Response.json({ error: message }, { status: 500 });
  }
}

async function processChunk(
  audio: File,
  sessionId: string,
  language: string,
) {
  const tmpDir = join('/tmp', 'whisper-facilitation');
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `${sessionId}-${randomUUID()}.wav`);

  try {
    const buffer = Buffer.from(await audio.arrayBuffer());
    await writeFile(tmpPath, buffer);

    const startTime = performance.now();

    const { stdout } = await execFileAsync(
      WHISPER_CLI,
      ['-m', WHISPER_MODEL, '-l', language, '-np', '--no-timestamps', '-f', tmpPath],
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
    );

    const elapsedMs = performance.now() - startTime;
    const chunkText = stdout.trim();

    const session = appendTranscript(sessionId, chunkText ? chunkText + '\n' : '');

    return {
      chunkText,
      fullTranscript: session.transcript,
      chunkIndex: session.chunks,
      processingTimeMs: Math.round(elapsedMs),
      sessionId,
    };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
