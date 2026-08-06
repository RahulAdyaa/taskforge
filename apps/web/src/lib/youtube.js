/**
 * YouTube Link Helper & Parser
 */

// Regex to extract YouTube Video ID from various URL formats
// e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ, https://youtu.be/dQw4w9WgXcQ, shorts, embed
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;

export function extractYouTubeUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = [];
  let match;
  // Reset index
  YOUTUBE_REGEX.lastIndex = 0;
  while ((match = YOUTUBE_REGEX.exec(text)) !== null) {
    const fullUrl = match[0];
    const videoId = match[1];
    if (!matches.some(m => m.videoId === videoId)) {
      matches.push({
        fullUrl,
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`
      });
    }
  }
  return matches;
}
