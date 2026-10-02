import { useState, useRef, useEffect, useCallback } from 'react';
import { VOICE_LANGUAGE_MAP } from '../utils/speechUtils';

// 25 seconds of complete silence before auto-stopping
const INACTIVITY_TIMEOUT_MS = 25000;

/**
 * Custom hook for Web Speech API SpeechRecognition
 * Features unified session transcript accumulation, continuous recognition,
 * silence timer, error recovery, and zero duplicate emissions.
 */
export function useSpeechRecognition({ languageCode = 'en', onResult, onError }) {
  const [isListening, setIsListening] = useState(false);
  const [errorType, setErrorType] = useState(null);

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const inactivityTimerRef = useRef(null);
  const restartTimeoutRef = useRef(null);

  // Unified session transcript tracking
  const sessionFinalRef = useRef('');
  const currentInstanceFinalRef = useRef('');

  // Keep callback refs stable across renders
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Check if browser supports SpeechRecognition
  const isSupported = typeof window !== 'undefined' && 
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    if (shouldListenRef.current) {
      inactivityTimerRef.current = setTimeout(() => {
        // Stop cleanly if no speech detected for 25s
        stopListening();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [clearInactivityTimer]);

  // Stop listening cleanly
  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    clearInactivityTimer();

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Safe to ignore if already stopped
      }
    }

    setIsListening(false);
  }, [clearInactivityTimer]);

  // Clear current error state
  const clearError = useCallback(() => {
    setErrorType(null);
  }, []);

  // Internal initialization & startup
  const initAndStart = useCallback(() => {
    if (!isSupported || !shouldListenRef.current) return;

    // Clean up any existing recognition instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    const targetLang = VOICE_LANGUAGE_MAP[languageCode] || 'en-IN';
    recognition.lang = targetLang;
    recognition.continuous = true;       // Keep listening through pauses
    recognition.interimResults = true;    // Real-time transcript processing
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (shouldListenRef.current) {
        setIsListening(true);
        setErrorType(null);
        resetInactivityTimer();
      }
    };

    recognition.onspeechstart = () => {
      resetInactivityTimer();
    };

    recognition.onresult = (event) => {
      resetInactivityTimer();

      let instFinal = '';
      let instInterim = '';

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item && item[0]) {
          const text = item[0].transcript;
          if (item.isFinal) {
            instFinal += (instFinal ? ' ' : '') + text.trim();
          } else {
            instInterim += (instInterim ? ' ' : '') + text.trim();
          }
        }
      }

      currentInstanceFinalRef.current = instFinal;

      // Construct the complete, deduplicated session text
      const parts = [
        sessionFinalRef.current.trim(),
        instFinal.trim(),
        instInterim.trim()
      ].filter(Boolean);

      const fullTranscript = parts.join(' ').replace(/\s+/g, ' ').trim();

      if (fullTranscript && onResultRef.current) {
        onResultRef.current(fullTranscript);
      }
    };

    recognition.onerror = (event) => {
      const errName = event.error;

      // 1. Benign pauses: 'no-speech' happens when user pauses to think.
      if (errName === 'no-speech') {
        resetInactivityTimer();
        return;
      }

      if (errName === 'aborted') {
        if (!shouldListenRef.current) {
          setIsListening(false);
        }
        return;
      }

      // 2. Fatal errors
      let fatalType = null;
      if (errName === 'not-allowed' || errName === 'service-not-allowed') {
        fatalType = 'micDenied';
      } else if (errName === 'language-not-supported') {
        fatalType = 'languageNotSupported';
      } else if (errName === 'network') {
        fatalType = 'network';
      }

      if (fatalType) {
        shouldListenRef.current = false;
        clearInactivityTimer();
        setErrorType(fatalType);
        setIsListening(false);
        if (onErrorRef.current) onErrorRef.current(fatalType);
      }
    };

    recognition.onend = () => {
      // Fold current instance final text into sessionFinalRef
      if (currentInstanceFinalRef.current) {
        const combined = [
          sessionFinalRef.current.trim(),
          currentInstanceFinalRef.current.trim()
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

        sessionFinalRef.current = combined;
        currentInstanceFinalRef.current = '';
      }

      // If user still intends to be listening, resume cleanly
      if (shouldListenRef.current) {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldListenRef.current) {
            initAndStart();
          }
        }, 150);
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start error:', e);
      if (shouldListenRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldListenRef.current) initAndStart();
        }, 250);
      } else {
        setIsListening(false);
      }
    }
  }, [isSupported, languageCode, resetInactivityTimer, clearInactivityTimer]);

  // Start listening triggered by user
  const startListening = useCallback(() => {
    if (!isSupported) {
      setErrorType('unsupported');
      if (onErrorRef.current) onErrorRef.current('unsupported');
      return;
    }

    shouldListenRef.current = true;
    sessionFinalRef.current = '';
    currentInstanceFinalRef.current = '';
    setErrorType(null);
    setIsListening(true);

    initAndStart();
  }, [isSupported, initAndStart]);

  // Cleanup on unmount or language change
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      clearInactivityTimer();
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {
          // Safe to ignore
        }
      }
    };
  }, [clearInactivityTimer]);

  return {
    isSupported,
    isListening,
    errorType,
    startListening,
    stopListening,
    clearError,
  };
}
