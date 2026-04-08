import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Blaniel - Emotional AI',
  description: 'Create and interact with emotional AI agents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
            <a href="/" className="flex items-center gap-2.5 shrink-0">
              <img
                src="/logo.png"
                alt="Blaniel"
                className="w-8 h-8 rounded-lg object-contain"
              />
              <span className="text-base font-bold tracking-tight">Blaniel</span>
            </a>
            <div className="flex-1" />
            <a
              href="/create"
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 h-9 rounded-lg hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create
            </a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
