import { convertToModelMessages, streamText, UIMessage } from 'ai';
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

function getSystemPrompt(phase: string, metadata?: MeetingMetadata): string {
  const metaBlock = buildMetadataBlock(metadata);

  if (phase === 'summary') {
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

  // in-progress: concise real-time advice
  return `あなたは会議ファシリテーションの専門アドバイザーです。
会議中のファシリテーターが一目で把握できるように、極めて簡潔に回答してください。
${metaBlock}
【回答ルール】
- 箇条書き3〜5項目以内
- 各項目は1行以内
- 「今すぐやるべきこと」を最優先で先頭に
- 長い説明や分析は不要
- 優先度を示す: 🔴緊急 🟡注意 🟢順調

【観点】
- 議論の脱線検知
- 発言の偏り
- 時間配分（残り時間に対する進捗）
- 次の具体的アクション1つ

ユーザーの言語に合わせて回答してください。`;
}

export async function POST(req: Request) {
  const {
    messages,
    phase = 'in-progress',
    metadata,
  }: { messages: UIMessage[]; phase?: string; metadata?: MeetingMetadata } =
    await req.json();

  const result = streamText({
    model: gemma4,
    system: getSystemPrompt(phase, metadata),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
