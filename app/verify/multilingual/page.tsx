'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useMemo, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';

const languages = [
  { code: '', label: '自動検出' },
  { code: 'Japanese', label: '日本語' },
  { code: 'English', label: '英語' },
  { code: 'Chinese', label: '中国語' },
  { code: 'Korean', label: '韓国語' },
  { code: 'French', label: 'フランス語' },
  { code: 'Spanish', label: 'スペイン語' },
  { code: 'German', label: 'ドイツ語' },
  { code: 'Arabic', label: 'アラビア語' },
];

const presets = [
  { label: '翻訳テスト', prompt: '次の文を翻訳してください：「人工知能は私たちの生活を大きく変えようとしています」' },
  { label: '多言語QA', prompt: 'What is the capital of Japan and what is it famous for?' },
  { label: '言語切替', prompt: 'まず日本語で挨拶し、次に英語で自己紹介し、最後にフランス語でお別れを言ってください。' },
];

export default function MultilingualPage() {
  const [language, setLanguage] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/multilingual',
        body: () => ({ language }),
      }),
    [language],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input });
      setInput('');
    }
  };

  const handlePreset = (prompt: string) => {
    if (status === 'ready') {
      sendMessage({ text: prompt });
    }
  };

  const lastMessage = messages.at(-1);
  const lastAssistantText =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts.filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('')
      : '';
  const showIndicator = status === 'streaming' && lastAssistantText.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          多言語 — 日本語・英語・他言語の能力比較
        </p>
        <div className="mt-2 flex items-center gap-3">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">応答言語:</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p.prompt)}
                disabled={status !== 'ready'}
                className="rounded-lg border border-zinc-300 px-3 py-1 text-xs transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 dark:text-zinc-500 mt-8">
            多言語テストのメッセージを入力するか、プリセットを選択してください
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white whitespace-pre-wrap'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              {message.role === 'user'
                ? message.parts.map((part, i) =>
                    part.type === 'text' ? <span key={i}>{part.text}</span> : null,
                  )
                : message.parts.map((part, i) =>
                    part.type === 'text' ? <MarkdownRenderer key={i} content={part.text} /> : null,
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

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          エラー: {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={status !== 'ready'}
            placeholder="メッセージを入力（どの言語でも可）..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={status !== 'ready' || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
