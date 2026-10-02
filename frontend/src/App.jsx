import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import WelcomeSection from './components/WelcomeSection';
import BusinessContextCard from './components/BusinessContextCard';
import SuggestedQuestions from './components/SuggestedQuestions';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import AuthModal from './components/AuthModal';
import SaveJourneyBanner from './components/SaveJourneyBanner';
import SettingsView from './components/SettingsView';
import ConversationsView from './components/ConversationsView';
import RecentConversations from './components/RecentConversations';
import { translations } from './translations';
import { api, getStoredToken, getStoredUser } from './utils/api';
import { getStoredTheme, applyTheme } from './utils/theme';
import { formatCurrentTime, parseUtcDate } from './utils/dateUtils';
import './App.css';

const STORAGE_GUEST_CHAT_KEY = 'bizsaathi_guest_chat_history';
const STORAGE_GUEST_CONTEXT_KEY = 'bizsaathi_guest_business_context';
const STORAGE_GUEST_ONBOARDED_KEY = 'bizsaathi_onboarded';

// Retrieve saved guest chat history from localStorage ONLY if unauthenticated
function getInitialChatMessages() {
  try {
    // If a token exists, the user is authenticated; do NOT load guest messages
    if (getStoredToken()) {
      return [];
    }
    const saved = localStorage.getItem(STORAGE_GUEST_CHAT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading guest chat history from localStorage:', err);
  }
  return [];
}

// Retrieve guest user state from localStorage ONLY if unauthenticated
function getInitialUserState() {
  const defaultState = {
    isOnboarded: false,
    context: {
      businessType: '',
      budget: '',
      location: '',
      goal: '',
    },
  };

  try {
    // If user is authenticated, their business context will come from PostgreSQL backend
    if (getStoredToken()) {
      return defaultState;
    }

    const savedOnboarded = localStorage.getItem(STORAGE_GUEST_ONBOARDED_KEY);
    const savedContextRaw = localStorage.getItem(STORAGE_GUEST_CONTEXT_KEY);

    if (savedOnboarded === 'true' && savedContextRaw) {
      const parsed = JSON.parse(savedContextRaw);
      const hasAnyField = Boolean(
        parsed?.businessType?.trim() ||
        parsed?.budget?.trim() ||
        parsed?.location?.trim() ||
        parsed?.goal?.trim()
      );

      if (hasAnyField) {
        return {
          isOnboarded: true,
          context: {
            businessType: parsed.businessType || '',
            budget: parsed.budget || '',
            location: parsed.location || '',
            goal: parsed.goal || '',
          },
        };
      }
    }
  } catch (err) {
    console.error('Error loading stored guest business context:', err);
  }

  return defaultState;
}

function clearGuestLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_GUEST_CHAT_KEY);
    localStorage.removeItem(STORAGE_GUEST_CONTEXT_KEY);
    localStorage.removeItem(STORAGE_GUEST_ONBOARDED_KEY);
    localStorage.removeItem('bizsaathi_chat_history');
    localStorage.removeItem('bizsaathi_business_context');
  } catch (e) {
    console.error('Failed to clear guest localStorage:', e);
  }
}

