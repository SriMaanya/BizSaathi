import React from 'react';
import { translations } from '../translations';

export default function SaveJourneyBanner({ onSaveJourney, onDismiss, t }) {
  const activeT = t || translations.en;

  return (
    <div className="save-journey-banner" role="region" aria-label="Save your journey">
      <div className="save-journey-content">
        <div className="save-journey-badge">
          <span className="save-journey-icon">💾</span>
        </div>
        <div className="save-journey-text-group">
          <h3 className="save-journey-title">
            {activeT.saveJourneyPromptTitle || activeT.saveJourneyTitle || "Want BizSaathi to remember your journey?"}
          </h3>
          <p className="save-journey-subtitle">
            {activeT.saveJourneySubtitle || "Create an account to save your conversations and business details and continue later."}
          </p>
        </div>
      </div>

      <div className="save-journey-actions">
        <button
          type="button"
          className="save-journey-btn primary-btn"
          onClick={onSaveJourney}
        >
          💾 {activeT.saveMyJourney || "Save My Journey"}
        </button>
        <button
          type="button"
          className="save-journey-dismiss-btn secondary-btn"
          onClick={onDismiss}
        >
          {activeT.maybeLater || "Maybe Later"}
        </button>
      </div>
    </div>
  );
}
