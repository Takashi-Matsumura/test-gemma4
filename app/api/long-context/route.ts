import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { gemma4 } from '@/lib/llama';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gemma4,
    system: `You are an assistant specialized in analyzing long documents. When given a long text:
1. Read the entire text carefully
2. Provide accurate answers based on the content
3. Quote relevant passages when appropriate
4. If asked to summarize, capture all key points
Respond in the same language as the user.`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
