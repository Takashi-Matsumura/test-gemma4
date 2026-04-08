'use client';

import { useState, useCallback } from 'react';

interface CopyButtonsProps {
  /** Raw markdown text to copy */
  markdown: string;
  className?: string;
}

/** Strip markdown formatting to produce plain text */
function markdownToPlainText(md: string): string {
  return md
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.+?)_{1,3}/g, '$1')
    // Remove inline code backticks
    .replace(/`(.+?)`/g, '$1')
    // Remove link syntax [text](url) -> text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove images ![alt](url) -> alt
    .replace(/!\[(.+?)\]\(.+?\)/g, '$1')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Clean up extra blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function CopyButtons({ markdown, className = '' }: CopyButtonsProps) {
  const [copiedMode, setCopiedMode] = useState<'text' | 'markdown' | null>(null);

  const copy = useCallback(async (mode: 'text' | 'markdown') => {
    const content = mode === 'markdown' ? markdown : markdownToPlainText(markdown);
    await navigator.clipboard.writeText(content);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  }, [markdown]);

  if (!markdown) return null;

  return (
    <div className={`inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}>
      <button
        onClick={() => copy('text')}
        className={`rounded-md px-2 py-1 text-xs transition-colors ${
          copiedMode === 'text'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
        }`}
        title="プレーンテキストとしてコピー"
      >
        {copiedMode === 'text' ? 'Copied!' : 'Text'}
      </button>
      <button
        onClick={() => copy('markdown')}
        className={`rounded-md px-2 py-1 text-xs transition-colors ${
          copiedMode === 'markdown'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
        }`}
        title="Markdown形式でコピー"
      >
        {copiedMode === 'markdown' ? 'Copied!' : 'Markdown'}
      </button>
    </div>
  );
}
