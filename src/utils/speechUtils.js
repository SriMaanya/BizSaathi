/**
 * Speech utility functions, language mappings, and audio chunking for Web Speech API
 */

export const VOICE_LANGUAGE_MAP = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
};

const LANGUAGE_NAMES = {
  en: ['english', 'en-us', 'en-in', 'en-gb'],
  te: ['telugu', 'తెలుగు', 'శ్రుతి', 'మోహన్'],
  hi: ['hindi', 'हिन्दी', 'स्वरा', 'मधुर'],
  ta: ['tamil', 'தமிழ்', 'பல்லவி', 'வள்ளுவர்'],
  kn: ['kannada', 'ಕನ್ನಡ', 'ಗಗನ್', 'ಸ್ವಪ್ನಾ'],
  ml: ['malayalam', 'മലയാളം', 'ശോഭന', 'മിഥുൻ'],
  mr: ['marathi', 'मराठी', 'आरोही', 'मनोहर'],
  bn: ['bengali', 'বাংলা', 'তনিমা', 'বশির'],
  gu: ['gujarati', 'ગુજરાતી', 'ધ્વનિ', 'નિરંજન'],
  pa: ['punjabi', 'ਪੰਜਾਬੀ', 'ਹਰਮਨ', 'ਗੁਰਪ੍ਰੀਤ'],
};

/**
 * Strips markdown and special formatting so speech synthesis reads text naturally
 */
export function cleanMarkdownForSpeech(text) {
  if (!text) return '';

  return text
    // Remove markdown headers (#, ##, ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italic markers (**text**, *text*, __text__, _text_)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove inline code and code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Replace markdown links [label](url) with just label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Clean bullet points (* item, - item)
    .replace(/^\s*[\*\-]\s+/gm, '')
    // Remove decorative separator lines (---, ***, ===)
    .replace(/^\s*[-*=]{3,}\s*$/gm, '')
    // Clean repetitive spaces or extra line breaks
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Split text into speech chunks to avoid browser audio buffer timeouts
 */
export function splitTextIntoSpeechChunks(text, maxChunkLen = 180) {
  if (!text) return [];
  const clean = cleanMarkdownForSpeech(text);
  if (!clean) return [];

  const sentences = clean.split(/(?<=[.!?\n])\s+/);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;

    if (!currentChunk) {
      currentChunk = s;
    } else if (currentChunk.length + s.length + 1 <= maxChunkLen) {
      currentChunk += ' ' + s;
    } else {
      chunks.push(currentChunk);
      currentChunk = s;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [clean];
}

/**
 * Find the closest matching voice for a given language code
 */
export function findBestVoice(voices, languageCode) {
  if (!voices || voices.length === 0) return null;

  const targetLang = (VOICE_LANGUAGE_MAP[languageCode] || 'en-IN').toLowerCase();
  const langPrefix = (languageCode || 'en').toLowerCase();

  // 1. Exact match (e.g. "te-in" or "en-in")
  const exact = voices.find(v => {
    const vLang = (v.lang || '').replace('_', '-').toLowerCase();
    return vLang === targetLang;
  });
  if (exact) return exact;

  // 2. Starts with target language prefix (e.g. "te", "hi", "ta", "kn", "en")
  const prefixMatch = voices.find(v => {
    const vLang = (v.lang || '').replace('_', '-').toLowerCase();
    return vLang.startsWith(langPrefix);
  });
  if (prefixMatch) return prefixMatch;

  // 3. Search voice name for language name keywords
  const keywords = LANGUAGE_NAMES[langPrefix] || [];
  const nameMatch = voices.find(v => {
    const name = (v.name || '').toLowerCase();
    return keywords.some(k => name.includes(k));
  });
  if (nameMatch) return nameMatch;

  // 4. For English, fallback to any English voice or default
  if (langPrefix === 'en') {
    const anyEnglish = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
    if (anyEnglish) return anyEnglish;
    return voices.find(v => v.default) || voices[0] || null;
  }

  // 5. For non-English languages:
  // Do NOT force an incompatible English voice (e.g. David / Zira) onto Indic scripts.
  // Returning null allows the browser's native synthesis engine to handle targetLang directly.
  return null;
}
