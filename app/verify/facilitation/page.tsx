'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioRecorder } from '@/components/audio-recorder';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';

type MeetingPhase = 'setup' | 'in-progress' | 'summary';

interface MeetingMetadata {
  topic?: string;
  agendaItems?: string[];
  duration?: string;
  goals?: string;
}

// Setup Q&A steps
const SETUP_QUESTIONS = [
  { key: 'topic' as const, question: '今日の会議の議題（テーマ）は何ですか？' },
  { key: 'goals' as const, question: '会議で最終的に何を決めたい・達成したいですか？' },
  { key: 'duration' as const, question: '会議の予定時間はどれくらいですか？（例: 30分、1時間）' },
  {
    key: 'agendaItems' as const,
    question: '話し合うアジェンダ項目があれば教えてください。（カンマ区切りで複数入力可）',
  },
];

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

  // Meeting phase & metadata
  const [meetingPhase, setMeetingPhase] = useState<MeetingPhase>('setup');
  const [meetingMetadata, setMeetingMetadata] = useState<MeetingMetadata>({});
  const [setupStep, setSetupStep] = useState(0);
  const [setupInput, setSetupInput] = useState('');
  const [isRecordingStopped, setIsRecordingStopped] = useState(false);

  // Refs for dynamic body in transport
  const phaseRef = useRef<MeetingPhase>('setup');
  const metadataRef = useRef<MeetingMetadata>({});
  useEffect(() => {
    phaseRef.current = meetingPhase;
  }, [meetingPhase]);
  useEffect(() => {
    metadataRef.current = meetingMetadata;
  }, [meetingMetadata]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: '/api/facilitation/advice',
        body: () => ({
          phase: phaseRef.current,
          metadata: metadataRef.current,
        }),
      }),
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  // Meeting start time for remaining time display
  const meetingStartRef = useRef<number | null>(null);

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

  const handleRecordingStart = useCallback(() => {
    setMeetingPhase('in-progress');
    setIsRecordingStopped(false);
    meetingStartRef.current = Date.now();
  }, []);

  const handleRecordingStop = useCallback(() => {
    setIsRecordingStopped(true);
  }, []);

  const requestAdvice = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (!text || status !== 'ready') return;
    sendMessage({
      text: `以下は現在進行中の会議の文字起こしです。ファシリテーションのアドバイスをください。\n\n---\n${text}\n---`,
    });
  }, [sendMessage, status]);

  const requestSummary = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (!text || status !== 'ready') return;
    setMeetingPhase('summary');
    // Use setTimeout to ensure phaseRef is updated before sendMessage
    setTimeout(() => {
      sendMessage({
        text: `以下は会議の全文字起こしです。詳細な議事録を作成してください。\n\n---\n${text}\n---`,
      });
    }, 0);
  }, [sendMessage, status]);

  // Auto-advice timer — only during in-progress phase
  useEffect(() => {
    if (autoAdvice && meetingPhase === 'in-progress') {
      autoAdviceTimerRef.current = setInterval(() => {
        if (transcriptRef.current.trim() && status === 'ready') {
          requestAdvice();
        }
      }, 60_000);
    }
    return () => {
      if (autoAdviceTimerRef.current) clearInterval(autoAdviceTimerRef.current);
    };
  }, [autoAdvice, meetingPhase, requestAdvice, status]);

  // Auto-scroll advice panel
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, status, setupStep]);

  // Setup Q&A handler
  const handleSetupSubmit = useCallback(() => {
    const value = setupInput.trim();
    if (!value) return;

    const currentQuestion = SETUP_QUESTIONS[setupStep];
    setMeetingMetadata((prev) => {
      if (currentQuestion.key === 'agendaItems') {
        return { ...prev, agendaItems: value.split(/[,、，]/).map((s) => s.trim()).filter(Boolean) };
      }
      return { ...prev, [currentQuestion.key]: value };
    });
    setSetupInput('');

    if (setupStep < SETUP_QUESTIONS.length - 1) {
      setSetupStep((s) => s + 1);
    } else {
      // All questions answered — ready to start
      setSetupStep(SETUP_QUESTIONS.length);
    }
  }, [setupInput, setupStep]);

  const skipSetup = useCallback(() => {
    setSetupStep(SETUP_QUESTIONS.length);
  }, []);

  // Phase badge
  const phaseBadge = {
    setup: { label: 'セットアップ', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    'in-progress': { label: '会議中', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    summary: { label: '議事録作成', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  }[meetingPhase];

  const lastMessage = messages.at(-1);
  const lastAssistantText =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text)
          .join('')
      : '';
  const showIndicator = status === 'streaming' && lastAssistantText.length === 0;

  const setupComplete = setupStep >= SETUP_QUESTIONS.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ファシリテーション支援 — リアルタイム文字起こし + AI アドバイス
          </p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${phaseBadge.color}`}>
            {phaseBadge.label}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <AudioRecorder
            sessionId={sessionId}
            onTranscript={handleTranscript}
            onError={handleError}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
          />
          <div className="flex items-center gap-2">
            {/* Metadata badges */}
            {meetingPhase !== 'setup' && meetingMetadata.topic && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {meetingMetadata.topic}
              </span>
            )}
            {meetingPhase !== 'setup' && meetingMetadata.duration && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {meetingMetadata.duration}
              </span>
            )}
            {meetingPhase === 'in-progress' && (
              <>
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
              </>
            )}
            {isRecordingStopped && meetingPhase !== 'summary' && transcript.trim() && (
              <button
                onClick={requestSummary}
                disabled={status !== 'ready'}
                className="rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                議事録を生成
              </button>
            )}
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

        {/* Right: Advice / Setup / Summary */}
        <div className="flex w-1/2 flex-col">
          <div className="border-b border-zinc-100 px-4 py-1.5 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {meetingPhase === 'setup'
                ? '会議セットアップ'
                : meetingPhase === 'summary'
                  ? '議事録'
                  : 'AI アドバイス'}
            </span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Setup Phase */}
            {meetingPhase === 'setup' && (
              <div className="space-y-4">
                {/* Welcome message */}
                <div className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                  <p className="font-medium mb-2">会議を始める前に、いくつか教えてください。</p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    より的確なファシリテーション支援ができるよう、会議の情報を収集します。
                    スキップして録音を開始することもできます。
                  </p>
                </div>

                {/* Previous answers */}
                {SETUP_QUESTIONS.slice(0, setupStep).map((q, i) => (
                  <div key={q.key} className="space-y-2">
                    <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {q.question}
                    </div>
                    <div className="rounded-2xl bg-blue-50 px-4 py-2 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200 ml-8">
                      {q.key === 'agendaItems'
                        ? meetingMetadata.agendaItems?.join('、')
                        : meetingMetadata[q.key] || ''}
                    </div>
                  </div>
                ))}

                {/* Current question */}
                {!setupComplete && (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {SETUP_QUESTIONS[setupStep].question}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={setupInput}
                        onChange={(e) => setSetupInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSetupSubmit();
                        }}
                        placeholder="回答を入力..."
                        className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        onClick={handleSetupSubmit}
                        disabled={!setupInput.trim()}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        送信
                      </button>
                    </div>
                    <button
                      onClick={skipSetup}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      スキップして録音を開始 →
                    </button>
                  </div>
                )}

                {/* Setup complete — ready to start */}
                {setupComplete && (
                  <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    <p className="font-medium mb-1">準備完了</p>
                    <p className="text-green-700 dark:text-green-400">
                      録音開始ボタンを押して、会議を始めてください。
                    </p>
                    {meetingMetadata.topic && (
                      <div className="mt-2 space-y-0.5 text-xs text-green-600 dark:text-green-400">
                        {meetingMetadata.topic && <p>議題: {meetingMetadata.topic}</p>}
                        {meetingMetadata.goals && <p>目標: {meetingMetadata.goals}</p>}
                        {meetingMetadata.duration && <p>予定時間: {meetingMetadata.duration}</p>}
                        {meetingMetadata.agendaItems?.length ? (
                          <p>アジェンダ: {meetingMetadata.agendaItems.join('、')}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* In-Progress & Summary Phase — show AI messages */}
            {meetingPhase !== 'setup' && (
              <>
                {messages.length === 0 && !showIndicator && (
                  <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 mt-8">
                    {meetingPhase === 'in-progress'
                      ? '「アドバイス取得」を押すか、自動アドバイスを有効にしてください'
                      : '議事録を生成中...'}
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
                {showIndicator && <StreamingIndicator status={status} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
