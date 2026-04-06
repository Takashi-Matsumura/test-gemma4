import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { gemma4 } from '@/lib/llama';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gemma4,
    system: 'You are a helpful assistant.',
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
