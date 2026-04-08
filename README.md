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
| **議事録作成** | 音声ファイル（複数対応）から文字起こし → 議事録自動生成 |
| **ファシリテーション支援** | リアルタイム文字起こし + AI による会議進行アドバイス + 議事録生成 |

## 技術スタック

- **Next.js 16** (App Router / Turbopack)
- **React 19** / **TypeScript**
- **Tailwind CSS v4** + `@tailwindcss/typography`
- **Vercel AI SDK v6** (`ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/react`)
- **llama.cpp** (OpenAI 互換 API)
- **whisper.cpp** (ローカル音声認識)
- **react-markdown** + **KaTeX** (LaTeX 数式レンダリング)
- **react-syntax-highlighter** (コードブロックのシンタックスハイライト)

## 前提条件

- **Node.js 20+**
- **llama.cpp** サーバーが `http://localhost:8080` で動作していること
- Gemma 4 の GGUF モデルが llama.cpp に読み込まれていること
- **whisper.cpp**（議事録作成・ファシリテーション機能を使う場合）

### llama.cpp の起動例

```bash
# テキストのみ（ビジョン機能なし）
llama-server -m gemma-4-e4b-it-Q4_K_M.gguf --port 8080 -ngl 999

# ビジョン機能あり（画像理解・OCR に必要）
llama-server \
  -m gemma-4-e4b-it-Q4_K_M.gguf \
  --mmproj mmproj-gemma-4-e4b-it-f16.gguf \
  --port 8080 -ngl 999
```

### mmproj ファイルの取得

ビジョン検証（画像理解・OCR・図表分析）を使うには、マルチモーダルプロジェクション（mmproj）ファイルが必要です。

```bash
# huggingface_hub をインストール（未導入の場合）
pip3 install huggingface_hub

# mmproj ファイルをダウンロード
python3 -c "
from huggingface_hub import hf_hub_download
hf_hub_download(
    repo_id='ggml-org/gemma-4-E4B-it-GGUF',
    filename='mmproj-gemma-4-e4b-it-f16.gguf',
    local_dir='<モデル保存ディレクトリ>'
)
"
```

> **Note**: `--mmproj` なしで起動した場合、ビジョン機能は `image input is not supported` エラーになります。テキストのみの検証は mmproj なしでも動作します。

### whisper.cpp のセットアップ（議事録作成・ファシリテーション機能）

議事録作成・ファシリテーション支援メニューでは、whisper.cpp を使って音声をテキストに変換し、Gemma 4 で議事録を生成します。

```bash
# whisper.cpp のインストール (macOS)
brew install whisper-cpp

# Whisper モデルのダウンロード（日本語対応 large-v3-turbo 量子化版）
python3 -c "
from huggingface_hub import hf_hub_download
hf_hub_download(
    repo_id='ggerganov/whisper.cpp',
    filename='ggml-large-v3-turbo-q5_0.bin',
    local_dir='~/.local/share/whisper-models/'
)
"
```

対応音声形式: wav, mp3, ogg, flac

## 議事録作成

音声ファイルをアップロードして議事録を自動生成します。

- **複数ファイル対応**: 長時間会議を分割保存した複数の音声ファイルをまとめて選択可能（ファイル名順に自動ソート）
- **Map-Reduce 方式**: 長い文字起こしテキストがコンテキスト上限（131K トークン）を超える場合、チャンク分割 → 要点抽出 → 議事録生成の 3 段階で処理
- **プログレス表示**: 要点抽出・議事録生成の進捗をプログレスバーとパーセンテージで表示、経過時間もリアルタイム更新
- **コピー機能**: 生成された議事録を Text（プレーンテキスト）/ Markdown の 2 形式でクリップボードにコピー
- **リセット**: ヘッダーのリセットボタンで初期状態に戻す

## ファシリテーション支援

ブラウザのマイクからリアルタイムに音声をキャプチャし、会議の進行を AI がサポートします。

### 仕組み

