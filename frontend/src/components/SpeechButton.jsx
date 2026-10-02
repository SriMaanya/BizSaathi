import React from 'react';
import { translations } from '../translations';

export default function SpeechButton({ isSpeaking, onToggleSpeak, t }) {
  const activeT = t || translations.en;

  return (
    <button
      type="button"
      className={`speech-btn ${isSpeaking ? 'is-speaking' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggleSpeak();
      }}
      title={isSpeaking ? (activeT.stopSpeaking || "Stop reading") : (activeT.speakResponse || "Listen to advice")}
      aria-label={isSpeaking ? (activeT.stopSpeaking || "Stop reading") : (activeT.speakResponse || "Listen to advice")}
    >
      {isSpeaking ? (
        <span className="speech-icon-wrapper active">
          {/* Animated playing wave bars */}
          <span className="speech-wave-bar bar-1"></span>
          <span className="speech-wave-bar bar-2"></span>
          <span className="speech-wave-bar bar-3"></span>
          <span className="speech-stop-symbol" title="Stop">⏹️</span>
        </span>
      ) : (
        <span className="speech-icon-wrapper" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </span>
      )}
    </button>
  );
}
