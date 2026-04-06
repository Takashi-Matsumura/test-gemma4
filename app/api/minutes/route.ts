import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { gemma4 } from '@/lib/llama';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gemma4,
    system: `あなたは議事録作成の専門アシスタントです。音声の文字起こしテキストを受け取り、以下の形式で議事録を作成してください：

## 議事録

### 概要
（会議の主題を1-2文で要約）

### 議題・討議内容
（主要な議題ごとに箇条書きで整理）

### 決定事項
（決定された事項を箇条書き）

### アクションアイテム
（誰が・何を・いつまでに、を明記）

### 備考
（その他の重要な情報）

文字起こしに含まれる「えーと」「あの」などのフィラーは無視し、内容を正確かつ簡潔にまとめてください。
ユーザーの言語に合わせて回答してください。`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
