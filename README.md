# Gemma 4 Verification

Google の [Gemma 4](https://blog.google/technology/developers/gemma-4/) モデルの各種能力を、ローカルの llama.cpp サーバー上で体系的に検証するための Web アプリケーションです。

## 検証メニュー

| メニュー | 検証内容 |
|---------|---------|
| **基本チャット** | テキスト生成の品質、会話の流れ、文脈理解 |
| **推論** | 数学・論理パズル・コード生成（プリセット付き） |
| **関数呼び出し** | ツール使用精度、構造化 JSON 出力 |
| **多言語** | 日本語・英語・他 7 言語の能力比較（言語選択可） |
| **ビジョン** | 画像理解、OCR、図表分析 |
| **長文コンテキスト** | 文書要約、長文 QA（サンプル文書付き） |

## 技術スタック

- **Next.js 16** (App Router / Turbopack)
- **React 19** / **TypeScript**
- **Tailwind CSS v4** + `@tailwindcss/typography`
- **Vercel AI SDK v6** (`ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/react`)
- **llama.cpp** (OpenAI 互換 API)
- **react-markdown** + **KaTeX** (LaTeX 数式レンダリング)
- **react-syntax-highlighter** (コードブロックのシンタックスハイライト)

## 前提条件

- **Node.js 20+**
- **llama.cpp** サーバーが `http://localhost:8080` で動作していること
- Gemma 4 の GGUF モデルが llama.cpp に読み込まれていること

### llama.cpp の起動例

```bash
# llama-server の起動（例: Gemma 4 12B Q4_K_M）
llama-server -m gemma-4-12b-it-Q4_K_M.gguf -c 8192 --port 8080
```

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで http://localhost:3000 を開くとダッシュボードが表示されます。

## 環境変数（任意）

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| `LLAMA_BASE_URL` | `http://localhost:8080/v1` | llama.cpp サーバーの API ベース URL |

## プロジェクト構成

```
app/
├── page.tsx                      # ダッシュボード
├── api/
│   ├── health/route.ts           # llama.cpp ヘルスチェック
│   ├── chat/route.ts             # 基本チャット API
│   ├── reasoning/route.ts        # 推論 API
│   ├── function-calling/route.ts # 関数呼び出し API
│   ├── multilingual/route.ts     # 多言語 API
│   ├── vision/route.ts           # ビジョン API
│   └── long-context/route.ts     # 長文コンテキスト API
└── verify/
    ├── layout.tsx                # サイドバーナビ付き共通レイアウト
    ├── chat/page.tsx
    ├── reasoning/page.tsx
    ├── function-calling/page.tsx
    ├── multilingual/page.tsx
    ├── vision/page.tsx
    └── long-context/page.tsx
components/
├── chat-interface.tsx            # 再利用可能チャット UI
├── markdown-renderer.tsx         # Markdown + LaTeX + コードハイライト
├── streaming-indicator.tsx       # 推論中インジケーター
├── model-status.tsx              # サーバー接続状態表示
└── nav-sidebar.tsx               # サイドバーナビゲーション
lib/
└── llama.ts                      # AI SDK プロバイダ設定
```

## ライセンス

MIT
