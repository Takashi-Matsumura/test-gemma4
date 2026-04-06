'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';

export function ChatInterface({
  apiEndpoint,
  systemLabel,
}: {
  apiEndpoint: string;
  systemLabel?: string;
}) {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: apiEndpoint }),
  });
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
      {systemLabel && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {systemLabel}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 dark:text-zinc-500 mt-8">
            メッセージを入力して会話を始めてください
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
            placeholder="メッセージを入力..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={status !== 'ready' || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
