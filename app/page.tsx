import Link from 'next/link';
import { ModelStatus } from '@/components/model-status';

const verifyPages = [
  {
    href: '/verify/chat',
    title: '基本チャット',
    description: 'テキスト生成の品質、会話の流れ、文脈理解を検証',
  },
  {
    href: '/verify/reasoning',
    title: '推論',
    description: '数学・論理・コード生成と思考モードの検証',
  },
  {
    href: '/verify/function-calling',
    title: '関数呼び出し',
    description: 'ツール使用、構造化JSON出力の検証',
  },
  {
    href: '/verify/multilingual',
    title: '多言語',
    description: '日本語・英語・他言語の能力比較',
  },
  {
    href: '/verify/vision',
    title: 'ビジョン',
    description: '画像理解、OCR、図表分析の検証',
  },
  {
    href: '/verify/long-context',
    title: '長文コンテキスト',
    description: '長文文書の要約・QAの検証',
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Gemma 4 Verification
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          ローカル llama.cpp 上の Gemma 4 モデルの各種能力を検証します
        </p>
      </div>

      <ModelStatus />

      <div className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          検証メニュー
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {verifyPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
            >
              <h3 className="font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
                {page.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {page.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
