'use client';

import { useState, useRef, useEffect } from 'react';
import { MinutesDisplay } from '@/components/minutes-display';
import { useMinutesGeneration } from '@/hooks/use-minutes-generation';

interface TranscribeMeta {
  fileName: string;
  fileSize: string;
  mimeType: string;
  audioDuration: string | null;
  processingTime: string;
  whisperModel: string;
  language: string;
  speedRatio: string | null;
}

interface FileResult {
  fileName: string;
  transcript: string;
  meta: TranscribeMeta | null;
  status: 'pending' | 'transcribing' | 'done' | 'error';
  error?: string;
}

export default function MinutesPage() {
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcribeTimeMs, setTranscribeTimeMs] = useState(0);
  const [editableTranscript, setEditableTranscript] = useState('');
  const { minutesText, progress: minutesProgress, timing: minutesTiming, minutesError, generateMinutes, resetMinutes } = useMinutesGeneration();
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [minutesText, minutesProgress]);

  // Combine all transcripts when file results change
  useEffect(() => {
    const combined = fileResults
      .filter((f) => f.status === 'done' && f.transcript)
      .map((f) => f.transcript)
      .join('\n\n');
    setEditableTranscript(combined);
  }, [fileResults]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Sort files by name for consistent ordering
    const sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));

    // Initialize file results
    const initialResults: FileResult[] = sortedFiles.map((f) => ({
      fileName: f.name,
      transcript: '',
      meta: null,
      status: 'pending',
    }));
    setFileResults(initialResults);
    setTranscribing(true);
    setTranscribeError(null);
    setTranscribeTimeMs(0);
    resetMinutes();

    const transcribeStart = Date.now();

    // Transcribe files sequentially (whisper processes one at a time)
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];

      setFileResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: 'transcribing' } : r)),
      );

      try {
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('language', 'ja');

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Transcription failed');
        }

        setFileResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, transcript: data.transcript, meta: data.meta ?? null, status: 'done' }
              : r,
          ),
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Transcription failed';
        setFileResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', error: errorMsg } : r,
          ),
        );
      }
    }

    setTranscribeTimeMs(Date.now() - transcribeStart);
    setTranscribing(false);

    // Reset file input so the same files can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editableTranscript.trim()) return;
    await generateMinutes(editableTranscript);
  };

  const clearAll = () => {
    setFileResults([]);
    setEditableTranscript('');
    setTranscribeTimeMs(0);
    resetMinutes();
    setTranscribeError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}秒`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}分${rem}秒` : `${m}分`;
  };

  const completedCount = fileResults.filter((f) => f.status === 'done').length;
  const totalCount = fileResults.length;
  const currentlyTranscribing = fileResults.find((f) => f.status === 'transcribing');
  const isGenerating = minutesProgress.phase === 'extracting' || minutesProgress.phase === 'generating';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              議事録作成 — 音声ファイルから議事録を自動生成
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              whisper.cpp で文字起こし → Gemma 4 で議事録生成（複数ファイル対応）
            </p>
          </div>
          {(fileResults.length > 0 || minutesText) && (
            <button
              onClick={clearAll}
              disabled={transcribing || isGenerating}
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              リセット
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {fileResults.length === 0 && !minutesText && (
          <div className="mt-8 text-center">
            <p className="text-zinc-400 dark:text-zinc-500">
              音声ファイルをアップロードして議事録を作成します
            </p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              対応形式: wav, mp3, ogg, flac — 複数ファイル選択可
            </p>
          </div>
        )}

        {/* Minutes output */}
        <MinutesDisplay text={minutesText} progress={minutesProgress} timing={minutesTiming} error={minutesError} />
      </div>

      {transcribeError && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          文字起こしエラー: {transcribeError}
        </div>
      )}

      {/* Transcription progress */}
      {transcribing && (
        <div className="mx-4 mb-2 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-sm text-blue-700 dark:text-blue-400">
              文字起こし中... ({completedCount}/{totalCount} ファイル完了)
            </span>
          </div>
          {currentlyTranscribing && (
            <p className="mt-1 text-xs text-blue-500 dark:text-blue-500">
              処理中: {currentlyTranscribing.fileName}
            </p>
          )}
        </div>
      )}

      {/* File list with status */}
      {fileResults.length > 0 && (
        <div className="mx-4 mb-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              ファイル一覧 ({completedCount}/{totalCount} 完了)
              {transcribeTimeMs > 0 && !transcribing && (
                <span className="ml-2 text-zinc-400">— 文字起こし合計: {formatDuration(transcribeTimeMs)}</span>
              )}
            </span>
            <button
              onClick={clearAll}
              disabled={transcribing || isGenerating}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              すべてクリア
            </button>
          </div>
          <div className="max-h-24 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            {fileResults.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-zinc-100 px-3 py-1.5 text-xs last:border-b-0 dark:border-zinc-800"
              >
                <span className="shrink-0">
                  {f.status === 'done' && '✅'}
                  {f.status === 'transcribing' && (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                  )}
                  {f.status === 'pending' && '⏳'}
                  {f.status === 'error' && '❌'}
                </span>
                <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
                  {f.fileName}
                </span>
                {f.meta?.audioDuration && (
                  <span className="shrink-0 text-zinc-400">{f.meta.audioDuration}</span>
                )}
                {f.meta?.processingTime && (
                  <span className="shrink-0 text-zinc-400">({f.meta.processingTime})</span>
                )}
                {f.error && <span className="text-red-500">{f.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Combined transcript editor */}
      {editableTranscript && !transcribing && (
        <div className="mx-4 mb-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              結合済み文字起こし ({editableTranscript.length} 文字)
            </span>
          </div>
          <textarea
            value={editableTranscript}
            onChange={(e) => setEditableTranscript(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      )}

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={transcribing || isGenerating}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            音声ファイル
          </button>
          <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
            <div className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
              {transcribing
                ? `文字起こし中... (${completedCount}/${totalCount})`
                : editableTranscript
                  ? `${totalCount} ファイル — 文字起こし完了 (${editableTranscript.length} 文字)`
                  : '音声ファイルをアップロードしてください（複数選択可）'}
            </div>
            <button
              type="submit"
              disabled={!editableTranscript.trim() || transcribing || isGenerating}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              議事録生成
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
