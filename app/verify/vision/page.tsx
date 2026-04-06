'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';

export default function VisionPage() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/vision' }),
  });
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<FileUIPart | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageFile({
        type: 'file',
        mediaType: file.type,
        filename: file.name,
        url: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'ready') return;

    const text = input.trim() || 'この画像を説明してください';

    if (imageFile) {
      sendMessage({
        text,
        files: [imageFile],
      });
      setImageFile(null);
      setImagePreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } else if (input.trim()) {
      sendMessage({ text: input });
    }
    setInput('');
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
          ビジョン — 画像理解・OCR・図表分析の検証
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          ※ llama.cpp がマルチモーダル対応でビルドされている必要があります
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 dark:text-zinc-500 mt-8">
            画像をアップロードして質問を入力してください
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
                if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
                  return (
                    <img
                      key={i}
                      src={part.url}
                      alt={part.filename ?? 'Uploaded'}
                      className="max-w-xs rounded-xl border border-zinc-200 dark:border-zinc-700"
                    />
                  );
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

      {imagePreview && (
        <div className="mx-4 mb-2 flex items-center gap-2">
          <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
          <button
            onClick={() => {
              setImageFile(null);
              setImagePreview(null);
              if (fileRef.current) fileRef.current.value = '';
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            削除
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            画像
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={status !== 'ready'}
            placeholder="画像について質問..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={status !== 'ready' || (!input.trim() && !imageFile)}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
