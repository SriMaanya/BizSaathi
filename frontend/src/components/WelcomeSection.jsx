import React from 'react';
import { translations } from '../translations';

export default function WelcomeSection({ t, isOnboarded = false, isCompact = false }) {
  const activeT = t || translations.en;

  const badgeText = isOnboarded
    ? (activeT.returningBadge || "Active Business Profile")
    : (activeT.onboardingBadge || "Business Plan Setup");

  const titleText = isOnboarded
    ? (activeT.returningWelcomeTitle || "Welcome back! What would you like help with today?")
    : (activeT.newWelcomeTitle || "What's your plan? What business are you thinking about?");

  const subtitleText = isOnboarded
    ? (activeT.returningWelcomeSubtitle || "BizSaathi already knows your business context. Tell us what you'd like to improve or work on next.")
    : (activeT.newWelcomeSubtitle || "Tell us about your business idea, budget, location, and goals so BizSaathi can help you build your roadmap.");

  return (
    <section className={`welcome-section ${isCompact ? 'compact' : ''}`}>
      <div className="welcome-badge">
        <span className="welcome-badge-dot"></span>
        <span>{badgeText}</span>
      </div>
      <h2 className="welcome-title">{titleText}</h2>
      <p className="welcome-description">{subtitleText}</p>
    </section>
  );
}
