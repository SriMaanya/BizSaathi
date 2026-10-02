import React from 'react';
import { translations } from '../translations';

export default function BusinessContextCard({
  context,
  onChangeContext,
  onClearContext,
  onCompleteOnboarding,
  isOnboarded = false,
  isExpanded = true,
  onToggleExpand,
  hasMessages = false,
  isLoading = false,
  t = translations.en,
}) {
  const activeT = t || translations.en;

  const hasAnyContext = Boolean(
    context?.businessType?.trim() ||
    context?.budget?.trim() ||
    context?.location?.trim() ||
    context?.goal?.trim()
  );

  const handleOnboardingSubmit = (e) => {
    e.preventDefault();
    if (onCompleteOnboarding) {
      onCompleteOnboarding(context);
    }
  };

  // If user is NOT onboarded, show the Onboarding Experience card
  if (!isOnboarded && !hasMessages) {
    return (
      <section 
        className="business-context-card onboarding-card"
        aria-label={activeT.businessContextTitle || "Business Context Setup"}
      >
        <div className="onboarding-card-header">
          <div className="onboarding-badge-pill">
            <span className="onboarding-badge-icon">📋</span>
            <span>{activeT.onboardingBadge || "Business Setup"}</span>
          </div>
          <h3 className="onboarding-card-title">
            {activeT.businessContextTitle || "Business Context"}
          </h3>
          <p className="onboarding-card-subtitle">
            {activeT.businessContextSubtitle || "Tell us about your business idea, budget, location, and goals so BizSaathi can understand what you're building."}
          </p>
        </div>

        <form onSubmit={handleOnboardingSubmit} className="onboarding-form">
          <div className="context-grid">
            <div className="context-field-group">
              <label htmlFor="onboard-business-type" className="context-label">
                {activeT.businessTypeLabel || "Business Type / Idea"}
              </label>
              <input
                id="onboard-business-type"
                type="text"
                className="context-text-input"
                placeholder={activeT.businessTypePlaceholder || "e.g., Bakery, Kirana, Boutique"}
                value={context?.businessType || ''}
                onChange={(e) => onChangeContext('businessType', e.target.value)}
                autoComplete="off"
                disabled={isLoading}
              />
            </div>

            <div className="context-field-group">
              <label htmlFor="onboard-budget" className="context-label">
                {activeT.budgetLabel || "Budget"}
              </label>
              <input
                id="onboard-budget"
                type="text"
                className="context-text-input"
                placeholder={activeT.budgetPlaceholder || "e.g., ₹2 lakh, ₹50,000"}
                value={context?.budget || ''}
                onChange={(e) => onChangeContext('budget', e.target.value)}
                autoComplete="off"
                disabled={isLoading}
              />
            </div>

            <div className="context-field-group">
              <label htmlFor="onboard-location" className="context-label">
                {activeT.locationLabel || "Location"}
              </label>
              <input
                id="onboard-location"
                type="text"
                className="context-text-input"
                placeholder={activeT.locationPlaceholder || "e.g., Hyderabad, Jaipur, Rural area"}
                value={context?.location || ''}
                onChange={(e) => onChangeContext('location', e.target.value)}
                autoComplete="off"
                disabled={isLoading}
              />
            </div>

            <div className="context-field-group">
              <label htmlFor="onboard-goal" className="context-label">
                {activeT.goalLabel || "Goal"}
              </label>
              <input
                id="onboard-goal"
                type="text"
                className="context-text-input"
                placeholder={activeT.goalPlaceholder || "e.g., Start a home bakery, Find customers"}
                value={context?.goal || ''}
                onChange={(e) => onChangeContext('goal', e.target.value)}
                autoComplete="off"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="onboarding-form-actions">
            <div className="onboarding-action-note">
              <span>{activeT.statusNoteHint || "Fields left blank will not be assumed. BizSaathi will ask when needed."}</span>
            </div>
            <button
              type="submit"
              className="onboarding-submit-btn"
              disabled={isLoading}
            >
              <span className="btn-icon">🚀</span>
              <span>{activeT.saveAndGetPlan || "Save & Generate My Starting Plan"}</span>
            </button>
          </div>
        </form>
      </section>
    );
  }

  // Returning user view (or view while chatting)
  return (
    <section 
      className={`business-context-card ${isExpanded ? 'expanded' : 'collapsed'} ${hasMessages ? 'in-chat' : 'returning-card'}`}
      aria-label={activeT.businessContextTitle || "Business Context"}
    >
      {/* Header Bar with Business Context Details */}
      <div 
        className="context-header"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        aria-expanded={isExpanded}
        title={isExpanded ? (activeT.hideContext || "Collapse") : (activeT.editContext || "Edit Context")}
      >
        <div className="context-header-left">
          <div className="context-header-icon-badge" aria-hidden="true">
            🏢
          </div>
          <div className="context-header-titles">
            <div className="context-title-row">
              <span className="context-card-title">
                {activeT.businessContextTitle || "Business Context"}
              </span>
              <span className="context-badge-tag">
                {hasAnyContext || isOnboarded
                  ? (activeT.returningBadge || "Active Business Profile")
                  : (activeT.onboardingBadge || "Business Setup")}
              </span>
            </div>

            {/* In collapsed state: show 4 fields clearly */}
            {!isExpanded && (
              <div className="context-chips-summary">
                {hasAnyContext ? (
                  <div className="context-chip-list">
                    <span className="context-chip" title={activeT.businessTypeLabel}>
                      <span className="chip-key">Type:</span> {context.businessType?.trim() || "Not set"}
                    </span>
                    <span className="context-chip" title={activeT.budgetLabel}>
                      <span className="chip-key">Budget:</span> {context.budget?.trim() || "Not set"}
                    </span>
                    <span className="context-chip" title={activeT.locationLabel}>
                      <span className="chip-key">Location:</span> {context.location?.trim() || "Not set"}
                    </span>
                    <span className="context-chip goal-chip" title={activeT.goalLabel}>
                      <span className="chip-key">Goal:</span> {context.goal?.trim() || "Not set"}
                    </span>
                  </div>
                ) : (
                  <span className="context-empty-prompt">
                    {activeT.emptyContextPrompt || "Add your business details for tailored advice"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="context-header-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="context-toggle-button edit-btn"
            onClick={onToggleExpand}
            aria-label={isExpanded ? (activeT.hideContext || "Collapse") : (activeT.editContext || "Edit Context")}
          >
            <span className="toggle-btn-icon">✏️</span>
            <span className="toggle-btn-text">
              {isExpanded 
                ? (activeT.hideContext || "Collapse") 
                : (activeT.editContext || "Edit Context")}
            </span>
            <svg 
              className={`toggle-chevron ${isExpanded ? 'is-expanded' : ''}`} 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Form Fields for editing */}
      {isExpanded && (
        <div className="context-body">
          <p className="context-subtitle">
            {activeT.editContextSubtitle || "Provide or update your business details so BizSaathi can personalize all future advice."}
          </p>

          <div className="context-grid">
            <div className="context-field-group">
              <label htmlFor="context-business-type" className="context-label">
                {activeT.businessTypeLabel || "Business Type / Idea"}
              </label>
              <input
                id="context-business-type"
                type="text"
                className="context-text-input"
                placeholder={activeT.businessTypePlaceholder || "e.g., Bakery, Kirana, Boutique"}
                value={context?.businessType || ''}
                onChange={(e) => onChangeContext('businessType', e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="context-field-group">
              <label htmlFor="context-budget" className="context-label">
                {activeT.budgetLabel || "Budget"}
              </label>
              <input
                id="context-budget"
                type="text"
                className="context-text-input"
                placeholder={activeT.budgetPlaceholder || "e.g., ₹2 lakh, ₹50,000"}
                value={context?.budget || ''}
                onChange={(e) => onChangeContext('budget', e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="context-field-group">
              <label htmlFor="context-location" className="context-label">
                {activeT.locationLabel || "Location"}
              </label>
              <input
                id="context-location"
                type="text"
                className="context-text-input"
                placeholder={activeT.locationPlaceholder || "e.g., Hyderabad, Jaipur, Rural area"}
                value={context?.location || ''}
                onChange={(e) => onChangeContext('location', e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="context-field-group">
              <label htmlFor="context-goal" className="context-label">
                {activeT.goalLabel || "Goal"}
              </label>
              <input
                id="context-goal"
                type="text"
                className="context-text-input"
                placeholder={activeT.goalPlaceholder || "e.g., Start a home bakery, Find customers"}
                value={context?.goal || ''}
                onChange={(e) => onChangeContext('goal', e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="context-footer">
            <button
              type="button"
              className="context-action-link"
              onClick={onClearContext}
              title={activeT.clearContext || "Clear / Reset"}
            >
              🗑️ {activeT.clearContext || "Clear / Reset"}
            </button>

            <button
              type="button"
              className="context-done-button"
              onClick={onToggleExpand}
            >
              {activeT.saveChanges || "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
