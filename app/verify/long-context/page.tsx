'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { StreamingIndicator } from '@/components/streaming-indicator';

const sampleLongText = `以下は日本の歴史における重要な出来事をまとめた文書です。

【古代】
日本列島には約3万年前から人類が居住していたとされる。縄文時代（約1万6千年前〜約3千年前）には独自の土器文化が発展し、狩猟採集を基盤とした社会が形成された。弥生時代（約3千年前〜3世紀頃）には大陸から稲作が伝来し、農耕社会への移行が進んだ。

【飛鳥・奈良時代】
6世紀後半から7世紀にかけて、仏教の伝来とともに大陸の文化・制度が積極的に導入された。聖徳太子は十七条憲法を制定し、遣隋使を派遣した。710年には平城京が建設され、律令制に基づく中央集権国家が確立された。

【平安時代】
794年に桓武天皇が平安京に遷都。この時代には国風文化が花開き、紫式部の『源氏物語』や清少納言の『枕草子』などの文学作品が生まれた。摂関政治が全盛を迎え、藤原道長が「この世をば我が世とぞ思ふ」と詠んだことは有名である。

【鎌倉時代】
1185年に源頼朝が鎌倉幕府を開き、武家政権の時代が始まった。元寇（1274年、1281年）では二度にわたるモンゴル帝国の侵攻を退けた。この時代には浄土宗、禅宗などの新仏教が広まった。

【室町時代】
1336年に足利尊氏が室町幕府を開いた。金閣寺・銀閣寺に代表される室町文化が栄え、能楽や茶道の原型が形成された。応仁の乱（1467年）以降は戦国時代に突入し、各地で大名が割拠した。

【安土桃山時代】
織田信長、豊臣秀吉によって天下統一が進められた。信長は楽市楽座や鉄砲の活用など革新的な政策を推進。秀吉は太閤検地や刀狩りを実施し、全国統一を達成した。

【江戸時代】
1603年に徳川家康が江戸幕府を開き、約260年間の太平の世が続いた。鎖国政策のもとで独自の文化が発展し、浮世絵、歌舞伎、俳句などが花開いた。寺子屋による教育の普及で識字率は世界的にも高い水準にあった。

【明治以降】
1868年の明治維新により近代国家への転換が始まった。廃藩置県、学制、徴兵令などの改革が実施され、急速な近代化が進んだ。`;

export default function LongContextPage() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/long-context' }),
  });
  const [input, setInput] = useState('');
  const [docText, setDocText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'ready') return;

    let text = input.trim();
    if (docText.trim()) {
      text = `以下の文書について質問します。\n\n---\n${docText.trim()}\n---\n\n質問: ${text || 'この文書を要約してください'}`;
      setDocText('');
    }
    if (text) {
      sendMessage({ text });
      setInput('');
    }
  };

  const loadSample = () => {
    setDocText(sampleLongText);
  };

  const lastMessage = messages.at(-1);
  const lastAssistantText =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts.filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('')
      : '';
  const showIndicator = status === 'streaming' && lastAssistantText.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          長文コンテキスト — 文書要約・長文QAの検証
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={loadSample}
            disabled={status !== 'ready'}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            サンプル文書を読み込む
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-zinc-400 dark:text-zinc-500 mt-8">
            文書を入力して質問するか、サンプルを読み込んでください
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white whitespace-pre-wrap'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              {message.role === 'user'
                ? message.parts.map((part, i) =>
                    part.type === 'text' ? (
                      <span key={i}>
                        {part.text.length > 500
                          ? part.text.slice(0, 200) + '\n...(省略)...\n' + part.text.slice(-200)
                          : part.text}
                      </span>
                    ) : null,
                  )
                : message.parts.map((part, i) =>
                    part.type === 'text' ? <MarkdownRenderer key={i} content={part.text} /> : null,
                  )}
            </div>
          </div>
        ))}
        {showIndicator && (
          <div className="flex justify-start">
            <StreamingIndicator status={status} />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          エラー: {error.message}
        </div>
      )}

      {docText && (
        <div className="mx-4 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">文書 ({docText.length} 文字)</span>
            <button
              onClick={() => setDocText('')}
              className="text-xs text-red-500 hover:text-red-700"
            >
              削除
            </button>
          </div>
          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={status !== 'ready'}
            placeholder={docText ? '文書への質問を入力（空欄なら要約）...' : 'メッセージを入力...'}
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={status !== 'ready' || (!input.trim() && !docText.trim())}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
