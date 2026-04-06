import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { gemma4 } from '@/lib/llama';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gemma4,
    system: `You are a reasoning assistant. Think step by step before providing your final answer.
When solving problems:
1. Break down the problem into smaller parts
2. Show your reasoning process clearly
3. Verify your answer before presenting it
4. If the problem involves math, show all calculations
5. If the problem involves logic, explain each logical step`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
