import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';
import { CopyButtons } from '@/components/copy-buttons';
import type { MinutesProgress, MinutesTiming } from '@/hooks/use-minutes-generation';

interface MinutesDisplayProps {
  text: string;
  progress: MinutesProgress;
  timing: MinutesTiming;
  error: string | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}分${rem}秒` : `${m}分`;
}

export function MinutesDisplay({ text, progress, timing, error }: MinutesDisplayProps) {
  const { phase, current, total } = progress;
  const isActive = phase === 'extracting' || phase === 'generating';

  // Progress percentage: extracting = 0-80%, generating = 80-100%
  let percent = 0;
  if (phase === 'extracting' && total > 0) {
    percent = Math.round((current / total) * 80);
  } else if (phase === 'generating') {
    percent = 80;
  } else if (phase === 'done') {
    percent = 100;
  }

  return (
    <>
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          議事録生成エラー: {error}
        </div>
      )}

      {isActive && (
        <div className="space-y-3">
          {/* Status text */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {phase === 'extracting' && total > 0 && (
                <span>要点を抽出中... ({current}/{total} チャンク)</span>
              )}
              {phase === 'extracting' && total === 0 && (
                <span>準備中...</span>
              )}
              {phase === 'generating' && (
                <span>議事録を生成中...</span>
              )}
            </div>
            {/* Live elapsed time */}
            <span className="tabular-nums text-xs text-zinc-400">
              {formatDuration(timing.elapsedMs)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>
                {phase === 'extracting' && total > 0
                  ? `ステップ 1/2: 要点抽出 (${current}/${total})`
                  : phase === 'generating'
                    ? `ステップ 2/2: 議事録生成${timing.extractionMs > 0 ? ` (抽出: ${formatDuration(timing.extractionMs)})` : ''}`
                    : '処理開始...'}
              </span>
              <span>{percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Completion timing summary */}
      {phase === 'done' && timing.totalMs > 0 && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
          {timing.extractionMs > 0 && (
            <span>要点抽出: {formatDuration(timing.extractionMs)}</span>
          )}
          {timing.extractionMs > 0 && (
            <span>議事録生成: {formatDuration(timing.totalMs - timing.extractionMs)}</span>
          )}
          <span>合計: {formatDuration(timing.totalMs)}</span>
        </div>
      )}

      {text && (
        <div className="relative rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          <div className="absolute right-2 top-2">
            <CopyButtons markdown={text} />
          </div>
          <div className="pt-6">
            <MarkdownRenderer content={text} />
          </div>
        </div>
      )}

      {phase === 'generating' && !text && (
        <div className="flex justify-start">
          <StreamingIndicator status="streaming" />
        </div>
      )}
    </>
  );
}
