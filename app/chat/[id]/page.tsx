'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: string;
}

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const [agentId, setAgentId] = useState<string>('');
  const [agent, setAgent] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    params.then(p => setAgentId(p.id));
  }, [params]);

  useEffect(() => {
    if (!agentId) return;

    Promise.all([
      fetch(`/api/agents/${agentId}`).then(r => r.json()),
      fetch(`/api/agents/${agentId}/message?limit=100`).then(r => r.json()),
    ])
      .then(([agentData, msgData]) => {
        setAgent(agentData);
        setMessages(msgData.messages || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput('');

    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: tempId, content, role: 'user', createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`/api/agents/${agentId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (data.status === 'received') {
        pollForResponse(tempId);
      } else if (data.message) {
        const assistantMsg = data.message;
        setMessages(prev => [
          ...prev.map(m => (m.id === tempId ? { ...m, id: data.userMessage?.id || tempId } : m)),
          {
            id: assistantMsg.id || `resp_${Date.now()}`,
            content: assistantMsg.content || '...',
            role: 'assistant',
            createdAt: assistantMsg.createdAt || new Date().toISOString(),
          },
        ]);
        setSending(false);
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          content: `Error: ${err.message}`,
          role: 'assistant',
          createdAt: new Date().toISOString(),
        },
      ]);
      setSending(false);
    } finally {
      inputRef.current?.focus();
    }
  };

  const pollForResponse = (userMsgTempId: string) => {
    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setSending(false);
        return;
      }
      try {
        const res = await fetch(`/api/agents/${agentId}/message?limit=1&offset=0`);
        const data = await res.json();
        const msgs = data.messages || [];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          setMessages(prev => {
            const filtered = prev.filter(m => !m.id.startsWith('temp_') || m.id !== userMsgTempId);
            const hasResponse = prev.some(m => m.id === lastMsg.id);
            if (hasResponse) return prev;
            return [...filtered, lastMsg];
          });
          clearInterval(interval);
          setSending(false);
        }
      } catch {
        // continue polling
      }
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-destructive">{error || 'Agent not found'}</p>
          <a href="/" className="text-xs text-primary hover:underline">← Back to agents</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen pt-14">
      <div className="border-b border-border/50 bg-background px-6 h-12 flex items-center gap-3 shrink-0">
        <a href="/" className="text-muted-foreground hover:text-foreground text-xs transition-colors">
          ←
        </a>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {agent.name?.charAt(0)}
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-medium truncate">{agent.name}</h1>
          <p className="text-[11px] text-muted-foreground capitalize leading-none">{agent.kind}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-20">
            Send a message to start chatting with {agent.name}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xl rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/50 bg-background p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            rows={1}
            className="flex-1 text-sm bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none min-h-[40px] max-h-[120px] transition-all"
            style={{ height: 'auto' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="bg-primary text-primary-foreground text-sm font-medium px-4 h-10 rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
