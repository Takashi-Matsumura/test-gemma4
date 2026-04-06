import { writeFile, unlink, mkdir, stat } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

const WHISPER_CLI = process.env.WHISPER_CLI || '/opt/homebrew/bin/whisper-cli';
const WHISPER_MODEL =
  process.env.WHISPER_MODEL ||
  join(
    process.env.HOME || '/Users',
    '.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin',
  );

function parseAudioDuration(stderr: string): number | null {
  // whisper-cli outputs: "whisper_full: ... audio_duration = 42.56 s"
  const match = stderr.match(/audio_duration\s*=\s*([\d.]+)\s*s/);
  return match ? parseFloat(match[1]) : null;
}

function parseWhisperModel(stderr: string): string | null {
  const match = stderr.match(/model type\s*=\s*(.+)/);
  return match ? match[1].trim() : null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('audio') as File | null;
  const language = (formData.get('language') as string) || 'ja';

  if (!file) {
    return Response.json({ error: 'No audio file provided' }, { status: 400 });
  }

  const tmpDir = join('/tmp', 'whisper-uploads');
  await mkdir(tmpDir, { recursive: true });

  const tmpPath = join(tmpDir, `${randomUUID()}-${file.name}`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tmpPath, buffer);

    const fileStats = await stat(tmpPath);
    const startTime = performance.now();

    const { stdout, stderr } = await execFileAsync(
      WHISPER_CLI,
      [
        '-m', WHISPER_MODEL,
        '-l', language,
        '-np',
        '--no-timestamps',
        '-f', tmpPath,
      ],
      { timeout: 600_000, maxBuffer: 50 * 1024 * 1024 },
    );

    const elapsedMs = performance.now() - startTime;
    const transcript = stdout.trim() || stderr.trim();
    const audioDuration = parseAudioDuration(stderr);
    const whisperModel = parseWhisperModel(stderr);

    return Response.json({
      transcript,
      meta: {
        fileName: file.name,
        fileSize: formatFileSize(fileStats.size),
        fileSizeBytes: fileStats.size,
        mimeType: file.type || 'unknown',
        audioDuration: audioDuration != null ? formatDuration(audioDuration) : null,
        audioDurationSec: audioDuration,
        processingTime: `${(elapsedMs / 1000).toFixed(1)}秒`,
        processingTimeSec: parseFloat((elapsedMs / 1000).toFixed(1)),
        whisperModel: whisperModel || 'large-v3-turbo-q5_0',
        language,
        speedRatio:
          audioDuration != null
            ? `${(audioDuration / (elapsedMs / 1000)).toFixed(1)}x`
            : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
