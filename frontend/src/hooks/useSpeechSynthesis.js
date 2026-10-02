import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  VOICE_LANGUAGE_MAP, 
  findBestVoice, 
  splitTextIntoSpeechChunks 
} from '../utils/speechUtils';

/**
 * Custom hook for Web Speech API SpeechSynthesis
 * Features sequential chunking, cancel race protection,
 * voice matching, and missing-voice detection.
 */
export function useSpeechSynthesis({ onMissingVoice } = {}) {
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);

  const isSpeakingRef = useRef(false);
  const keepAliveIntervalRef = useRef(null);
  const currentChunkIndexRef = useRef(0);
  const chunksRef = useRef([]);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stopKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
  }, []);

  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    keepAliveIntervalRef.current = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } else {
        stopKeepAlive();
      }
    }, 4000);
  }, [stopKeepAlive]);

  // Load available voices from browser
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      try {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices && availableVoices.length > 0) {
          setVoices(availableVoices);
        }
      } catch (e) {
        // Safe to ignore
      }
    };

    loadVoices();

    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis.removeEventListener) {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported]);

  // Stop current speech cleanly
  const stop = useCallback(() => {
    isSpeakingRef.current = false;
    chunksRef.current = [];
    currentChunkIndexRef.current = 0;
    stopKeepAlive();

    if (isSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // Safe to ignore
      }
    }

    if (typeof window !== 'undefined') {
      window.__bizsaathi_active_utterance = null;
    }

    setSpeakingMessageId(null);
    setIsSpeaking(false);
  }, [isSupported, stopKeepAlive]);

  // Speak a message
  const speak = useCallback((messageId, rawText, languageCode = 'en') => {
    if (!isSupported || !rawText) return;

    // 1. If currently speaking this exact message, toggle stop
    if (speakingMessageId === messageId) {
      stop();
      return;
    }

    // 2. Prepare speech chunks
    const chunks = splitTextIntoSpeechChunks(rawText);
    if (!chunks || chunks.length === 0) return;

    // Get fresh voices from browser
    const freshVoices = (typeof window !== 'undefined' && window.speechSynthesis)
      ? window.speechSynthesis.getVoices()
      : [];
    const availableVoices = (freshVoices && freshVoices.length > 0) ? freshVoices : voices;

    const voiceToUse = findBestVoice(availableVoices, languageCode);
    const targetLang = VOICE_LANGUAGE_MAP[languageCode] || 'en-IN';

    // 3. If regional/Indic language has no compatible voice installed in this browser
    // (e.g. Chrome on Windows lacks Telugu/Tamil/Kannada voices, but Edge has natural voices):
    if (languageCode !== 'en' && !voiceToUse) {
      stop();
      if (onMissingVoice) {
        onMissingVoice(languageCode);
      }
      return;
    }

    chunksRef.current = chunks;
    currentChunkIndexRef.current = 0;
    isSpeakingRef.current = true;

    // Recursive sequential speaker
    const speakNextChunk = (index) => {
      if (!isSpeakingRef.current || index >= chunksRef.current.length) {
        stop();
        return;
      }

      currentChunkIndexRef.current = index;
      const textToSpeak = chunksRef.current[index];
      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // Keep active reference to prevent GC in Chrome
      if (typeof window !== 'undefined') {
        window.__bizsaathi_active_utterance = utterance;
      }

      // Configure voice and language
      if (voiceToUse) {
        utterance.voice = voiceToUse;
        utterance.lang = voiceToUse.lang || targetLang;
      } else {
        utterance.lang = targetLang;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (isSpeakingRef.current) {
          setSpeakingMessageId(messageId);
          setIsSpeaking(true);
          startKeepAlive();
        }
      };

      utterance.onend = () => {
        if (isSpeakingRef.current) {
          speakNextChunk(index + 1);
        }
      };

      utterance.onerror = (e) => {
        if (e.error === 'canceled' || e.error === 'interrupted') {
          return;
        }
        console.warn('SpeechSynthesis chunk error:', e.error || e);
        if (isSpeakingRef.current && index + 1 < chunksRef.current.length) {
          speakNextChunk(index + 1);
        } else {
          stop();
        }
      };

      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('speechSynthesis.speak error:', err);
        stop();
      }
    };

    const beginPlayback = () => {
      setSpeakingMessageId(messageId);
      setIsSpeaking(true);
      speakNextChunk(0);
    };

    // If browser is currently speaking or queued, cancel first and wait for Chrome's IPC
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        if (isSpeakingRef.current) {
          beginPlayback();
        }
      }, 70);
    } else {
      beginPlayback();
    }
  }, [isSupported, voices, speakingMessageId, stop, startKeepAlive, onMissingVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSupported,
    isSpeaking,
    speakingMessageId,
    speak,
    stop,
  };
}
