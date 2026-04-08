'use client';

import { useEffect, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  description?: string;
  kind: string;
  createdAt: string;
  isPublic: boolean;
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agents')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setAgents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const deleteAgent = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-muted-foreground">Loading agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-destructive">Failed to load agents</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const userAgents = agents.filter(a => !a.isPublic);

  return (
    <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Your Agents</h1>
        <p className="text-sm text-muted-foreground">
          Create emotional AI agents with real memory and personality
        </p>
      </div>

      {userAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-1.5">No agents yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Create your first emotional AI agent with a unique personality and real memory
          </p>
          <a
            href="/create"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-5 h-10 rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Agent
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {userAgents.map(agent => (
            <a
              key={agent.id}
              href={`/chat/${agent.id}`}
              className="group block p-5 rounded-xl border border-border/50 bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {agent.name}
                  </h3>
                  <span className="text-xs text-muted-foreground capitalize">{agent.kind}</span>
                </div>
              </div>
              {agent.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                  {agent.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Click to chat</span>
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteAgent(agent.id, agent.name);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
