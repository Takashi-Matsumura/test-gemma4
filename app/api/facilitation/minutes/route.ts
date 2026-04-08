import { generateText, streamText } from 'ai';
import { gemma4 } from '@/lib/llama';

interface MeetingMetadata {
  topic?: string;
  agendaItems?: string[];
  duration?: string;
  goals?: string;
}

function buildMetadataBlock(metadata?: MeetingMetadata): string {
  if (!metadata) return '';
  const lines: string[] = [];
  if (metadata.topic) lines.push(`- 議題: ${metadata.topic}`);
  if (metadata.goals) lines.push(`- 目標: ${metadata.goals}`);
  if (metadata.duration) lines.push(`- 予定時間: ${metadata.duration}`);
  if (metadata.agendaItems?.length) {
    lines.push(`- アジェンダ:\n${metadata.agendaItems.map((a) => `  - ${a}`).join('\n')}`);
  }
  if (lines.length === 0) return '';
  return `\n【会議情報】\n${lines.join('\n')}\n`;
}

function getMinutesSystemPrompt(metaBlock: string): string {
  return `あなたは会議ファシリテーションの専門家です。
以下の会議の全文字起こしを元に、詳細な会議議事録を作成してください。
${metaBlock}
以下の構成で議事録を出力してください：

### 会議概要
- 日時、議題、参加者の概要

### 議論された議題と要点
- 各議題ごとに主な論点をまとめる

### 決定事項
- 合意された内容を明確に記載

### アクションアイテム
- 担当者・期限を含めた具体的なタスク

### 次回に向けた課題
- 持ち越し事項や検討課題

ユーザーの言語に合わせて回答してください。`;
}

/**
 * Split transcript into chunks of roughly `maxChars` characters,
 * breaking at line boundaries when possible.
 */
function splitTranscript(text: string, maxChars: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function POST(req: Request) {
  const { transcript, metadata }: { transcript: string; metadata?: MeetingMetadata } =
    await req.json();

  if (!transcript?.trim()) {
    return Response.json({ error: 'No transcript provided' }, { status: 400 });
  }

  const metaBlock = buildMetadataBlock(metadata);
  const CHUNK_SIZE = 3000;

  // Short transcript: single pass with progress events
  if (transcript.length <= CHUNK_SIZE) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        // Signal: single-pass mode, skip straight to generating
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', phase: 'generating', current: 0, total: 0 }) + '\n'));

        const result = streamText({
          model: gemma4,
          system: getMinutesSystemPrompt(metaBlock),
          messages: [{ role: 'user', content: transcript }],
        });

        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', content: chunk }) + '\n'));
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
    });
  }

  // --- Map-Reduce for long transcripts ---
  const chunks = splitTranscript(transcript, CHUNK_SIZE);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Map phase: extract key points from each chunk sequentially with progress
      const extractedParts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'progress', phase: 'extracting', current: i + 1, total: chunks.length }) + '\n'),
        );

        const { text } = await generateText({
          model: gemma4,
          system: `あなたは会議の文字起こしから要点を抽出する専門家です。
与えられた文字起こしの一部（パート ${i + 1}/${chunks.length}）から、以下を簡潔に抽出してください：
- 議論された話題とその要点
- 決定された事項（あれば）
- アクションアイテム（あれば）
- 重要な発言や意見

箇条書きで、元の内容を漏らさず、かつ冗長な表現は省いてまとめてください。`,
          messages: [{ role: 'user', content: chunks[i] }],
        });

        extractedParts.push(`## パート ${i + 1}/${chunks.length}\n${text}`);
      }

      const combinedExtractions = extractedParts.join('\n\n');

      // Reduce phase: generate final minutes
      controller.enqueue(
        encoder.encode(JSON.stringify({ type: 'progress', phase: 'generating', current: 0, total: 0 }) + '\n'),
      );

      const result = streamText({
        model: gemma4,
        system: `あなたは会議ファシリテーションの専門家です。
会議の文字起こしから抽出された要点をもとに、詳細な会議議事録を作成してください。
${metaBlock}
以下の構成で議事録を出力してください：

### 会議概要
- 日時、議題、参加者の概要

### 議論された議題と要点
- 各議題ごとに主な論点をまとめる

### 決定事項
- 合意された内容を明確に記載

### アクションアイテム
- 担当者・期限を含めた具体的なタスク

### 次回に向けた課題
- 持ち越し事項や検討課題

ユーザーの言語に合わせて回答してください。`,
        messages: [
          {
            role: 'user',
            content: `以下は会議の文字起こし（全${chunks.length}パート）から抽出された要点です。これをもとに議事録を作成してください。\n\n${combinedExtractions}`,
          },
        ],
      });

      for await (const chunk of result.textStream) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', content: chunk }) + '\n'));
      }

      controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  });
}
