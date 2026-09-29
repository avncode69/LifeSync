import { useState, useRef, useEffect } from 'react';
import { type Message } from '../types';



const AI_SUGGESTIONS = [
  'Скільки я витратив цього тижня?',
  'Які пріоритетні задачі горять до завтра?',
  'Оптимізуй мій розклад на сьогодні',
  'Покажи звіт по звичках за місяць',
];

const QUICK_ANSWERS: Record<string, string> = {
  'Скільки я витратив цього тижня?': '📊 Перевіряю ваші транзакції... Перейдіть до розділу "Finance" для детального огляду витрат та доходів.',
  'Які пріоритетні задачі горять до завтра?': '🔥 Перевіряю ваші задачі... Перейдіть до розділу "Tasks" для перегляду активних задач за пріоритетом.',
  'Оптимізуй мій розклад на сьогодні': '🗓️ Аналізую ваш календар... Перейдіть до розділу "Calendar" для керування розкладом.',
  'Покажи звіт по звичках за місяць': '📈 Перевіряю трекер звичок... Перейдіть до розділу "Tasks & Habits" для перегляду стріків та історії.',
};

function formatText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

interface Props {
  userName?: string;
}

export default function AIAssistant({ userName }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm0',
      role: 'ai',
      text: `Привіт${userName ? ', ' + userName.split(' ')[0] : ''}! 👋 Я LifeSync AI — ваш персональний асистент. Я можу допомогти з плануванням, аналізом фінансів та оптимізацією розкладу. Що бажаєте?`,
      time: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isPro] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const freeCount = messages.filter(m => m.role === 'user').length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const send = (text: string) => {
    if (!text.trim()) return;
    if (!isPro && freeCount >= 3) return;

    const userMsg: Message = {
      id: `m${Date.now()}`,
      role: 'user',
      text,
      time: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const reply = QUICK_ANSWERS[text] || `Розуміється! Аналізую ваші дані… 🔍\n\nОброблено запит: "${text}"\n\nДля детального аналізу та персоналізованих звітів рекомендую оновитися до Pro-плану — це надасть необмежений доступ до AI-аналітики, автоматичну перебудову розкладу та персональні insights.`;
      const aiMsg: Message = {
        id: `m${Date.now() + 1}`,
        role: 'ai',
        text: reply,
        time: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex h-full section-enter">
      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="glass border-b border-white/6 px-5 py-3 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xl">
            🤖
          </div>
          <div>
            <h2 className="font-display font-700 text-white text-sm">LifeSync AI</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400">Онлайн · NLP v3</span>
            </div>
          </div>
          <div className="ml-auto">
            {isPro ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-display font-600 shimmer text-white">PRO</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">{freeCount}/3 запити (Free)</span>
                <button className="px-3 py-1 rounded-full text-xs font-display font-500 bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-all">
                  ✦ Оновити до Pro
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-sm shrink-0 mt-0.5">
                  🤖
                </div>
              )}
              <div className={`max-w-xl ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'} px-4 py-3`}>
                <p
                  className="text-sm text-slate-100 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                />
                <p className="text-xs text-slate-500 font-mono mt-1.5">{msg.time}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs font-display font-600 text-white shrink-0 mt-0.5">
                  {userName ? userName.slice(0, 2).toUpperCase() : 'U'}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-sm shrink-0">🤖</div>
              <div className="bubble-ai px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="glass border-t border-white/6 p-4">
          {!isPro && freeCount >= 3 && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 flex items-center gap-2">
              <span>⚠️</span> Вичерпано безкоштовні запити. Оновіться до Pro для необмежених діалогів.
              <button className="ml-auto px-2 py-0.5 rounded-full bg-violet-600 text-white text-xs">Оновити</button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              disabled={!isPro && freeCount >= 3}
              placeholder="Запитайте про задачі, фінанси або розклад…"
              className="flex-1 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors disabled:opacity-40"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || (!isPro && freeCount >= 3)}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: Suggestions & Insights */}
      <div className="w-72 shrink-0 glass border-l border-white/6 flex flex-col">
        <div className="px-4 py-4 border-b border-white/6">
          <h3 className="font-display font-600 text-white text-sm">✦ Швидкі питання</h3>
          <p className="text-xs text-slate-500 mt-0.5">Натисніть щоб надіслати</p>
        </div>
        <div className="p-3 space-y-2">
          {AI_SUGGESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => send(q)}
              disabled={!isPro && freeCount >= 3}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-slate-300 bg-white/4 border border-white/6 hover:border-violet-500/30 hover:bg-violet-600/10 hover:text-violet-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-white/6 mt-2">
          <h3 className="font-display font-600 text-white text-sm mb-3">📊 AI Insights</h3>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-white/3">
              <span className="text-base mt-0.5">💡</span>
              <div>
                <p className="text-xs text-slate-200 font-500">Почніть додавати дані</p>
                <p className="text-xs text-slate-500">AI аналітика стане доступна після заповнення задач та фінансів</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pro upsell */}
        {!isPro && (
          <div className="m-3 mt-auto p-4 rounded-xl bg-gradient-to-br from-violet-900/40 to-cyan-900/20 border border-violet-500/25">
            <div className="text-sm font-display font-600 text-white mb-1">✦ LifeSync Pro</div>
            <ul className="text-xs text-slate-400 space-y-1 mb-3">
              <li>• Необмежені діалоги з AI</li>
              <li>• Авто-оптимізація розкладу</li>
              <li>• Персональна аналітика</li>
            </ul>
            <button className="w-full py-2 rounded-lg text-xs font-display font-600 shimmer text-white hover:opacity-90 transition-opacity">
              Спробувати Pro безкоштовно →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
