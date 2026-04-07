import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { gemma4 } from '@/lib/llama';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gemma4,
    system: `あなたは会議ファシリテーションの専門アドバイザーです。
会議の文字起こしテキストをリアルタイムで受け取り、議長（ファシリテーター）に対して的確なアドバイスを提供します。

以下の観点で分析し、簡潔にアドバイスしてください：

### 議論の現状把握
- 現在どのような議題が話し合われているか
- 議論の進行度合い（導入/議論中/まとめ段階）

### ファシリテーションアドバイス
- 議論が脱線していないか、本題に戻す必要があるか
- 発言が偏っていないか（特定の人ばかり話していないか）
- 合意形成が必要なポイントはあるか
- 時間配分の提案

### 次のアクション提案
- 議長が次に取るべき具体的なアクション（質問、まとめ、採決など）

回答は箇条書きで簡潔に。長い説明は不要です。
ユーザーの言語に合わせて回答してください。`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
