import React, { useState, useRef, useEffect } from 'react';
import { LANGUAGES, translations } from '../translations';

export default function Header({ 
  selectedLanguage = 'en', 
  onLanguageChange, 
  t = translations.en, 
  onResetChat,
  onClearChat,
  currentUser = null,
  onOpenAuth,
  onLogout,
  onSaveJourney,
  onNewConversation,
  hasMessages = false,
  currentView = 'advisor',
  onNavigate,
  currentTheme = 'light',
  onToggleTheme,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const activeT = t || translations[selectedLanguage] || translations.en;
  const handleClear = onClearChat || onResetChat;

  // Close user dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : '';

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-badge">
          <span className="logo-icon">💼</span>
        </div>
        <div className="header-brand">
          <h1 className="header-title">{activeT.appName || "BizSaathi"}</h1>
          <span className="header-subtitle">{activeT.tagline}</span>
        </div>

        {/* Authenticated Navigation Tabs */}
        {currentUser && (
          <nav className="header-nav-tabs" aria-label="Main Navigation">
            <button
              type="button"
              className={`header-nav-tab ${currentView === 'advisor' ? 'is-active' : ''}`}
              onClick={() => onNavigate && onNavigate('advisor')}
              title={activeT.advisorTab || "Advisor"}
            >
              <span className="tab-icon">💬</span>
              <span className="tab-label">{activeT.advisorTab || "Advisor"}</span>
            </button>
            <button
              type="button"
              className={`header-nav-tab ${currentView === 'conversations' ? 'is-active' : ''}`}
              onClick={() => onNavigate && onNavigate('conversations')}
              title={activeT.conversationsTab || activeT.myConversations || "Conversations"}
            >
              <span className="tab-icon">📚</span>
              <span className="tab-label">{activeT.conversationsTab || activeT.myConversations || "Conversations"}</span>
            </button>
            <button
              type="button"
              className={`header-nav-tab ${currentView === 'settings' ? 'is-active' : ''}`}
              onClick={() => onNavigate && onNavigate('settings')}
              title={activeT.settingsTab || "Settings"}
            >
              <span className="tab-icon">⚙️</span>
              <span className="tab-label">{activeT.settingsTab || "Settings"}</span>
            </button>
          </nav>
        )}
      </div>

      <div className="header-actions">
        {/* Quick Theme Toggle Button (Available for Guests & Authenticated Users) */}
        {onToggleTheme && (
          <button 
            type="button" 
            className="header-action-btn icon-only-btn theme-toggle-btn"
            onClick={onToggleTheme}
            title={currentTheme === 'dark' ? "Switch to Light mode" : "Switch to Dark mode"}
            aria-label="Toggle Theme"
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {currentTheme === 'dark' ? '☀️' : '🌙'}
            </span>
          </button>
        )}

        {/* Language Selector Dropdown */}
        <div className="language-selector-container">
          <span className="lang-icon" aria-hidden="true">🌐</span>
          <select
            className="language-select"
            value={selectedLanguage}
            onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
            aria-label="Select Language"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName}
              </option>
            ))}
          </select>
        </div>

        {/* New Conversation Button (For Authenticated Users) */}
        {currentUser && onNewConversation && currentView === 'advisor' && (
          <button
            type="button"
            className="header-action-btn secondary-btn new-chat-btn"
            onClick={onNewConversation}
            title={activeT.newConversation || "New Conversation"}
            aria-label={activeT.newConversation || "New Conversation"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span className="btn-label">{activeT.newConversation || "New"}</span>
          </button>
        )}

        {/* Clear Chat Button (Only in advisor view) */}
        {handleClear && currentView === 'advisor' && (
          <button 
            type="button" 
            className="header-action-btn secondary-btn clear-chat-btn" 
            onClick={handleClear}
            title={activeT.clearChat || "Clear Chat"}
            aria-label={activeT.clearChat || "Clear Chat"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span className="btn-label">{activeT.clearChat || "Clear Chat"}</span>
          </button>
        )}

        {/* User Account / Auth Section */}
        {currentUser ? (
          <div className="user-menu-container" ref={menuRef}>
            <button
              type="button"
              className="user-profile-badge-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-label="User Account Menu"
              title={`${currentUser.name} (${currentUser.email})`}
            >
              <div className="user-avatar-circle">
                {firstName ? firstName[0].toUpperCase() : 'U'}
              </div>
              <span className="user-profile-name">{firstName}</span>
              <svg className="user-profile-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {isMenuOpen && (
              <div className="user-dropdown-popover">
                <div className="user-popover-info">
                  <div className="popover-user-name">{currentUser.name}</div>
                  <div className="popover-user-email">{currentUser.email}</div>
                  <div className="popover-db-badge">
                    <span className="status-dot"></span>
                    <span>{activeT.accountSynced || "Account Synced"}</span>
                  </div>
                </div>
                <div className="user-popover-divider"></div>
                <button
                  type="button"
                  className="user-popover-item-btn"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onNavigate) onNavigate('conversations');
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                  <span>{activeT.myConversations || "My Conversations"}</span>
                </button>
                <button
                  type="button"
                  className="user-popover-item-btn"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onNavigate) onNavigate('settings');
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>{activeT.profileAndSettings || "Profile & Settings"}</span>
                </button>
                <div className="user-popover-divider"></div>
                <button
                  type="button"
                  className="user-popover-logout-btn"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onLogout) onLogout();
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>{activeT.logOut || "Log Out"}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="guest-header-actions">
            {hasMessages && onSaveJourney && (
              <button 
                type="button" 
                className="header-action-btn save-journey-header-btn" 
                onClick={onSaveJourney}
                aria-label={activeT.saveMyJourney || "Save My Journey"}
                title="Create an account to save this conversation"
              >
                <span className="sparkle-icon" aria-hidden="true">💾</span>
                <span className="btn-label">{activeT.saveMyJourney || "Save My Journey"}</span>
              </button>
            )}
            <button 
              type="button" 
              className="header-action-btn auth-nav-btn" 
              onClick={() => onOpenAuth && onOpenAuth('login')}
              aria-label="Sign In"
              title="Sign in to your account"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span className="btn-label">{activeT.signIn || "Sign In"}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
