'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const presets = [
  { label: '計算', prompt: '(17 × 23) + (45 × 12) を計算してください' },
  { label: '現在時刻', prompt: '今の日本の日時を教えてください' },
  { label: 'JSON生成', prompt: 'ユーザープロフィールのJSONを生成してください。フィールドは name, email, age, role です。' },
  { label: '複合タスク', prompt: '123 × 456 を計算して、その結果と現在時刻を含むJSONを生成してください' },
];

const stateLabel: Record<string, string> = {
  'input-streaming': '入力中...',
  'input-available': '実行中...',
  'output-available': '完了',
};

function ToolCard({ part }: { part: { state: string; input?: unknown; output?: unknown; toolCallId: string }; name: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Tool: {getToolName(part as Parameters<typeof getToolName>[0])}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
          part.state === 'output-available'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            : part.state === 'input-available'
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
              : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
        }`}>
          {stateLabel[part.state] ?? part.state}
        </span>
      </div>
      {(part.state === 'input-available' || part.state === 'output-available') && (
        <div className="px-1 py-1">
          <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Input</div>
          <SyntaxHighlighter
            style={oneDark}
            language="json"
            customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.75rem', padding: '0.5rem' }}
          >
            {JSON.stringify(part.input, null, 2)}
          </SyntaxHighlighter>
        </div>
      )}
      {part.state === 'output-available' && (
        <div className="px-1 pb-1">
          <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">Output</div>
          <SyntaxHighlighter
            style={oneDark}
            language="json"
            customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.75rem', padding: '0.5rem' }}
          >
            {JSON.stringify(part.output, null, 2)}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

export default function FunctionCallingPage() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/function-calling' }),
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

  const handlePreset = (prompt: string) => {
    if (status === 'ready') {
      sendMessage({ text: prompt });
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
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          関数呼び出し — ツール使用精度・構造化出力の検証
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 dark:text-zinc-500 mt-8">
            ツール使用を試すメッセージを入力するか、プリセットを選択してください
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[85%] space-y-2">
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  if (message.role === 'user') {
                    return (
                      <div key={i} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                      <MarkdownRenderer content={part.text} />
                    </div>
                  );
                }
                if (isToolUIPart(part)) {
                  return <ToolCard key={i} part={part} name={getToolName(part)} />;
                }
                return null;
              })}
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
            placeholder="ツール使用をテストするメッセージを入力..."
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
