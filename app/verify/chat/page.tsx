import { ChatInterface } from '@/components/chat-interface';

export default function ChatPage() {
  return (
    <ChatInterface
      apiEndpoint="/api/chat"
      systemLabel="基本チャット — テキスト生成の品質・会話力・文脈理解を検証"
    />
  );
}
