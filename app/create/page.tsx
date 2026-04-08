'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BEHAVIORS = [
  { value: 'none', label: 'None', desc: 'No preset behavior' },
  { value: 'ANXIOUS_ATTACHMENT', label: 'Anxious Attachment', desc: 'Clingy, fear of abandonment' },
  { value: 'AVOIDANT_ATTACHMENT', label: 'Avoidant Attachment', desc: 'Distant, fears intimacy' },
  { value: 'DISORGANIZED_ATTACHMENT', label: 'Disorganized', desc: 'Push-pull dynamics, unpredictable' },
  { value: 'YANDERE_OBSESSIVE', label: 'Obsessive', desc: 'Extreme possessiveness and devotion' },
  { value: 'BORDERLINE_PD', label: 'Borderline PD', desc: 'Intense emotional swings, splitting' },
  { value: 'NARCISSISTIC_PD', label: 'Narcissistic PD', desc: 'Grandiosity, need for admiration' },
  { value: 'CODEPENDENCY', label: 'Codependency', desc: 'Excessive reliance, self-sacrifice' },
  { value: 'random_secret', label: 'Random Secret', desc: 'AI picks based on personality text' },
];

export default function CreateAgentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identity: true,
    personality: true,
    advanced: false,
  });

  const [form, setForm] = useState({
    name: '',
    kind: 'companion', // fixed — companion is the only mode
    personality: '',
    purpose: '',
    tone: '',
    nsfwMode: false,
    allowDevelopTraumas: false,
    initialBehavior: 'none',
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details?.[0]?.message || `HTTP ${res.status}`);
      }

      router.push(`/chat/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 pt-24 pb-16">
      <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back
      </a>

      <div className="mt-6 mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Create Agent</h1>
        <p className="text-sm text-muted-foreground">
          Configure your emotional AI agent. All fields feed into the LLM profile generator.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-lg mb-6 font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Identity ── */}
        <Section
          title="Identity"
          isOpen={expandedSections.identity}
          onToggle={() => toggleSection('identity')}
        >
          <div className="space-y-4">
            <div>
              <FieldLabel required>Name</FieldLabel>
              <Input
                required
                maxLength={100}
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))}
                placeholder="Agent name..."
              />
              <FieldHint>1–100 characters. Sanitized for Unicode homoglyphs.</FieldHint>
            </div>
          </div>
        </Section>

        {/* ── Personality ── */}
        <Section
          title="Personality & Prompting"
          isOpen={expandedSections.personality}
          onToggle={() => toggleSection('personality')}
        >
          <div className="space-y-4">
            <div>
              <FieldLabel>Personality</FieldLabel>
              <Textarea
                maxLength={500}
                rows={4}
                value={form.personality}
                onChange={v => setForm(f => ({ ...f, personality: v }))}
                placeholder="Describe personality traits, background, behavioral quirks, emotional patterns... The richer the description, the more nuanced the generated profile."
              />
              <FieldHint>Max 500 chars. Seeds the LLM profile generator and influences random behavior selection.</FieldHint>
            </div>

            <div>
              <FieldLabel>Purpose</FieldLabel>
              <Input
                maxLength={500}
                value={form.purpose}
                onChange={v => setForm(f => ({ ...f, purpose: v }))}
                placeholder="e.g. Creative writing partner, emotional support, roleplay companion..."
              />
              <FieldHint>Falls back as description if personality is empty.</FieldHint>
            </div>

            <div>
              <FieldLabel>Tone</FieldLabel>
              <Input
                maxLength={200}
                value={form.tone}
                onChange={v => setForm(f => ({ ...f, tone: v }))}
                placeholder="e.g. Warm, mysterious, playful, clinical..."
              />
              <FieldHint>Passed directly to the LLM profile generator.</FieldHint>
            </div>
          </div>
        </Section>

        {/* ── Advanced ── */}
        <Section
          title="Advanced Configuration"
          isOpen={expandedSections.advanced}
          onToggle={() => toggleSection('advanced')}
        >
          <div className="space-y-4">
            <div>
              <FieldLabel>Initial Behavior Profile</FieldLabel>
              <div className="grid grid-cols-1 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {BEHAVIORS.map(b => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, initialBehavior: b.value }))}
                    className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
                      form.initialBehavior === b.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted hover:border-border'
                    }`}
                  >
                    <span className="font-mono font-medium">{b.label}</span>
                    <span className="text-muted-foreground block mt-0.5 leading-tight">{b.desc}</span>
                  </button>
                ))}
              </div>
              <FieldHint>Creates a BehaviorProfile + ProgressionState. "Random Secret" auto-selects based on personality keywords.</FieldHint>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ToggleField
                label="NSFW Mode"
                description="Enables unrestricted content generation"
                value={form.nsfwMode}
                onChange={v => setForm(f => ({ ...f, nsfwMode: v }))}
              />
              <ToggleField
                label="Develop Traumas"
                description="Allow dynamic behavioral evolution"
                value={form.allowDevelopTraumas}
                onChange={v => setForm(f => ({ ...f, allowDevelopTraumas: v }))}
              />
            </div>
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || !form.name}
            className="w-full bg-primary text-primary-foreground text-sm font-semibold h-10 rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {submitting ? 'Generating profile...' : 'Create Agent'}
          </button>
          {!form.name && (
            <p className="text-[11px] text-muted-foreground text-center mt-2">Name is required</p>
          )}
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent transition-colors text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-4 py-4 border-t border-border/50 bg-card/50">{children}</div>}
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium mb-1.5 text-foreground">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground mt-1 font-mono leading-tight">{children}</p>;
}

function Input({
  value,
  onChange,
  placeholder,
  maxLength,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      required={required}
      maxLength={maxLength}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm bg-muted border border-border rounded-lg px-3 h-10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      maxLength={maxLength}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all resize-y min-h-[80px]"
    />
  );
}

function ToggleField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`p-3 rounded-lg border text-left transition-all ${
        value ? 'border-primary bg-primary/10' : 'border-border bg-muted'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <div
          className={`w-8 h-[18px] rounded-full transition-colors relative ${
            value ? 'bg-primary' : 'bg-border'
          }`}
        >
          <div
            className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
              value ? 'left-[15px]' : 'left-[2px]'
            }`}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{description}</p>
    </button>
  );
}
