import { convertToModelMessages, streamText, UIMessage, stepCountIs } from 'ai';
import { gemma4 } from '@/lib/llama';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gemma4,
    system: `You are a helpful assistant with access to tools. Use the available tools when appropriate to answer the user's questions. Always respond in the same language as the user's message.`,
    messages: await convertToModelMessages(messages),
    tools: {
      calculate: {
        description: 'Evaluate a mathematical expression and return the result',
        inputSchema: z.object({
          expression: z.string().describe('The math expression to evaluate, e.g. "2 + 3 * 4"'),
        }),
        execute: async ({ expression }: { expression: string }) => {
          try {
            const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
            const result = new Function(`return (${sanitized})`)();
            return { expression, result: Number(result) };
          } catch {
            return { expression, error: 'Invalid expression' };
          }
        },
      },
      getCurrentTime: {
        description: 'Get the current date and time',
        inputSchema: z.object({
          timezone: z.string().optional().describe('Timezone like "Asia/Tokyo" or "UTC"'),
        }),
        execute: async ({ timezone }: { timezone?: string }) => {
          const now = new Date();
          const formatted = now.toLocaleString('ja-JP', {
            timeZone: timezone || 'Asia/Tokyo',
            dateStyle: 'full',
            timeStyle: 'long',
          });
          return { datetime: formatted, timezone: timezone || 'Asia/Tokyo' };
        },
      },
      generateJson: {
        description: 'Generate structured JSON data based on a description',
        inputSchema: z.object({
          description: z.string().describe('Description of the JSON structure to generate'),
          fields: z.array(z.string()).describe('List of field names to include'),
        }),
        execute: async ({ description, fields }: { description: string; fields: string[] }) => {
          const obj: Record<string, string> = {};
          for (const field of fields) {
            obj[field] = `<${field} value>`;
          }
          return { description, schema: obj };
        },
      },
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
