import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { gemma4 } from '@/lib/llama';

export async function POST(req: Request) {
  const { messages, language }: { messages: UIMessage[]; language?: string } =
    await req.json();

  const langInstruction = language
    ? `Always respond in ${language}. If the user writes in a different language, still respond in ${language}.`
    : 'Respond in the same language as the user.';

  const result = streamText({
    model: gemma4,
    system: `You are a multilingual assistant. ${langInstruction}`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
