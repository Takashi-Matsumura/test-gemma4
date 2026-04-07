'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioRecorder } from '@/components/audio-recorder';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';

export default function FacilitationPage() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [transcript, setTranscript] = useState('');
  const [lastChunkText, setLastChunkText] = useState('');
  const [chunkStats, setChunkStats] = useState<{ index: number; timeMs: number } | null>(null);
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const [autoAdvice, setAutoAdvice] = useState(false);
  const autoAdviceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/facilitation/advice' }),
  });

  const handleTranscript = useCallback(
    (chunkText: string, fullTranscript: string, chunkIndex: number, processingTimeMs: number) => {
      setTranscript(fullTranscript);
      transcriptRef.current = fullTranscript;
      setLastChunkText(chunkText);
      setChunkStats({ index: chunkIndex, timeMs: processingTimeMs });
    },
    [],
  );

  const handleError = useCallback((err: string) => {
    setRecorderError(err);
  }, []);

  const requestAdvice = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (!text || status !== 'ready') return;
    sendMessage({
      text: `以下は現在進行中の会議の文字起こしです。ファシリテーションのアドバイスをください。\n\n---\n${text}\n---`,
    });
  }, [sendMessage, status]);

  // Auto-advice timer
  useEffect(() => {
    if (autoAdvice) {
      autoAdviceTimerRef.current = setInterval(() => {
        if (transcriptRef.current.trim() && status === 'ready') {
          requestAdvice();
        }
      }, 60_000);
    }
    return () => {
      if (autoAdviceTimerRef.current) clearInterval(autoAdviceTimerRef.current);
    };
  }, [autoAdvice, requestAdvice, status]);

  // Auto-scroll advice panel
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, status]);

  const lastMessage = messages.at(-1);
  const lastAssistantText =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join('')
      : '';
  const showIndicator = status === 'streaming' && lastAssistantText.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          ファシリテーション支援 — リアルタイム文字起こし + AI アドバイス
        </p>
        <div className="mt-2 flex items-center justify-between">
          <AudioRecorder
            sessionId={sessionId}
            onTranscript={handleTranscript}
            onError={handleError}
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={autoAdvice}
                onChange={(e) => setAutoAdvice(e.target.checked)}
                className="rounded"
              />
              自動アドバイス (60秒)
            </label>
            <button
              onClick={requestAdvice}
              disabled={!transcript.trim() || status !== 'ready'}
              className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              アドバイス取得
            </button>
          </div>
        </div>
      </div>

      {recorderError && (
        <div className="mx-4 mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {recorderError}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          LLMエラー: {error.message}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="flex w-1/2 flex-col border-r border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-1.5 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              文字起こし
              {transcript && ` (${transcript.length} 文字)`}
            </span>
            {chunkStats && (
              <span className="text-xs text-zinc-400">
                #{chunkStats.index} — {chunkStats.timeMs}ms
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!transcript && (
              <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 mt-8">
                録音を開始すると、ここに文字起こしが表示されます
              </p>
            )}
            {transcript && (
              <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {transcript}
                {lastChunkText && (
                  <span className="bg-yellow-100 dark:bg-yellow-900/30">
                    {/* highlight effect fades naturally on next render */}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Advice */}
        <div className="flex w-1/2 flex-col">
          <div className="border-b border-zinc-100 px-4 py-1.5 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              AI アドバイス
            </span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 mt-8">
                「アドバイス取得」を押すか、自動アドバイスを有効にしてください
              </p>
            )}
            {messages.map((message) => {
              if (message.role === 'user') return null;
              return (
                <div
                  key={message.id}
                  className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {message.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <MarkdownRenderer key={i} content={part.text} />
                    ) : null,
                  )}
                </div>
              );
            })}
            {showIndicator && (
              <StreamingIndicator status={status} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
