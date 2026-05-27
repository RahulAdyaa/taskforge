import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
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
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display italic text-4xl md:text-5xl">Privacy Policy</h1>
            <p className="font-mono text-xs text-black/50 dark:text-zinc-400 mt-2">Last Updated: May 27, 2026</p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8 font-sans leading-relaxed text-black/80 dark:text-zinc-300">
          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when creating an account, editing your profile, or creating and assigning tasks. This includes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Credentials:</strong> Full name, email address, password, and optional username handle.</li>
              <li><strong>Task Data:</strong> Project descriptions, task details, assignees, deadlines, and dashboard status changes.</li>
              <li><strong>Session Telemetry:</strong> Connection metadata, browser agents, and IP logs collected during authentication cycles.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">2. How We Use Your Information</h2>
            <p>
              Your telemetry and account data are utilized solely to provision, optimize, and maintain the TaskForge platform services:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Facilitating secure session ingestion and account recoveries (via One-Time Password tokens).</li>
              <li>Syncing and updating your active workspaces and project standups in real-time.</li>
              <li>Ensuring operational security, preventing malicious requests, and satisfying compliance requirements.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">3. Data Retention and Security</h2>
            <p>
              We prioritize data preservation and platform integrity. Credentials are fully hashed via industry-grade algorithms (bcrypt) and protected with token-based access expiration. Session logs are cached temporarily and deleted when inactive.
            </p>
            <p>
              However, note that no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute database security.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">4. Cookies and Local Storage</h2>
            <p>
              We utilize secure, HttpOnly cookies for session state persistency (RefreshToken) and browser Local Storage for temporary verification parameters. These technologies allow the application to automatically sign you back in during navigation.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display italic text-2xl dark:text-white">5. Your Rights and Choices</h2>
            <p>
              You retain full control of your workspaces. You may update your profile details, toggle account preferences, or delete your credentials entirely via the Account Settings dashboard.
            </p>
          </section>

          <section className="space-y-4 pt-6 border-t border-[#E8E4DD] dark:border-zinc-800/80">
            <p className="font-mono text-xs text-black/50 dark:text-zinc-400">
              For security audits or privacy-related inquiries, contact our protocol administrators at{' '}
              <a href="mailto:privacy@taskforge.com" className="text-signal-red hover:underline">
                privacy@taskforge.com
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
