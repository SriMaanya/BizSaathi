import React, { useState, useEffect } from 'react';
import { translations } from '../translations';
import { formatConversationDate } from '../utils/dateUtils';

export default function ConversationsView({
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isLoading = false,
  onBackToAdvisor,
  currentUser = null,
  onOpenAuth,
  t,
}) {
  const activeT = t || translations.en;
  const [deletingConvId, setDeletingConvId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Close modal when Escape key is pressed
  useEffect(() => {
    if (!deletingConvId) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) {
        setDeletingConvId(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingConvId, isDeleting]);

  const confirmDelete = async () => {
    if (!deletingConvId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteConversation(deletingConvId);
      setDeletingConvId(null);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        setDeleteError("Conversation not found or already deleted.");
      } else if (status === 403) {
        setDeleteError("Access denied. You do not have permission to delete this conversation.");
      } else if (status === 401) {
        setDeleteError("Session expired. Please log in again.");
      } else if (status === 500) {
        setDeleteError("Unable to delete the conversation right now. Please try again later.");
      } else {
        setDeleteError(err?.message || activeT.deleteFailed || "Unable to delete this conversation. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="conversations-view-container">
      {/* View Header */}
      <div className="conversations-header-card">
        <div className="conversations-header-left">
          <button
            type="button"
            className="back-to-advisor-btn"
            onClick={onBackToAdvisor}
            aria-label="Back to Advisor"
            title="Back to Advisor"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>{activeT.advisorTab || "Advisor"}</span>
          </button>
          <div className="conversations-title-group">
            <h2 className="conversations-page-title">
              <span className="title-icon">📚</span>
              {activeT.myConversations || "My Conversations"}
            </h2>
            <p className="conversations-page-subtitle">
              {activeT.conversationsSubtitle || "Access, review, and continue your saved business advice sessions."}
            </p>
          </div>
        </div>

        {currentUser && (
          <button
            type="button"
            className="new-conversation-primary-btn"
            onClick={onNewConversation}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>{activeT.newConversation || "New Conversation"}</span>
          </button>
        )}
      </div>

      {/* Conversations List */}
      {!currentUser ? (
        <div className="conversations-empty-card">
          <div className="empty-icon-badge">🔒</div>
          <h3>{activeT.guestConversationsPrompt || "Login to view your saved conversations"}</h3>
          <p>
            {activeT.guestConversationsSubtitle || "Sign in or create an account to securely save and access your business advisory sessions across devices."}
          </p>
          <button
            type="button"
            className="start-chat-btn primary-btn"
            onClick={() => onOpenAuth && onOpenAuth('login')}
          >
            🔑 {activeT.signIn || "Log In"}
          </button>
        </div>
      ) : isLoading ? (
        <div className="conversations-loading-state">
          <span className="spinner-dots"></span>
          <p>{activeT.submitting || "Loading conversations..."}</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="conversations-empty-card">
          <div className="empty-icon-badge">💬</div>
          <h3>{activeT.noConversations || "No saved conversations yet"}</h3>
          <p>
            {activeT.emptyConversationsHint || "When you chat with BizSaathi, your sessions and personalized advice will be safely stored here."}
          </p>
          <button
            type="button"
            className="start-chat-btn primary-btn"
            onClick={onNewConversation}
          >
            🚀 {activeT.startNewChat || "Start a New Chat"}
          </button>
        </div>
      ) : (
        <div className="conversations-grid">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const messageCount = conv.messages ? conv.messages.length : 0;
            const lastMessage = conv.messages && conv.messages.length > 0
              ? conv.messages[conv.messages.length - 1]
              : null;
            const previewText = lastMessage ? lastMessage.content : '';

            return (
              <div 
                key={conv.id} 
                className={`conversation-card ${isActive ? 'is-active' : ''}`}
                onClick={() => onSelectConversation(conv)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectConversation(conv);
                  }
                }}
              >
                <div className="conversation-card-header">
                  <div className="conversation-card-title-row">
                    <span className="conv-icon">📝</span>
                    <h3 className="conversation-title">{conv.title || "Business Advice"}</h3>
                    {isActive && (
                      <span className="active-conv-pill">
                        <span className="status-dot"></span>
                        {activeT.activeLabel || "Active"}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="conv-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingConvId(conv.id);
                    }}
                    title={activeT.deleteConversation || "Delete conversation"}
                    aria-label={activeT.deleteConversation || "Delete conversation"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>

                {previewText && (
                  <p className="conversation-preview">
                    {previewText.length > 120 ? `${previewText.slice(0, 120)}...` : previewText}
                  </p>
                )}

                <div className="conversation-card-footer">
                  <span className="conv-date">
                    🕒 {formatConversationDate(conv.updated_at || conv.created_at)}
                  </span>
                  <div className="conv-footer-right">
                    <span className="conv-msg-count">
                      💬 {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
                    </span>
                    <span className="conv-continue-arrow">
                      {activeT.openConversation || "Open & Continue"} →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingConvId && (
        <div 
          className="conv-delete-modal-backdrop" 
          onClick={() => !isDeleting && setDeletingConvId(null)} 
          role="dialog" 
          aria-modal="true"
          aria-labelledby="delete-conv-title"
          aria-describedby="delete-conv-desc"
        >
          <div 
            className="conv-delete-modal centered-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-icon-bubble" aria-hidden="true">🗑️</div>
            <h3 id="delete-conv-title" className="delete-modal-title">
              {activeT.deleteConfirmTitle || "Delete this conversation?"}
            </h3>
            <p id="delete-conv-desc" className="delete-modal-desc">
              {activeT.deleteConfirmText || "This conversation and its messages will be permanently removed. Your business profile will remain saved."}
            </p>
            {deleteError && (
              <div className="auth-error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
                <span className="error-icon">⚠️</span>
                <span>{deleteError}</span>
              </div>
            )}
            <div className="delete-modal-actions">
              <button
                type="button"
                className="modal-action-btn modal-cancel-btn"
                onClick={() => { setDeletingConvId(null); setDeleteError(null); }}
                disabled={isDeleting}
              >
                {activeT.cancel || "Cancel"}
              </button>
              <button
                type="button"
                className="modal-action-btn modal-confirm-delete-btn"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (activeT.deleting || "Deleting...") : (activeT.deleteButton || "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
