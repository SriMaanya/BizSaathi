import React, { useState } from 'react';
import { api } from '../utils/api';
import { translations } from '../translations';
import { formatConversationDate } from '../utils/dateUtils';

export default function SettingsView({
  currentUser,
  onUpdateUser,
  businessContext,
  onUpdateBusinessContext,
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  isLoadingConversations = false,
  currentTheme,
  onChangeTheme,
  onLogout,
  onBackToAdvisor,
  onOpenAuth,
  selectedLanguage = 'en',
  t,
}) {
  const activeT = t || translations[selectedLanguage] || translations.en;

  // Conversations deletion modal state
  const [deletingConvId, setDeletingConvId] = useState(null);
  const [isDeletingConv, setIsDeletingConv] = useState(false);
  const [convDeleteError, setConvDeleteError] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deletingConvId || !onDeleteConversation) return;
    setIsDeletingConv(true);
    setConvDeleteError(null);
    try {
      await onDeleteConversation(deletingConvId);
      setDeletingConvId(null);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setConvDeleteError(activeT.deleteFailed || "Unable to delete this conversation. Please try again.");
    } finally {
      setIsDeletingConv(false);
    }
  };

  // Personal Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null); // { type: 'success' | 'error', text }

  // Business Profile Edit State
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [businessData, setBusinessData] = useState({
    businessType: businessContext?.businessType || '',
    budget: businessContext?.budget || '',
    location: businessContext?.location || '',
    goal: businessContext?.goal || '',
  });
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessMessage, setBusinessMessage] = useState(null);

  // Security (Password) State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  // Handle Personal Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const cleanName = profileName.trim();
    if (!cleanName || cleanName.length < 2) {
      setProfileMessage({ type: 'error', text: activeT.enterFullName || 'Please enter a valid full name.' });
      return;
    }

    setProfileLoading(true);
    setProfileMessage(null);

    try {
      const updatedUser = await api.auth.updateProfile({ name: cleanName });
      if (onUpdateUser) onUpdateUser(updatedUser);
      setProfileMessage({ type: 'success', text: activeT.profileUpdated || 'Profile updated successfully!' });
      setIsEditingProfile(false);
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle Business Details Save
  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    setBusinessLoading(true);
    setBusinessMessage(null);

    try {
      const payload = {
        business_type: businessData.businessType.trim(),
        budget: businessData.budget.trim(),
        location: businessData.location.trim(),
        goal: businessData.goal.trim(),
      };

      const updated = await api.businessProfile.update(payload);
      const newContext = {
        businessType: updated.business_type || '',
        budget: updated.budget || '',
        location: updated.location || '',
        goal: updated.goal || '',
      };

      if (onUpdateBusinessContext) {
        onUpdateBusinessContext(newContext);
      }

      setBusinessMessage({ type: 'success', text: activeT.businessUpdated || 'Business profile updated successfully!' });
      setIsEditingBusiness(false);
    } catch (err) {
      setBusinessMessage({ type: 'error', text: err.message || 'Failed to save business profile.' });
    } finally {
      setBusinessLoading(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: activeT.currentPasswordRequired || 'Please enter your current password.' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: activeT.passwordLengthError || 'Password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: activeT.passwordsDoNotMatch || 'Passwords do not match.' });
      return;
    }

    setPasswordLoading(true);

    try {
      await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });

      setPasswordMessage({ type: 'success', text: activeT.passwordChangedSuccess || 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.message || 'Failed to change password. Please check your current password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const userInitial = currentUser?.name ? currentUser.name[0].toUpperCase() : 'U';

  return (
    <div className="settings-page-wrapper">
      {/* Top Navigation Bar */}
      <div className="settings-top-bar">
        <button
          type="button"
          className="settings-back-btn"
          onClick={onBackToAdvisor}
          aria-label="Back to Advisor"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>{activeT.backToAdvisor || "Back to Advisor"}</span>
        </button>

        <div className="settings-header-title">
          <h2>{activeT.profileAndSettings || "Profile & Settings"}</h2>
          <p>{activeT.settingsSubtitle || "Manage your account, business profile, appearance, and security."}</p>
        </div>
      </div>

      <div className="settings-container">
        {/* If Guest: Friendly Card Prompt */}
        {!currentUser && (
          <div className="settings-card guest-settings-card">
            <div className="guest-settings-icon">🔒</div>
            <div className="guest-settings-content">
              <h3>{activeT.guestSettingsTitle || "Create an account to save your profile"}</h3>
              <p>{activeT.guestSettingsSubtitle || "Sign in or create an account to save your personal details, business context, and conversation history across devices."}</p>
              <div className="guest-settings-actions">
                <button
                  type="button"
                  className="primary-btn settings-auth-btn"
                  onClick={() => onOpenAuth && onOpenAuth('register')}
                >
                  {activeT.signUp || "Create Account"}
                </button>
                <button
                  type="button"
                  className="secondary-btn settings-auth-btn"
                  onClick={() => onOpenAuth && onOpenAuth('login')}
                >
                  {activeT.signIn || "Sign In"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. PERSONAL PROFILE SECTION (Authenticated Only) */}
        {currentUser && (
          <div className="settings-card profile-card">
            <div className="settings-card-header">
              <div className="card-header-icon">👤</div>
              <div className="card-header-titles">
                <h3>{activeT.personalProfile || "Personal Profile"}</h3>
                <p>{activeT.personalProfileSubtitle || "Your account identity and contact details."}</p>
              </div>
              {!isEditingProfile && (
                <button
                  type="button"
                  className="settings-edit-toggle-btn"
                  onClick={() => {
                    setIsEditingProfile(true);
                    setProfileName(currentUser.name);
                    setProfileMessage(null);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>{activeT.editProfile || "Edit Profile"}</span>
                </button>
              )}
            </div>

            {profileMessage && (
              <div className={`settings-alert-banner ${profileMessage.type}`}>
                {profileMessage.type === 'success' ? '✓ ' : '⚠️ '}
                {profileMessage.text}
              </div>
            )}

            {!isEditingProfile ? (
              <div className="profile-display-view">
                <div className="profile-avatar-large">
                  {userInitial}
                </div>
                <div className="profile-details">
                  <div className="profile-name-text">{currentUser.name}</div>
                  <div className="profile-email-text">{currentUser.email}</div>
                  <div className="profile-sync-badge">
                    <span className="status-dot"></span>
                    <span>{activeT.accountSynced || "Account Synced"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <form className="settings-edit-form" onSubmit={handleSaveProfile}>
                <div className="settings-form-row">
                  <label htmlFor="settings-name-input">{activeT.nameLabel || "Full Name"}</label>
                  <input
                    id="settings-name-input"
                    type="text"
                    className="settings-input"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    disabled={profileLoading}
                  />
                </div>

                <div className="settings-form-row">
                  <label htmlFor="settings-email-display">{activeT.emailLabel || "Email Address"}</label>
                  <input
                    id="settings-email-display"
                    type="email"
                    className="settings-input settings-input-readonly"
                    value={currentUser.email}
                    disabled
                    readOnly
                  />
                  <span className="settings-field-hint">{activeT.emailReadOnlyHint || "Email is tied to your account login and cannot be edited."}</span>
                </div>

                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="secondary-btn settings-cancel-btn"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileName(currentUser.name);
                      setProfileMessage(null);
                    }}
                    disabled={profileLoading}
                  >
                    {activeT.cancel || "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="primary-btn settings-save-btn"
                    disabled={profileLoading}
                  >
                    {profileLoading ? (activeT.submitting || "Saving...") : (activeT.saveChanges || "Save Changes")}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 2. BUSINESS PROFILE SECTION (Authenticated Only) */}
        {currentUser && (
          <div className="settings-card business-settings-card">
            <div className="settings-card-header">
              <div className="card-header-icon">💼</div>
              <div className="card-header-titles">
                <h3>{activeT.myBusiness || "My Business Profile"}</h3>
                <p>{activeT.businessProfileSubtitle || "Used by BizSaathi AI to tailor startup and growth advice."}</p>
              </div>
              {!isEditingBusiness && (
                <button
                  type="button"
                  className="settings-edit-toggle-btn"
                  onClick={() => {
                    setIsEditingBusiness(true);
                    setBusinessData({
                      businessType: businessContext?.businessType || '',
                      budget: businessContext?.budget || '',
                      location: businessContext?.location || '',
                      goal: businessContext?.goal || '',
                    });
                    setBusinessMessage(null);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>{activeT.editBusinessDetails || "Edit Business Details"}</span>
                </button>
              )}
            </div>

            {businessMessage && (
              <div className={`settings-alert-banner ${businessMessage.type}`}>
                {businessMessage.type === 'success' ? '✓ ' : '⚠️ '}
                {businessMessage.text}
              </div>
            )}

            {!isEditingBusiness ? (
              <div className="business-details-grid">
                <div className="business-detail-item">
                  <span className="detail-label">{activeT.businessTypeLabel || "Business Type"}:</span>
                  <span className="detail-value">{businessContext?.businessType || activeT.notSpecified || "Not specified"}</span>
                </div>
                <div className="business-detail-item">
                  <span className="detail-label">{activeT.budgetLabel || "Budget"}:</span>
                  <span className="detail-value">{businessContext?.budget || activeT.notSpecified || "Not specified"}</span>
                </div>
                <div className="business-detail-item">
                  <span className="detail-label">{activeT.locationLabel || "Location"}:</span>
                  <span className="detail-value">{businessContext?.location || activeT.notSpecified || "Not specified"}</span>
                </div>
                <div className="business-detail-item">
                  <span className="detail-label">{activeT.goalLabel || "Goal"}:</span>
                  <span className="detail-value">{businessContext?.goal || activeT.notSpecified || "Not specified"}</span>
                </div>
              </div>
            ) : (
              <form className="settings-edit-form" onSubmit={handleSaveBusiness}>
                <div className="settings-form-row">
                  <label htmlFor="settings-biz-type">{activeT.businessTypeLabel || "Business Type / Idea"}</label>
                  <input
                    id="settings-biz-type"
                    type="text"
                    className="settings-input"
                    value={businessData.businessType}
                    onChange={(e) => setBusinessData((prev) => ({ ...prev, businessType: e.target.value }))}
                    placeholder="e.g., Bakery, Kirana, Boutique"
                    disabled={businessLoading}
                  />
                </div>

                <div className="settings-form-row">
                  <label htmlFor="settings-biz-budget">{activeT.budgetLabel || "Budget"}</label>
                  <input
                    id="settings-biz-budget"
                    type="text"
                    className="settings-input"
                    value={businessData.budget}
                    onChange={(e) => setBusinessData((prev) => ({ ...prev, budget: e.target.value }))}
                    placeholder="e.g., ₹2,00,000, ₹50,000"
                    disabled={businessLoading}
                  />
                </div>

                <div className="settings-form-row">
                  <label htmlFor="settings-biz-location">{activeT.locationLabel || "Location"}</label>
                  <input
                    id="settings-biz-location"
                    type="text"
                    className="settings-input"
                    value={businessData.location}
                    onChange={(e) => setBusinessData((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Hyderabad, Jaipur, Rural area"
                    disabled={businessLoading}
                  />
                </div>

                <div className="settings-form-row">
                  <label htmlFor="settings-biz-goal">{activeT.goalLabel || "Goal"}</label>
                  <input
                    id="settings-biz-goal"
                    type="text"
                    className="settings-input"
                    value={businessData.goal}
                    onChange={(e) => setBusinessData((prev) => ({ ...prev, goal: e.target.value }))}
                    placeholder="e.g., Get first customers, Expand sales"
                    disabled={businessLoading}
                  />
                </div>

                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="secondary-btn settings-cancel-btn"
                    onClick={() => {
                      setIsEditingBusiness(false);
                      setBusinessMessage(null);
                    }}
                    disabled={businessLoading}
                  >
                    {activeT.cancel || "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="primary-btn settings-save-btn"
                    disabled={businessLoading}
                  >
                    {businessLoading ? (activeT.submitting || "Saving...") : (activeT.saveChanges || "Save Changes")}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 3. SAVED CONVERSATIONS SECTION (Authenticated Only) */}
        {currentUser && (
          <div className="settings-card conversations-settings-card">
            <div className="settings-card-header">
              <div className="card-header-icon">📚</div>
              <div className="card-header-titles">
                <h3>{activeT.myConversations || "Saved Conversations"} ({conversations.length})</h3>
                <p>{activeT.conversationsSubtitle || "Access, review, and continue your saved business advice sessions."}</p>
              </div>
              {onNewConversation && (
                <button
                  type="button"
                  className="settings-new-chat-btn"
                  onClick={() => {
                    onNewConversation();
                    if (onBackToAdvisor) onBackToAdvisor();
                  }}
                  title={activeT.newConversation || "Start New Conversation"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>{activeT.newConversation || "New"}</span>
                </button>
              )}
            </div>

            {isLoadingConversations ? (
              <div className="settings-conv-loading">
                <span className="spinner-dot"></span>
                <span>{activeT.loadingConversations || "Loading your conversations..."}</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="settings-conv-empty">
                <div className="settings-conv-empty-icon">💬</div>
                <div className="settings-conv-empty-title">{activeT.noConversations || "No saved conversations yet"}</div>
                <p className="settings-conv-empty-desc">
                  {activeT.noConversationsDesc || "When you ask questions, your advice sessions will be saved here automatically."}
                </p>
                <button
                  type="button"
                  className="primary-btn settings-start-btn"
                  onClick={() => {
                    if (onNewConversation) onNewConversation();
                    if (onBackToAdvisor) onBackToAdvisor();
                  }}
                >
                  + {activeT.startFirstConversation || "Start a Conversation"}
                </button>
              </div>
            ) : (
              <div className="settings-conv-list">
                {conversations.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const msgCount = Array.isArray(conv.messages) ? conv.messages.length : 0;
                  const latestMsg = conv.messages && conv.messages.length > 0
                    ? conv.messages[conv.messages.length - 1].content
                    : '';

                  return (
                    <div
                      key={conv.id}
                      className={`settings-conv-item ${isActive ? 'is-active' : ''}`}
                    >
                      <div className="settings-conv-item-left">
                        <div className="settings-conv-item-header">
                          <span className="settings-conv-icon">📝</span>
                          <span className="settings-conv-title" title={conv.title || "Business Advice"}>
                            {conv.title || "Business Advice"}
                          </span>
                          {isActive && (
                            <span className="settings-conv-active-badge">
                              {activeT.active || "Active"}
                            </span>
                          )}
                        </div>

                        {latestMsg && (
                          <p className="settings-conv-preview">{latestMsg}</p>
                        )}

                        <div className="settings-conv-meta">
                          <span className="settings-conv-date">
                            🕒 {formatConversationDate(conv.updated_at || conv.created_at)}
                          </span>
                          <span className="settings-conv-meta-dot">•</span>
                          <span className="settings-conv-count">
                            💬 {msgCount} {msgCount === 1 ? (activeT.message || 'message') : (activeT.messages || 'messages')}
                          </span>
                        </div>
                      </div>

                      <div className="settings-conv-item-actions">
                        <button
                          type="button"
                          className="settings-conv-open-btn"
                          onClick={() => {
                            if (onSelectConversation) onSelectConversation(conv);
                            if (onBackToAdvisor) onBackToAdvisor();
                          }}
                          title={activeT.continueConversation || "Continue Conversation"}
                        >
                          <span>{activeT.open || "Continue"}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="settings-conv-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingConvId(conv.id);
                          }}
                          title={activeT.deleteConversation || "Delete Conversation"}
                          aria-label={activeT.deleteConversation || "Delete Conversation"}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. APPEARANCE (THEME) SECTION (Available to Everyone) */}
        <div className="settings-card appearance-card">
          <div className="settings-card-header">
            <div className="card-header-icon">🎨</div>
            <div className="card-header-titles">
              <h3>{activeT.appearanceTitle || "Appearance"}</h3>
              <p>{activeT.appearanceSubtitle || "Choose how BizSaathi looks on your screen."}</p>
            </div>
          </div>

          <div className="theme-options-grid">
            <button
              type="button"
              className={`theme-option-btn ${currentTheme === 'light' ? 'is-active' : ''}`}
              onClick={() => onChangeTheme('light')}
            >
              <span className="theme-option-icon">☀️</span>
              <span className="theme-option-label">{activeT.themeLight || "Light"}</span>
              {currentTheme === 'light' && <span className="theme-check-mark">✓</span>}
            </button>

            <button
              type="button"
              className={`theme-option-btn ${currentTheme === 'dark' ? 'is-active' : ''}`}
              onClick={() => onChangeTheme('dark')}
            >
              <span className="theme-option-icon">🌙</span>
              <span className="theme-option-label">{activeT.themeDark || "Dark"}</span>
              {currentTheme === 'dark' && <span className="theme-check-mark">✓</span>}
            </button>

            <button
              type="button"
              className={`theme-option-btn ${currentTheme === 'system' ? 'is-active' : ''}`}
              onClick={() => onChangeTheme('system')}
            >
              <span className="theme-option-icon">💻</span>
              <span className="theme-option-label">{activeT.themeSystem || "System"}</span>
              {currentTheme === 'system' && <span className="theme-check-mark">✓</span>}
            </button>
          </div>
        </div>

        {/* 4. SECURITY (CHANGE PASSWORD) SECTION (Authenticated Only) */}
        {currentUser && (
          <div className="settings-card security-card">
            <div className="settings-card-header">
              <div className="card-header-icon">🔐</div>
              <div className="card-header-titles">
                <h3>{activeT.securityTitle || "Security"}</h3>
                <p>{activeT.securitySubtitle || "Keep your account safe by updating your password."}</p>
              </div>
              {!isChangingPassword && (
                <button
                  type="button"
                  className="settings-edit-toggle-btn"
                  onClick={() => {
                    setIsChangingPassword(true);
                    setPasswordMessage(null);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>{activeT.changePassword || "Change Password"}</span>
                </button>
              )}
            </div>

            {passwordMessage && (
              <div className={`settings-alert-banner ${passwordMessage.type}`}>
                {passwordMessage.type === 'success' ? '✓ ' : '⚠️ '}
                {passwordMessage.text}
              </div>
            )}

            {isChangingPassword && (
              <form className="settings-edit-form" onSubmit={handleChangePassword}>
                <div className="settings-form-row">
                  <label htmlFor="settings-current-pwd">{activeT.currentPasswordLabel || "Current Password"}</label>
                  <input
                    id="settings-current-pwd"
                    type="password"
                    className="settings-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    disabled={passwordLoading}
                  />
                </div>

                <div className="settings-form-row">
                  <label htmlFor="settings-new-pwd">{activeT.newPasswordLabel || "New Password"}</label>
                  <input
                    id="settings-new-pwd"
                    type="password"
                    className="settings-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    required
                    minLength={6}
                    disabled={passwordLoading}
                  />
                </div>

                <div className="settings-form-row">
                  <label htmlFor="settings-confirm-pwd">{activeT.confirmNewPasswordLabel || "Confirm New Password"}</label>
                  <input
                    id="settings-confirm-pwd"
                    type="password"
                    className="settings-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    disabled={passwordLoading}
                  />
                </div>

                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="secondary-btn settings-cancel-btn"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordMessage(null);
                    }}
                    disabled={passwordLoading}
                  >
                    {activeT.cancel || "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="primary-btn settings-save-btn"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? (activeT.submitting || "Updating...") : (activeT.updatePassword || "Update Password")}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 5. LOGOUT SECTION (Authenticated Only) */}
        {currentUser && (
          <div className="settings-card logout-card">
            <div className="settings-card-header">
              <div className="card-header-icon danger-icon">🚪</div>
              <div className="card-header-titles">
                <h3>{activeT.logOut || "Log Out"}</h3>
                <p>{activeT.logOutSubtitle || "Sign out of your session on this device. Your data remains safely stored in your account."}</p>
              </div>
            </div>

            <div className="logout-card-action">
              <button
                type="button"
                className="settings-logout-btn"
                onClick={onLogout}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>{activeT.logOut || "Log Out of BizSaathi"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingConvId && (
        <div className="conv-delete-modal-backdrop" onClick={() => !isDeletingConv && setDeletingConvId(null)}>
          <div className="conv-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon-bubble">🗑️</div>
            <h3 className="delete-modal-title">{activeT.confirmDeleteTitle || "Delete Conversation?"}</h3>
            <p className="delete-modal-desc">
              {activeT.confirmDeleteDesc || "Are you sure you want to delete this saved conversation? This action cannot be undone."}
            </p>
            {convDeleteError && (
              <div className="auth-error-banner" role="alert" style={{ marginBottom: '1rem' }}>
                <span className="error-icon">⚠️</span>
                <span>{convDeleteError}</span>
              </div>
            )}
            <div className="delete-modal-actions">
              <button
                type="button"
                className="modal-action-btn modal-cancel-btn"
                onClick={() => { setDeletingConvId(null); setConvDeleteError(null); }}
                disabled={isDeletingConv}
              >
                {activeT.cancel || "Cancel"}
              </button>
              <button
                type="button"
                className="modal-action-btn modal-confirm-delete-btn"
                onClick={handleConfirmDelete}
                disabled={isDeletingConv}
              >
                {isDeletingConv ? (activeT.deleting || "Deleting...") : (activeT.deleteConfirmBtn || "Yes, Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
