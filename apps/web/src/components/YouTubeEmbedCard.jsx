import React, { useState } from 'react';
import { Play, ExternalLink, X } from 'lucide-react';

export default function YouTubeEmbedCard({ video }) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!video || !video.videoId) return null;

  return (
    <div className="my-3 rounded-2xl border border-red-500/20 bg-[#1A1A1A] text-white overflow-hidden shadow-lg transition-all hover:border-red-500/40">
      {/* Header Bar */}
      <div className="px-4 py-2 bg-red-950/40 border-b border-red-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-500">
          <svg className="w-4 h-4 fill-current text-red-500" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span>YouTube Video Preview</span>
        </div>
        <a
          href={video.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-mono text-white/60 hover:text-white transition-colors"
        >
          <span>Open on YouTube</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Main Preview / Player Area */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
        {isPlaying ? (
          <div className="relative w-full h-full">
            <iframe
              src={video.embedUrl}
              title="YouTube Video"
              className="w-full h-full border-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setIsPlaying(false)}
              className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white p-1.5 rounded-full z-10 transition-all border border-white/20"
              title="Close Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsPlaying(true)}>
            <img
              src={video.thumbnailUrl}
              alt="YouTube Video Thumbnail"
              className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-red-600 group-hover:bg-red-500 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-3 left-3 bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded-md border border-white/10 backdrop-blur-sm">
              Click to Play Inline
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
