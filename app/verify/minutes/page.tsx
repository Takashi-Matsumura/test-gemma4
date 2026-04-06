'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';

export default function MinutesPage() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/minutes' }),
  });

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

  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [meta, setMeta] = useState<TranscribeMeta | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, status]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setTranscribing(true);
    setTranscribeError(null);
    setTranscript('');
    setMeta(null);

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

      setTranscript(data.transcript);
      if (data.meta) setMeta(data.meta);
    } catch (err) {
      setTranscribeError(
        err instanceof Error ? err.message : 'Transcription failed',
      );
    } finally {
      setTranscribing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'ready' || !transcript.trim()) return;

    const text = `以下は会議の音声文字起こしです。この内容から議事録を作成してください。\n\n---\n${transcript.trim()}\n---`;
    sendMessage({ text });
  };

  const lastMessage = messages.at(-1);
  const lastAssistantText =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join('')
      : '';
  const showIndicator =
    status === 'streaming' && lastAssistantText.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          議事録作成 — 音声ファイルから議事録を自動生成
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          whisper.cpp で文字起こし → Gemma 4 で議事録生成
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !transcript && !transcribing && (
          <div className="mt-8 text-center">
            <p className="text-zinc-400 dark:text-zinc-500">
              音声ファイルをアップロードして議事録を作成します
            </p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              対応形式: wav, mp3, ogg, flac
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white whitespace-pre-wrap'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              {message.role === 'user'
                ? message.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <span key={i}>
                        {part.text.length > 500
                          ? part.text.slice(0, 200) +
                            '\n...(省略)...\n' +
                            part.text.slice(-200)
                          : part.text}
                      </span>
                    ) : null,
                  )
                : message.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <MarkdownRenderer key={i} content={part.text} />
                    ) : null,
                  )}
            </div>
          </div>
        ))}
        {showIndicator && (
          <div className="flex justify-start">
            <StreamingIndicator status={status} />
          </div>
        )}
      </div>

      {transcribeError && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          文字起こしエラー: {transcribeError}
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          エラー: {error.message}
        </div>
      )}

      {transcribing && (
        <div className="mx-4 mb-2 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-sm text-blue-700 dark:text-blue-400">
              音声を文字起こし中... ({fileName})
            </span>
          </div>
          <p className="mt-1 text-xs text-blue-500 dark:text-blue-500">
            音声の長さによって数十秒〜数分かかる場合があります
          </p>
        </div>
      )}

      {meta && (
        <div className="mx-4 mb-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <span className="text-zinc-400">ファイル</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{meta.fileName}</p>
            </div>
            <div>
              <span className="text-zinc-400">サイズ</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{meta.fileSize}</p>
            </div>
            <div>
              <span className="text-zinc-400">音声の長さ</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{meta.audioDuration ?? '—'}</p>
            </div>
            <div>
              <span className="text-zinc-400">形式</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{meta.mimeType}</p>
            </div>
            <div>
              <span className="text-zinc-400">処理時間</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{meta.processingTime}</p>
            </div>
            <div>
              <span className="text-zinc-400">処理速度</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{meta.speedRatio ? `${meta.speedRatio} リアルタイム` : '—'}</p>
            </div>
            <div>
              <span className="text-zinc-400">Whisperモデル</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{meta.whisperModel}</p>
            </div>
            <div>
              <span className="text-zinc-400">言語</span>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">{meta.language}</p>
            </div>
          </div>
        </div>
      )}

      {transcript && (
        <div className="mx-4 mb-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              文字起こし結果 ({transcript.length} 文字)
            </span>
            <button
              onClick={() => {
                setTranscript('');
                setFileName(null);
                setMeta(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              クリア
            </button>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
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
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={transcribing}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            音声ファイル
          </button>
          <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
            <div className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
              {transcript
                ? `${fileName} — 文字起こし完了`
                : transcribing
                  ? '文字起こし中...'
                  : '音声ファイルをアップロードしてください'}
            </div>
            <button
              type="submit"
              disabled={
                status !== 'ready' || !transcript.trim() || transcribing
              }
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