export default function App() {
  const initial = getInitialUserState();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [currentView, setCurrentView] = useState('advisor');
  const [theme, setTheme] = useState(getStoredTheme);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [isSavingJourneyMode, setIsSavingJourneyMode] = useState(false);
  const [isJourneyBannerDismissed, setIsJourneyBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('bizsaathi_journey_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const [isOnboarded, setIsOnboarded] = useState(initial.isOnboarded);
  const [businessContext, setBusinessContext] = useState(initial.context);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState(getInitialChatMessages);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  const isLoggingOutRef = useRef(false);

  // Sync conversation history to localStorage ONLY when user is guest (unauthenticated)
  useEffect(() => {
    if (!currentUser && !isLoggingOutRef.current) {
      try {
        if (messages.length > 0) {
          localStorage.setItem(STORAGE_GUEST_CHAT_KEY, JSON.stringify(messages));
        } else {
          localStorage.removeItem(STORAGE_GUEST_CHAT_KEY);
        }
      } catch (e) {
        console.error('Failed to save guest chat history to localStorage:', e);
      }
    }
  }, [messages, currentUser]);

  // Load Business Profile from PostgreSQL backend
  const loadBackendProfile = useCallback(async () => {
    try {
      const profile = await api.businessProfile.get();
      const hasData = Boolean(
        profile && (
          profile.business_type?.trim() ||
          profile.budget?.trim() ||
          profile.location?.trim() ||
          profile.goal?.trim()
        )
      );

      if (hasData) {
        setBusinessContext({
          businessType: profile.business_type || '',
          budget: profile.budget || '',
          location: profile.location || '',
          goal: profile.goal || '',
        });
        setIsOnboarded(true);
      } else {
        setBusinessContext({
          businessType: '',
          budget: '',
          location: '',
          goal: '',
        });
        setIsOnboarded(false);
      }
    } catch (err) {
      console.error('Failed to load business profile from backend:', err);
      setIsOnboarded(false);
    }
  }, []);

  // Load Conversations and Messages from PostgreSQL backend
  const loadBackendConversations = useCallback(async (autoSelectLatest = false) => {
    try {
      setIsConversationsLoading(true);
      const convs = await api.conversations.list();
      setConversations(convs || []);

      if (autoSelectLatest && convs && convs.length > 0) {
        // Select most recent conversation if no active conversation
        const latest = convs[0];
        setActiveConversationId(latest.id);

        let latestData = latest;
        if (!latest.messages || latest.messages.length === 0) {
          try {
            const fullConv = await api.conversations.get(latest.id);
            if (fullConv && Array.isArray(fullConv.messages)) {
              latestData = fullConv;
            }
          } catch (err) {
            console.error('Failed to load full messages for latest conversation:', err);
          }
        }

        if (Array.isArray(latestData.messages) && latestData.messages.length > 0) {
          const loaded = latestData.messages.map((m) => ({
            id: `msg-${m.id}`,
            role: m.role,
            sender: m.role,
            text: m.content,
            timestamp: formatCurrentTime(m.created_at),
          }));
          setMessages(loaded);

          // Restore conversation language if present
          const lastMsgWithLang = [...latestData.messages].reverse().find((m) => m.language && m.language !== 'en');
          if (lastMsgWithLang && lastMsgWithLang.language) {
            setSelectedLanguage(lastMsgWithLang.language);
          } else if (latestData.messages[0]?.language) {
            setSelectedLanguage(latestData.messages[0].language);
          }
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations from backend:', err);
    } finally {
      setIsConversationsLoading(false);
    }
  }, []);

  // Switch to a previous conversation from Conversations view or Recent list
  const handleSelectConversation = async (conv) => {
    if (!conv) return;
    setActiveConversationId(conv.id);
    let convData = conv;
    if (!conv.messages || conv.messages.length === 0) {
      try {
        const fullConv = await api.conversations.get(conv.id);
        if (fullConv) convData = fullConv;
      } catch (err) {
        console.error('Failed to load full conversation messages:', err);
      }
    }

    if (Array.isArray(convData.messages) && convData.messages.length > 0) {
      const loaded = convData.messages.map((m) => ({
        id: `msg-${m.id}`,
        role: m.role,
        sender: m.role,
        text: m.content,
        timestamp: formatCurrentTime(m.created_at),
      }));
      setMessages(loaded);

      // Preserve / restore selected language of the conversation
      const lastMsgWithLang = [...convData.messages].reverse().find((m) => m.language && m.language !== 'en');
      if (lastMsgWithLang && lastMsgWithLang.language) {
        setSelectedLanguage(lastMsgWithLang.language);
      } else if (convData.messages[0]?.language) {
        setSelectedLanguage(convData.messages[0].language);
      }
    } else {
      setMessages([]);
    }
    setCurrentView('advisor');
  };

  // Start a fresh new conversation without deleting previous ones
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputText('');
    setCurrentView('advisor');
  };

  // Delete a saved conversation permanently
  const handleDeleteConversation = async (convId) => {
    try {
      await api.conversations.delete(convId);
      setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(convId)));
      if (activeConversationId != null && Number(activeConversationId) === Number(convId)) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      throw err;
    }
  };

  // Ensure theme is applied on mount and updates
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // On initial mount: validate token with /auth/me and load cloud data
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.auth.getMe()
        .then((user) => {
          setCurrentUser(user);
          if (user.theme) {
            setTheme(user.theme);
            applyTheme(user.theme);
          }
          loadBackendProfile();
          loadBackendConversations(false);
          setActiveConversationId(null);
          setMessages([]);
        })
        .catch((err) => {
          console.warn('Session expired or invalid, reverting to guest mode:', err);
          api.auth.logout();
          setCurrentUser(null);
        });
    }
  }, [loadBackendProfile, loadBackendConversations]);

  // Handle Theme Change
  const handleChangeTheme = async (newTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    if (currentUser) {
      try {
        await api.auth.updateProfile({ theme: newTheme });
        setCurrentUser((prev) => prev ? { ...prev, theme: newTheme } : null);
      } catch (err) {
        console.warn('Failed to persist theme to backend account:', err);
      }
    }
  };

  // Quick Toggle between Light and Dark
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    handleChangeTheme(nextTheme);
  };

  // Active translation dictionary
  const t = translations[selectedLanguage] || translations.en;

  // Handle language switching
  const handleLanguageChange = (newLangCode) => {
    setSelectedLanguage(newLangCode);
  };

  // Update a single business context field
  const handleContextChange = (field, value) => {
    setBusinessContext((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };

      if (currentUser) {
        // Persist to backend database for logged in user
        api.businessProfile.update({
          business_type: updated.businessType,
          budget: updated.budget,
          location: updated.location,
          goal: updated.goal,
        }).catch((err) => console.error('Failed to update profile on backend:', err));
      } else {
        // Persist to guest localStorage
        try {
          localStorage.setItem(STORAGE_GUEST_CONTEXT_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save guest context to localStorage:', e);
        }
      }
      return updated;
    });
  };

  // Clear business context and reset onboarding status
  const handleClearContext = () => {
    if (currentUser) {
      api.businessProfile.update({
        business_type: '',
        budget: '',
        location: '',
        goal: '',
      }).catch((err) => console.error('Failed to clear profile on backend:', err));
    }
    clearGuestLocalStorage();
    setBusinessContext({
      businessType: '',
      budget: '',
      location: '',
      goal: '',
    });
    setIsOnboarded(false);
    setIsContextExpanded(true);
  };

  // Handle sending a message to FastAPI backend (core AI advisor - NO LOGIN REQUIRED)
  const handleSendMessage = async (textToSend, customContext = null) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const activeContext = customContext || businessContext;

    // 1. Optimistically add user message to UI
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      sender: 'user',
      text: trimmed,
      timestamp: formatCurrentTime()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Auto-collapse context card on message sent
    if (isContextExpanded) {
      setIsContextExpanded(false);
    }

    const aiMessageId = `ai-${Date.now()}`;
    let aiText = '';
    let aiMsgCreated = false;

    try {
      // 2. Call backend /chat with optional JWT auth attached via api.chat.stream
      const recentHistoryPayload = !currentUser && messages.length > 0
        ? messages.slice(-6).map((m) => ({
            role: m.role || m.sender || 'user',
            content: m.text,
            language: selectedLanguage,
          }))
        : undefined;

      const payload = {
        message: trimmed,
        language: selectedLanguage,
        business_type: activeContext.businessType?.trim() || undefined,
        budget: activeContext.budget?.trim() || undefined,
        location: activeContext.location?.trim() || undefined,
        goal: activeContext.goal?.trim() || undefined,
        conversation_id: activeConversationId || undefined,
        recent_history: recentHistoryPayload,
      };

      await api.chat.stream(payload, {
        onChunk: (chunk) => {
          aiText += chunk;
          if (!aiMsgCreated) {
            aiMsgCreated = true;
            setIsLoading(false); // First token arrived! Remove loading spinner immediately
            setMessages((prev) => [
              ...prev,
              {
                id: aiMessageId,
                role: 'assistant',
                sender: 'assistant',
                text: aiText,
                timestamp: formatCurrentTime()
              }
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMessageId ? { ...m, text: aiText } : m
              )
            );
          }
        },
        onDone: (data) => {
          if (data?.conversation_id && !activeConversationId) {
            setActiveConversationId(data.conversation_id);
          }
          if (currentUser) {
            loadBackendConversations(false);
          }
        }
      });
    } catch (error) {
      console.error('Backend request failed:', error);
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        sender: 'assistant',
        text: 'Something went wrong. Please try again.',
        timestamp: formatCurrentTime(),
        isError: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Called when a NEW user completes their Business Context in Onboarding
  const handleCompleteOnboarding = async (submittedContext) => {
    if (currentUser) {
      // Save directly to PostgreSQL backend
      try {
        await api.businessProfile.save({
          business_type: submittedContext.businessType,
          budget: submittedContext.budget,
          location: submittedContext.location,
          goal: submittedContext.goal,
        });
      } catch (err) {
        console.error('Failed to save profile to database:', err);
      }
    } else {
      // Save context in guest localStorage
      try {
        localStorage.setItem(STORAGE_GUEST_CONTEXT_KEY, JSON.stringify(submittedContext));
        localStorage.setItem(STORAGE_GUEST_ONBOARDED_KEY, 'true');
      } catch (e) {
        console.error('Failed to store guest onboarding data:', e);
      }
    }

    // Update React states
    setBusinessContext(submittedContext);
    setIsOnboarded(true);
    setIsContextExpanded(false);

    // Generate personalized starting plan
    const starterPrompt = t.starterPlanUserPrompt || "Please provide a step-by-step starting plan and roadmap for my business based on my business details.";
    await handleSendMessage(starterPrompt, submittedContext);
  };

  // When clicking a suggested question or personalized action card
  const handleSelectQuestion = (questionText) => {
    handleSendMessage(questionText);
  };

  // Clear conversation history only after user confirmation
  const handleClearChat = async () => {
    const confirmMessage = t.clearChatConfirm || 
      "Are you sure you want to clear your conversation history? Your Business Context will be saved.";

    if (window.confirm(confirmMessage)) {
      if (currentUser && activeConversationId) {
        try {
          const convIdToDelete = activeConversationId;
          await api.conversations.delete(convIdToDelete);
          setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(convIdToDelete)));
          setActiveConversationId(null);
        } catch (err) {
          console.error('Failed to delete backend conversation:', err);
        }
      }

      setMessages([]);
      setInputText('');
      setIsContextExpanded(false);
      clearGuestLocalStorage();
    }
  };

  // Auth Modal trigger
  const handleOpenAuth = (mode = 'login', forSaveJourney = false) => {
    setAuthModalMode(mode);
    setIsSavingJourneyMode(forSaveJourney);
    setIsAuthModalOpen(true);
  };

  // Dismiss "Save My Journey" banner for current session
  const handleDismissJourneyBanner = () => {
    try {
      sessionStorage.setItem('bizsaathi_journey_dismissed', 'true');
    } catch {
      // Ignore
    }
    setIsJourneyBannerDismissed(true);
  };

  // Auth Success callback: transfer guest conversation ONLY when explicitly initiated via "Save My Journey"
  const handleAuthSuccess = async (user, forSaveJourney = false) => {
    setCurrentUser(user);
    if (user.theme) {
      setTheme(user.theme);
      applyTheme(user.theme);
    }

    const isExplicitMigration = Boolean(forSaveJourney || isSavingJourneyMode);
    const guestMsgs = messages;
    const hasGuestMessages = guestMsgs && guestMsgs.length > 0;
    const hasGuestContext = Boolean(
      businessContext.businessType ||
      businessContext.budget ||
      businessContext.location ||
      businessContext.goal
    );

    // ONLY migrate guest conversation when explicitly requested via "Save My Journey"
    if (isExplicitMigration && hasGuestMessages) {
      try {
        let migrationId;
        try {
          migrationId = sessionStorage.getItem('bizsaathi_guest_migration_id');
          if (!migrationId) {
            migrationId = `mig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            sessionStorage.setItem('bizsaathi_guest_migration_id', migrationId);
          }
        } catch {
          migrationId = `mig_${Date.now()}`;
        }

        const formattedMessages = guestMsgs.map((m) => ({
          role: m.role || m.sender || 'user',
          content: m.text,
          language: selectedLanguage,
        }));

        const transferPayload = {
          migration_id: migrationId,
          messages: formattedMessages,
          business_context: hasGuestContext ? {
            business_type: businessContext.businessType,
            budget: businessContext.budget,
            location: businessContext.location,
            goal: businessContext.goal,
          } : null,
        };

        const transferred = await api.conversations.transfer(transferPayload);
        setActiveConversationId(transferred.id);

        if (transferred.messages && transferred.messages.length > 0) {
          setMessages(transferred.messages.map((m) => ({
            id: `msg-${m.id}`,
            role: m.role,
            sender: m.role,
            text: m.content,
            timestamp: formatCurrentTime(m.created_at),
          })));
        }

        // Migration confirmed successful by backend -> safe to clear guest storage
        clearGuestLocalStorage();
        try {
          sessionStorage.removeItem('bizsaathi_guest_migration_id');
        } catch {
          // Ignore
        }
        await loadBackendProfile();
        await loadBackendConversations(false);
        setIsSavingJourneyMode(false);
        console.log('[Transfer] Guest conversation and context successfully saved to PostgreSQL account.');
        return;
      } catch (err) {
        console.error('Error during guest conversation transfer:', err);
        // Requirement: DO NOT clear guest data if transfer fails. Keep safe in localStorage.
        alert(t.transferFailed || "Your conversation couldn't be saved yet. Your local conversation is still safe. Please try again.");
        return;
      }
    }

    // Standard Login or Signup (without "Save My Journey"):
    // Reset guest UI state cleanly so guest conversation NEVER leaks into authenticated account
    clearGuestLocalStorage();
    setActiveConversationId(null);
    setMessages([]);
    setInputText('');
    setIsSavingJourneyMode(false);
    await loadBackendProfile();
    await loadBackendConversations(false);
  };

  // Logout callback: return cleanly to guest mode
  const handleLogout = () => {
    isLoggingOutRef.current = true;
    api.auth.logout();
    setCurrentUser(null);
    setCurrentView('advisor');
    setActiveConversationId(null);
    setConversations([]);
    setMessages([]);
    setBusinessContext({
      businessType: '',
      budget: '',
      location: '',
      goal: '',
    });
    setIsOnboarded(false);
    clearGuestLocalStorage();
    try {
      sessionStorage.removeItem('bizsaathi_journey_dismissed');
      sessionStorage.removeItem('bizsaathi_guest_migration_id');
    } catch {
      // Ignore
    }
    setIsJourneyBannerDismissed(false);
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 150);
  };

  const hasMessages = messages.length > 0;
  const showSaveJourneyBanner = !currentUser && hasMessages && !isJourneyBannerDismissed;

  return (
    <div className="bizsaathi-app">
      <Header 
        selectedLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
        t={t}
        onClearChat={hasMessages ? handleClearChat : null}
        onResetChat={hasMessages ? handleClearChat : null}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        onSaveJourney={() => handleOpenAuth('register', true)}
        onNewConversation={currentUser ? handleNewConversation : null}
        hasMessages={hasMessages}
        currentView={currentView}
        onNavigate={setCurrentView}
        currentTheme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className={`bizsaathi-main ${currentView === 'settings' || currentView === 'conversations' ? 'settings-active' : ''}`}>
        {currentView === 'conversations' ? (
          <ConversationsView
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            isLoading={isConversationsLoading}
            onBackToAdvisor={() => setCurrentView('advisor')}
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            t={t}
          />
        ) : currentView === 'settings' ? (
          <SettingsView
            currentUser={currentUser}
            onUpdateUser={setCurrentUser}
            businessContext={businessContext}
            onUpdateBusinessContext={(newContext) => {
              setBusinessContext(newContext);
              const hasAnyField = Boolean(
                newContext?.businessType?.trim() ||
                newContext?.budget?.trim() ||
                newContext?.location?.trim() ||
                newContext?.goal?.trim()
              );
              setIsOnboarded(hasAnyField);
            }}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onNewConversation={handleNewConversation}
            isLoadingConversations={isConversationsLoading}
            currentTheme={theme}
            onChangeTheme={handleChangeTheme}
            onLogout={handleLogout}
            onBackToAdvisor={() => setCurrentView('advisor')}
            onOpenAuth={handleOpenAuth}
            selectedLanguage={selectedLanguage}
            t={t}
          />
        ) : (
          <div className="content-container">
            <WelcomeSection 
              t={t} 
              isOnboarded={isOnboarded}
              isCompact={hasMessages} 
            />

            {currentUser && conversations.length > 0 && (
              <RecentConversations
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                onViewAll={() => setCurrentView('conversations')}
                t={t}
              />
            )}

            <BusinessContextCard
              context={businessContext}
              onChangeContext={handleContextChange}
              onClearContext={handleClearContext}
              onCompleteOnboarding={handleCompleteOnboarding}
              isOnboarded={isOnboarded}
              isExpanded={isContextExpanded}
              onToggleExpand={() => setIsContextExpanded((prev) => !prev)}
              hasMessages={hasMessages}
              isLoading={isLoading}
              t={t}
            />
            
            <SuggestedQuestions 
              isOnboarded={isOnboarded}
              businessContext={businessContext}
              t={t}
              onSelectQuestion={handleSelectQuestion} 
              isCompact={hasMessages} 
              canContinuePrevious={Boolean(currentUser && conversations.length > 0)}
              onContinuePrevious={() => {
                if (conversations.length > 0) {
                  handleSelectConversation(conversations[0]);
                }
              }}
            />

            {showSaveJourneyBanner && (
              <SaveJourneyBanner
                onSaveJourney={() => handleOpenAuth('register', true)}
                onDismiss={handleDismissJourneyBanner}
                t={t}
              />
            )}

            <ChatWindow 
              messages={messages} 
              isLoading={isLoading} 
              selectedLanguage={selectedLanguage}
              t={t}
            />
          </div>
        )}
      </main>

      {currentView === 'advisor' && (
        <footer className="bizsaathi-footer">
          <div className="footer-inner">
            <ChatInput
              inputText={inputText}
              setInputText={setInputText}
              onSendMessage={(msg) => handleSendMessage(msg)}
              disabled={isLoading}
              selectedLanguage={selectedLanguage}
              t={t}
            />
          </div>
        </footer>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        isSavingJourney={isSavingJourneyMode}
        t={t}
      />
    </div>
  );
}
