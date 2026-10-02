import React from 'react';
import { translations } from '../translations';

export default function RecentConversations({
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  onNewConversation,
  onViewAll,
  t,
}) {
  if (!conversations || conversations.length === 0) return null;

  const activeT = t || translations.en;
  // Show up to 4 most recent conversations
  const recent = conversations.slice(0, 4);

  return (
    <div className="recent-conversations-container">
      <div className="recent-conversations-header">
        <div className="recent-title-group">
          <span className="recent-icon">🕒</span>
          <span className="recent-label">{activeT.conversationHistory || activeT.recentConversations || "Conversation History"}</span>
        </div>
        {conversations.length > 4 && (
          <button
            type="button"
            className="view-all-link-btn"
            onClick={onViewAll}
            title={activeT.viewAll || "View All"}
          >
            {activeT.viewAll || "View All"} ({conversations.length}) →
          </button>
        )}
      </div>

      <div className="recent-conversations-list">
        {onNewConversation && (
          <button
            type="button"
            className={`recent-conversation-chip new-chat-chip ${!activeConversationId ? 'is-active' : ''}`}
            onClick={onNewConversation}
            title={activeT.newChat || "+ New Chat"}
          >
            <span className="chip-icon">➕</span>
            <span className="chip-title">{activeT.newChat || "+ New Chat"}</span>
          </button>
        )}

        {recent.map((conv) => {
          const isActive = conv.id === activeConversationId;
          const msgCount = conv.messages ? conv.messages.length : 0;
          return (
            <button
              key={conv.id}
              type="button"
              className={`recent-conversation-chip ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelectConversation(conv)}
              title={conv.title || "Conversation"}
            >
              <span className="chip-icon">📝</span>
              <span className="chip-title">{conv.title || "Business Advice"}</span>
              <span className="chip-count">({msgCount})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
