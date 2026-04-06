'use client';

import { useEffect, useState } from 'react';

export function StreamingIndicator({ status }: { status: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'streaming') {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  if (status !== 'streaming') return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
      </div>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        推論中... {elapsed > 0 && `(${elapsed}秒)`}
      </span>
    </div>
  );
}
