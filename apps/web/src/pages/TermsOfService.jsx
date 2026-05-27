import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-off-white dark:bg-[#09090B] text-black dark:text-zinc-100 transition-colors duration-300">
      {/* Navigation */}
      <header className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between border-b border-[#E8E4DD] dark:border-zinc-800/80">
        <Link to="/" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider hover:text-signal-red transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="font-display text-xl tracking-tight font-bold">TASKFORGE</div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-signal-red/10 border border-signal-red/20 rounded-2xl text-signal-red">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display italic text-4xl md:text-5xl">Terms of Service</h1>
            <p className="font-mono text-xs text-black/50 dark:text-zinc-400 mt-2">Last Updated: May 27, 2026</p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8 font-sans leading-relaxed text-black/80 dark:text-zinc-300">
          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing, registering, or operating workspace nodes within TaskForge, you agree to comply with and be bound by these terms. If you do not accept these constraints, you are restricted from utilizing the services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">2. User Accounts and Operations</h2>
            <p>
              When establishing an account handle and profile space on TaskForge:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must supply precise credentials, including a valid email mapping.</li>
              <li>You are solely responsible for safeguard tokens, passwords, and sessions.</li>
              <li>You agree to notify security administrators immediately upon identifying any unauthorized session ingestion.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">3. Acceptable Use Policy</h2>
            <p>
              Users are prohibited from using the platform, boards, or real-time standups to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Engage in malicious network telemetry injection or platform overload requests.</li>
              <li>Violate any local, national, or international regulations.</li>
              <li>Upload files, descriptions, or tasks containing malicious software, viruses, or spyware.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">4. Platform Modifications and Uptime</h2>
            <p>
              TaskForge reserves the right to modify, refactor, or temporarily suspend access pipelines for database maintenance or security patching. We make no warranty that operations will be uninterrupted or error-free.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">5. Termination</h2>
            <p>
              We reserve the right to suspend or terminate access permissions to any workspace or user node without prior notice for violations of these Terms.
            </p>
          </section>

          <section className="space-y-4 pt-6 border-t border-[#E8E4DD] dark:border-zinc-800/80">
            <p className="font-mono text-xs text-black/50 dark:text-zinc-400">
              For any questions regarding legal terms or operational licensing, contact{' '}
              <a href="mailto:support@taskforge.com" className="text-signal-red hover:underline">
                support@taskforge.com
              </a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 border-t border-[#E8E4DD] dark:border-zinc-800/80 text-center font-mono text-[10px] text-black/40 dark:text-zinc-500">
        © 2026 TASKFORGE. All rights reserved.
      </footer>
    </div>
  );
}
