import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { translations } from '../translations';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialMode = 'login', 
  isSavingJourney = false,
  t 
}) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const activeT = t || translations.en;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (!name.trim()) {
        setError(activeT.enterFullName || 'Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError(activeT.passwordLengthError || 'Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError(activeT.passwordsDoNotMatch || 'Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        const data = await api.auth.register({
          name: name.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        });
        if (onSuccess) await onSuccess(data.user, isSavingJourney);
      } else {
        const data = await api.auth.login({
          email: email.trim(),
          password,
        });
        if (onSuccess) await onSuccess(data.user, isSavingJourney);
      }
      onClose();
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const modalTitle = isSavingJourney
    ? (activeT.saveJourneyModalTitle || "Save your BizSaathi journey")
    : mode === 'login'
    ? (activeT.signInTitle || 'Sign in to BizSaathi')
    : (activeT.signUpTitle || 'Create your Account');

  const modalSubtitle = isSavingJourney
    ? (activeT.saveJourneyModalSubtitle || "Create an account to save your conversations and business details so you can continue where you left off.")
    : mode === 'login'
    ? (activeT.signInSubtitle || 'Access your saved business profile and conversation history across devices.')
    : (activeT.signUpSubtitle || 'Save your business context, roadmap, and expert advice securely in PostgreSQL.');

  return (
    <div className="auth-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>

        <div className="auth-modal-header">
          <div className="auth-modal-badge">
            <span className="auth-badge-icon">💼</span>
          </div>
          <h2 className="auth-modal-title">{modalTitle}</h2>
          <p className="auth-modal-subtitle">{modalSubtitle}</p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tab-group">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            {activeT.signUp || 'Create Account'}
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            {activeT.signIn || 'Log In'}
          </button>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="auth-field-group">
              <label className="auth-label" htmlFor="auth-name">
                {activeT.nameLabel || 'Full Name'}
              </label>
              <input
                id="auth-name"
                type="text"
                className="auth-input"
                placeholder="e.g. Ramesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="auth-email">
              {activeT.emailLabel || 'Email Address'}
            </label>
            <input
              id="auth-email"
              type="email"
              className="auth-input"
              placeholder="e.g. ramesh@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="auth-field-group">
            <label className="auth-label" htmlFor="auth-password">
              {activeT.passwordLabel || 'Password'}
            </label>
            <input
              id="auth-password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field-group">
              <label className="auth-label" htmlFor="auth-confirm-password">
                {activeT.confirmPasswordLabel || 'Confirm Password'}
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn primary-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="auth-btn-loading">
                <span className="spinner-dots"></span>
                <span>{activeT.submitting || 'Processing...'}</span>
              </span>
            ) : mode === 'login' ? (
              activeT.signIn || 'Log In'
            ) : (
              activeT.signUp || 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-modal-footer">
          {mode === 'login' ? (
            <p>
              {activeT.dontHaveAccount || "Don't have an account?"}{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
              >
                {activeT.signUp || 'Create Account'}
              </button>
            </p>
          ) : (
            <p>
              {activeT.alreadyHaveAccount || 'Already have an account?'}{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                {activeT.signIn || 'Log In'}
              </button>
            </p>
          )}

          {isSavingJourney && (
            <button
              type="button"
              className="continue-without-saving-btn"
              onClick={onClose}
            >
              {activeT.continueWithoutSaving || "Continue Without Saving"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
