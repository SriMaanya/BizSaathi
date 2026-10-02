import React, { useState, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { translations } from '../translations';

export default function ChatInput({ 
  inputText, 
  setInputText, 
  onSendMessage, 
  disabled, 
  selectedLanguage = 'en',
  t 
}) {
  const [statusToast, setStatusToast] = useState(null);
  const activeT = t || translations[selectedLanguage] || translations.en;
  const baseTextRef = useRef('');

  const handleSpeechResult = useCallback((sessionSpeechText) => {
    if (!sessionSpeechText) return;
    const base = (baseTextRef.current || '').trim();
    const cleanSpeech = sessionSpeechText.trim();
    const combined = base ? `${base} ${cleanSpeech}` : cleanSpeech;
    setInputText(combined);
  }, [setInputText]);

  const handleSpeechError = useCallback((err) => {
    let msg = activeT.noSpeechDetected || 'No speech was detected. Please try again.';
    if (err === 'unsupported') {
      msg = activeT.voiceNotSupported || 'Voice input is not supported in this browser. Please type your message.';
    } else if (err === 'micDenied') {
      msg = activeT.micDenied || 'Microphone permission was denied. Please allow microphone access in your browser settings.';
    } else if (err === 'noSpeech') {
      msg = activeT.noSpeechDetected || 'No speech was detected. Please try speaking again.';
    } else if (err === 'network') {
      msg = 'Network issue occurred during speech recognition. Please check your connection.';
    }

    setStatusToast({
      message: msg,
      isError: true,
    });

    const timer = setTimeout(() => {
      setStatusToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [activeT]);

  const {
    isListening,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    languageCode: selectedLanguage,
    onResult: handleSpeechResult,
    onError: handleSpeechError,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    if (isListening) {
      stopListening();
    }
    baseTextRef.current = '';
    onSendMessage(inputText.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleMicClick = () => {
    if (disabled) return;

    if (isListening) {
      stopListening();
    } else {
      setStatusToast(null);
      baseTextRef.current = (inputText || '').trim();
      startListening();
    }
  };

  const canSend = inputText.trim().length > 0 && !disabled;

  return (
    <div className="chat-input-wrapper">
      {/* Listening Banner */}
      {isListening && (
        <div className="voice-listening-banner" role="status" aria-live="polite">
          <div className="listening-indicator">
            <span className="listening-pulse-dot"></span>
            <span className="listening-wave-bar"></span>
            <span className="listening-wave-bar"></span>
            <span className="listening-wave-bar"></span>
          </div>
          <span className="listening-text">{activeT.voiceListening || "Listening... Speak now"}</span>
          <button 
            type="button" 
            className="listening-cancel-btn"
            onClick={stopListening}
            title={activeT.voiceListeningTitle || "Stop listening"}
            aria-label={activeT.voiceListeningTitle || "Stop listening"}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error or Notice Toast */}
      {statusToast && (
        <div className={`mic-notice-toast ${statusToast.isError ? 'error-toast' : ''}`} role="status">
          <span className="toast-icon">{statusToast.isError ? '⚠️' : '🎙️'}</span>
          <span>{statusToast.message}</span>
        </div>
      )}

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className={`input-container ${disabled ? 'disabled' : ''} ${isListening ? 'input-listening' : ''}`}>
          <input
            type="text"
            className="chat-text-input"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (!isListening) {
                baseTextRef.current = e.target.value.trim();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? (activeT.voiceListening || "Listening... Speak now") : activeT.inputPlaceholder}
            disabled={disabled}
            autoComplete="off"
            aria-label={activeT.inputPlaceholder}
          />

          <div className="input-actions">
            <button
              type="button"
              className={`action-icon-btn mic-btn ${isListening ? 'is-listening' : ''}`}
              onClick={handleMicClick}
              disabled={disabled}
              title={isListening ? (activeT.voiceListeningTitle || "Stop listening") : (activeT.voiceInputTitle || "Voice input")}
              aria-label={isListening ? (activeT.voiceListeningTitle || "Stop listening") : (activeT.voiceInputTitle || "Voice input")}
            >
              {isListening ? (
                <span className="mic-stop-icon" aria-hidden="true">⏹️</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>

            <button
              type="submit"
              className={`action-icon-btn send-btn ${canSend ? 'active' : ''}`}
              disabled={!canSend}
              title={activeT.send}
              aria-label={activeT.send}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      </form>
      <div className="input-disclaimer">
        <span>{activeT.disclaimer || "BizSaathi provides guidance for educational and planning purposes only. Please verify applicable legal and financial requirements before making decisions or committing capital."}</span>
      </div>
    </div>
  );
}
