import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Globe, ArrowLeft, ShieldAlert, Award, FileText, 
  Share2, Download, Check 
} from 'lucide-react';

const Github = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

const Linkedin = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);

const Twitter = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
  </svg>
);
import api from '../lib/axios';
import toast from 'react-hot-toast';

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchPublicProfile = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/settings/public/${username}`);
        setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicProfile();
  }, [username]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Profile URL copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Basic text export representation of the profile
    if (!profile) return;
    const content = `
========================================
TASKFORGE PUBLIC PORTFOLIO
========================================
Name: ${profile.name}
Handle: @${profile.username}
Headline: ${profile.headline || 'N/A'}
Experience: ${profile.experienceLevel || 'Mid-Level'}
Joined: ${new Date(profile.createdAt).toLocaleDateString()}

BIO:
${profile.bio || 'No bio provided.'}

TECH STACK:
${profile.techStack?.join(', ') || 'None'}

SKILLS & EXPERTISE:
${profile.skills?.join(', ') || 'None'}

CERTIFICATIONS:
${profile.certifications?.join(', ') || 'None'}

PORTFOLIO LINKS:
- GitHub: ${profile.githubUrl || 'N/A'}
- LinkedIn: ${profile.linkedinUrl || 'N/A'}
- Portfolio: ${profile.portfolioUrl || 'N/A'}
- Twitter: ${profile.twitterUrl || 'N/A'}
========================================
Generated via TaskForge
    `;
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${profile.username}_profile.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-off-white dark:bg-[#0D0D0D] flex items-center justify-center font-mono text-xs animate-pulse">
        Retrieving profile records...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-off-white dark:bg-[#0D0D0D] flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-signal-red mb-4" />
        <h2 className="font-display font-extrabold text-2xl tracking-tight mb-2">Profile Confidential</h2>
        <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 max-w-sm mb-6">
          This user profile directory is either set to Private or does not exist.
        </p>
        <Link to="/" className="btn-brutal bg-black text-white px-6 py-3 rounded-xl text-xs font-bold">
          Back to TaskForge
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-off-white dark:bg-[#0D0D0D] text-black dark:text-white py-12 px-4 transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        
        {/* Back Link */}
        <Link to="/app" className="inline-flex items-center gap-2 text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white transition-colors mb-6 font-mono text-xs">
          <ArrowLeft className="w-4 h-4" />
          <span>TaskForge App</span>
        </Link>

        {/* Banner */}
        <div className="relative h-48 rounded-t-[2rem] overflow-hidden border-t border-l border-r border-[#E8E4DD] dark:border-[#2A2A2A] bg-gradient-to-r from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-900 shadow-sm flex items-end">
          {profile.bannerUrl && (
            <img src={profile.bannerUrl} alt="Cover Banner" className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>

        {/* Content Panel */}
        <div className="bg-white dark:bg-[#1A1A1A] border-b border-l border-r border-[#E8E4DD] dark:border-[#2A2A2A] rounded-b-[2rem] p-10 shadow-2xl relative">
          
          {/* Avatar floating */}
          <div className="absolute -top-16 left-10 w-28 h-28 rounded-2xl overflow-hidden border-4 border-white dark:border-[#1A1A1A] bg-neutral-900 shadow-lg">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-white text-3xl font-display">
                {profile.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mb-6 pt-2">
            <button
              onClick={handleShare}
              className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 p-2.5 rounded-xl transition-all"
              title="Share Profile"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 p-2.5 rounded-xl transition-all"
              title="Download Portfolio Data"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 mb-8">
            <h1 className="font-display font-extrabold text-4xl tracking-tight mb-1">{profile.name}</h1>
            <p className="font-mono text-xs text-var-accent font-bold mb-3">@{profile.username}</p>
            {profile.headline && (
              <p className="font-sans font-bold text-base text-black/75 dark:text-[#E8E4DD]/75 mb-4">
                {profile.headline}
              </p>
            )}
            <div className="flex gap-1.5 font-mono text-[9px] text-black/40 dark:text-[#E8E4DD]/40">
              <span>Experience: {profile.experienceLevel}</span>
              <span>•</span>
              <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mb-8 border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
              <h3 className="font-sans font-bold text-sm mb-3">About User</h3>
              <p className="font-sans text-sm text-black/70 dark:text-[#E8E4DD]/70 whitespace-pre-line leading-relaxed">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Socials & Portfolios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
            <div>
              <h3 className="font-display font-bold text-sm mb-4">Connected Networks</h3>
              <div className="space-y-3">
                {profile.githubUrl && (
                  <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white transition-colors">
                    <Github className="w-4 h-4" />
                    <span>GitHub Profile</span>
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white transition-colors">
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn Profile</span>
                  </a>
                )}
                {profile.twitterUrl && (
                  <a href={profile.twitterUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white transition-colors">
                    <Twitter className="w-4 h-4" />
                    <span>Twitter/X</span>
                  </a>
                )}
                {profile.portfolioUrl && (
                  <a href={profile.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white transition-colors">
                    <Globe className="w-4 h-4" />
                    <span>Personal Portfolio</span>
                  </a>
                )}
                {!profile.githubUrl && !profile.linkedinUrl && !profile.twitterUrl && !profile.portfolioUrl && (
                  <span className="font-mono text-xs text-black/40">No external links set.</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display font-bold text-sm mb-4">Certifications</h3>
              <div className="space-y-2">
                {profile.certifications?.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-sans">
                    <Award className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>{c}</span>
                  </div>
                ))}
                {(!profile.certifications || profile.certifications.length === 0) && (
                  <span className="font-mono text-xs text-black/40">No certifications recorded.</span>
                )}
              </div>
            </div>
          </div>

          {/* Tech Stack & Skills */}
          <div className="border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6 space-y-6">
            <div>
              <h3 className="font-sans font-bold text-sm mb-3">Core Tech Stack</h3>
              <div className="flex flex-wrap gap-2">
                {profile.techStack?.map((tech, idx) => (
                  <span key={idx} className="px-3.5 py-1.5 bg-black text-white dark:bg-white dark:text-black font-mono text-xs rounded-xl">
                    {tech}
                  </span>
                ))}
                {(!profile.techStack || profile.techStack.length === 0) && (
                  <span className="font-mono text-xs text-black/40">No technologies listed.</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-sans font-bold text-sm mb-3">Specialized Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills?.map((skill, idx) => (
                  <span key={idx} className="px-3.5 py-1 bg-black/5 dark:bg-white/10 rounded-xl font-mono text-xs">
                    {skill}
                  </span>
                ))}
                {(!profile.skills || profile.skills.length === 0) && (
                  <span className="font-mono text-xs text-black/40">No specialization tags.</span>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
