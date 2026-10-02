import React from 'react';
import SpeechButton from './SpeechButton';
import { translations } from '../translations';

/**
 * Format markdown-like bold text (*text* or **text**) into simple elements
 * so formatted numbered lists or bold headers render cleanly.
 */
function renderFormattedContent(text) {
  if (!text) return null;
  
  const paragraphs = text.split('\n\n');
  
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n');
    return (
      <p key={pIdx} className="message-paragraph">
        {lines.map((line, lIdx) => {
          let cleanLine = line;
          let isHeading = false;
          if (cleanLine.startsWith('### ')) {
            cleanLine = cleanLine.replace(/^###\s+/, '');
            isHeading = true;
          } else if (cleanLine.startsWith('## ')) {
            cleanLine = cleanLine.replace(/^##\s+/, '');
            isHeading = true;
          }

          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
          return (
            <React.Fragment key={lIdx}>
              {isHeading ? (
                <strong className="message-heading">
                  {parts.map((p) => p.startsWith('**') && p.endsWith('**') ? p.slice(2, -2) : p)}
                </strong>
              ) : (
                parts.map((part, partIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <strong key={partIdx}>
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  return part;
                })
              )}
              {lIdx < lines.length - 1 && <br />}
            </React.Fragment>
          );
        })}
      </p>
    );
  });
}

export default function Message({ 
  message, 
  t, 
  isSpeaking, 
  onToggleSpeak, 
  isSpeechSupported = true 
}) {
  const isUser = message.role === 'user' || message.sender === 'user';
  const isError = Boolean(message.isError);
  const activeT = t || translations.en;
  const roleName = isError ? "Notice" : (activeT.advisorRole || "Advisor");

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'ai-row'}`}>
      {!isUser && (
        <div className={`avatar ai-avatar ${isError ? 'error-avatar' : ''}`} title={isError ? "Notice" : "BizSaathi AI Advisor"}>
          <span className="avatar-icon">{isError ? '⚠️' : '💡'}</span>
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'} ${isError ? 'error-bubble' : ''}`}>
        {!isUser && (
          <div className="ai-bubble-header">
            <div className="ai-bubble-title-group">
              <span className="ai-author-name">{activeT.appName || "BizSaathi"}</span>
              <span className="ai-role-badge">{roleName}</span>
            </div>
            {isSpeechSupported && !isError && onToggleSpeak && (
              <SpeechButton
                isSpeaking={isSpeaking}
                onToggleSpeak={onToggleSpeak}
                t={activeT}
              />
            )}
          </div>
        )}

        <div className="message-content">
          {renderFormattedContent(message.text)}
        </div>

        {message.timestamp && (
          <div className="message-time">
            {message.timestamp}
          </div>
        )}
      </div>

      {isUser && (
        <div className="avatar user-avatar" title="You">
          <span className="avatar-icon">👤</span>
        </div>
      )}
    </div>
  );
}
