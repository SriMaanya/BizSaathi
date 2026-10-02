import React, { useState, useEffect, useRef, useCallback } from 'react';
import Message from './Message';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { translations } from '../translations';

export default function ChatWindow({ 
  messages, 
  isLoading, 
  isTyping, 
  selectedLanguage = 'en', 
  t 
}) {
  const [missingVoiceNotice, setMissingVoiceNotice] = useState(null);
  const bottomRef = useRef(null);
  const activeT = t || translations.en;
  const loading = isLoading !== undefined ? isLoading : isTyping;

  const handleMissingVoice = useCallback((langCode) => {
    const notice = activeT.voiceMissingInBrowser || 
      "Voice for this language is not built into Google Chrome. Please open BizSaathi in Microsoft Edge for full natural voice support.";
    setMissingVoiceNotice(notice);

    const timer = setTimeout(() => {
      setMissingVoiceNotice(null);
    }, 8500);
    return () => clearTimeout(timer);
  }, [activeT]);

  const {
    speakingMessageId,
    speak,
    stop,
    isSupported: isSpeechSupported,
  } = useSpeechSynthesis({ onMissingVoice: handleMissingVoice });

  // Stop active speech if messages are cleared or reset
  useEffect(() => {
    if (messages.length === 0) {
      stop();
    }
  }, [messages.length, stop]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleToggleSpeak = (msgId, rawText) => {
    speak(msgId, rawText, selectedLanguage);
  };

  return (
    <div className="chat-window">
      {missingVoiceNotice && (
        <div className="voice-missing-banner" role="alert">
          <span className="banner-icon">🌐</span>
          <span className="banner-text">{missingVoiceNotice}</span>
          <button 
            type="button" 
            className="banner-close-btn" 
            onClick={() => setMissingVoiceNotice(null)}
            title="Dismiss"
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="empty-chat-hint">
          <p>{activeT.emptyHint}</p>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((msg) => (
            <Message 
              key={msg.id} 
              message={msg} 
              t={activeT}
              isSpeaking={speakingMessageId === msg.id}
              onToggleSpeak={(msg.sender !== 'user' && msg.role !== 'user') ? () => handleToggleSpeak(msg.id, msg.text) : null}
              isSpeechSupported={isSpeechSupported}
            />
          ))}

          {loading && (
            <div className="message-row ai-row typing-row">
              <div className="avatar ai-avatar">
                <span className="avatar-icon">💡</span>
              </div>
              <div className="message-bubble ai-bubble typing-bubble">
                <div className="ai-bubble-header">
                  <div className="ai-bubble-title-group">
                    <span className="ai-author-name">{activeT.appName || "BizSaathi"}</span>
                    <span className="ai-typing-text">⏳ BizSaathi is thinking...</span>
                  </div>
                </div>
                <div className="typing-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