```
ブラウザ (マイク) → AudioWorklet で 5秒ごとに WAV チャンク生成
  → /api/facilitation/transcribe (whisper-cli で文字起こし → セッションに蓄積)
  → /api/facilitation/advice (Gemma 4 がファシリテーションアドバイスを生成)
  → /api/facilitation/minutes (Map-Reduce 方式で議事録生成)
```

### 機能

- **会議セットアップ**: 議題・目標・予定時間・アジェンダを事前入力し、AI アドバイスの精度を向上（スキップ可）
- **リアルタイム文字起こし**: 5 秒ごとに音声チャンクをサーバーに送信し whisper.cpp で逐次文字起こし
- **降順表示**: 最新の文字起こしが画面上部に表示され、スクロール不要
- **AI アドバイス**: 蓄積された文字起こしを基に、議論の状況分析・論点整理・次のアクション提案を生成
- **自動/手動アドバイス**: 「アドバイス取得」ボタンによる手動取得、または 60 秒間隔の自動取得が選択可能
- **議事録生成**: 録音停止後、文字起こし全文から Map-Reduce 方式で議事録を自動生成（プログレスバー付き）
- **タイミング表示**: 録音時間・文字起こし処理合計時間・議事録生成時間（要点抽出/生成/合計）を表示
- **コピー機能**: 文字起こし（時系列昇順）・議事録（Text / Markdown）をクリップボードにコピー
- **リセット**: ヘッダーのリセットボタンで全状態を初期化し、新しい会議を開始

> **Note**: ブラウザのマイクアクセス許可が必要です。HTTPS または localhost でのみ動作します。

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
| `WHISPER_CLI` | `/opt/homebrew/bin/whisper-cli` | whisper-cli の実行パス |
| `WHISPER_MODEL` | `~/.local/share/whisper-models/ggml-large-v3-turbo-q5_0.bin` | Whisper モデルファイルのパス |

## プロジェクト構成

```
app/
├── page.tsx                        # ダッシュボード
├── api/
│   ├── health/route.ts             # llama.cpp ヘルスチェック
│   ├── chat/route.ts               # 基本チャット API
│   ├── reasoning/route.ts          # 推論 API
│   ├── function-calling/route.ts   # 関数呼び出し API
│   ├── multilingual/route.ts       # 多言語 API
│   ├── vision/route.ts             # ビジョン API
│   ├── long-context/route.ts       # 長文コンテキスト API
│   ├── transcribe/route.ts         # 音声文字起こし API (whisper.cpp)
│   └── facilitation/
│       ├── transcribe/route.ts     # リアルタイム文字起こし API
│       ├── advice/route.ts         # ファシリテーション アドバイス API
│       └── minutes/route.ts        # 議事録生成 API (Map-Reduce)
└── verify/
    ├── layout.tsx                  # サイドバーナビ付き共通レイアウト
    ├── chat/page.tsx
    ├── reasoning/page.tsx
    ├── function-calling/page.tsx
    ├── multilingual/page.tsx
    ├── vision/page.tsx
    ├── long-context/page.tsx
    ├── minutes/page.tsx            # 議事録作成ページ（複数ファイル対応）
    └── facilitation/page.tsx       # ファシリテーション支援ページ
components/
├── chat-interface.tsx              # 再利用可能チャット UI
├── audio-recorder.tsx              # マイク録音 + チャンク送信
├── markdown-renderer.tsx           # Markdown + LaTeX + コードハイライト
├── streaming-indicator.tsx         # 推論中インジケーター
├── model-status.tsx                # サーバー接続状態表示
├── nav-sidebar.tsx                 # サイドバーナビゲーション
├── minutes-display.tsx             # 議事録表示（プログレスバー + タイミング）
└── copy-buttons.tsx                # Text / Markdown コピーボタン
hooks/
└── use-minutes-generation.ts       # 議事録生成 hook（共通ロジック）
lib/
├── llama.ts                        # AI SDK プロバイダ設定
├── wav-encoder.ts                  # PCM → WAV エンコーダ
└── session-store.ts                # セッション管理（インメモリ）
public/
└── audio-processor.js              # AudioWorklet プロセッサ
```

## ライセンス

MIT
