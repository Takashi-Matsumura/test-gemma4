'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/verify/chat', label: '基本チャット' },
  { href: '/verify/reasoning', label: '推論' },
  { href: '/verify/function-calling', label: '関数呼び出し' },
  { href: '/verify/multilingual', label: '多言語' },
  { href: '/verify/vision', label: 'ビジョン' },
  { href: '/verify/long-context', label: '長文コンテキスト' },
  { href: '/verify/minutes', label: '議事録作成' },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link
          href="/"
          className="text-sm font-bold text-zinc-900 dark:text-zinc-100"
        >
          Gemma 4 Verification
        </Link>
        <Link
          href="/"
          className="mt-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
        >
          <span aria-hidden="true">&larr;</span> ダッシュボードに戻る
        </Link>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-blue-100 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
