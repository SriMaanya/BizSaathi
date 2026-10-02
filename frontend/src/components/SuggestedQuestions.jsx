import React from 'react';
import { translations } from '../translations';

export default function SuggestedQuestions({ 
  isOnboarded = false,
  businessContext = {},
  t, 
  onSelectQuestion, 
  isCompact = false,
  canContinuePrevious = false,
  onContinuePrevious = null,
}) {
  const activeT = t || translations.en;
  const lang = activeT.appName ? (Object.keys(translations).find(k => translations[k] === activeT) || 'en') : 'en';

  const bType = businessContext?.businessType?.trim();
  const bBudget = businessContext?.budget?.trim();
  const bLoc = businessContext?.location?.trim();
  const bGoal = businessContext?.goal?.trim();

  // If user is ONBOARDED (Returning user with existing context):
  // Show personalized / context-aware actions
  if (isOnboarded) {
    const actionsConfig = activeT.returningActions || translations.en.returningActions;

    // Helper to generate multilingual context-aware queries
    const getActionQuery = (actionKey) => {
      switch (actionKey) {
        case 'continue':
          if (lang === 'te') return 'మనం గతంలో చర్చించిన దాని ఆధారంగా, తదుపరి దేనిపై దృష్టి పెట్టాలి?';
          if (lang === 'hi') return 'हमने जो पहले चर्चा की थी, उसके आधार पर आगे क्या करना चाहिए?';
          if (lang === 'ta') return 'நாம் முன்பு விவாதித்ததன் அடிப்படையில், அடுத்து என்ன செய்ய வேண்டும்?';
          if (lang === 'kn') return 'ನಾವು ಈ ಮೊದಲು ಚರ್ಚಿಸಿದ ಆಧಾರದ ಮೇಲೆ, ಮುಂದೆ ಏನು ಮಾಡಬೇಕು?';
          return "Let's continue our previous discussion. Based on our earlier conversation, what should we focus on next?";

        case 'grow':
          if (lang === 'te') return `నా ${bType || 'వ్యాపారాన్ని'} ఎలా విస్తరించాలి మరియు మరింత వృద్ధి చేయాలి?`;
          if (lang === 'hi') return `मेरे ${bType || 'बिजनेस'} को कैसे आगे बढ़ाएं और स्केल करें?`;
          if (lang === 'ta') return `எனது ${bType || 'வணிகத்தை'} எவ்வாறு வளர்ப்பது மற்றும் விரிவாக்குவது?`;
          if (lang === 'kn') return `ನನ್ನ ${bType || 'ವ್ಯವಹಾರವನ್ನು'} ಹೇಗೆ ಬೆಳೆಸುವುದು ಮತ್ತು ವಿಸ್ತರಿಸುವುದು?`;
          return `How can I grow and scale my ${bType || 'business'}${bLoc ? ' in ' + bLoc : ''}?`;

        case 'marketing':
          if (lang === 'te') return `నా ${bType || 'వ్యాపారానికి'}${bLoc ? ' ' + bLoc + 'లో' : ''} కస్టమర్లను ఆకర్షించడానికి ఉత్తమ మార్కెటింగ్ వ్యూహాలు ఏమిటి?`;
          if (lang === 'hi') return `मेरे ${bType || 'बिजनेस'}${bLoc ? ' (' + bLoc + ')' : ''} के लिए ग्राहकों को आकर्षित करने के प्रभावी मार्केटिंग तरीके क्या हैं?`;
          if (lang === 'ta') return `எனது ${bType || 'வணிகத்திற்கு'}${bLoc ? ' (' + bLoc + ')' : ''} வாடிக்கையாளர்களை ஈர்ப்பதற்கான சிறந்த சந்தைப்படுத்தல் வழிகள் யாவை?`;
          if (lang === 'kn') return `ನನ್ನ ${bType || 'ವ್ಯವಹಾರಕ್ಕೆ'}${bLoc ? ' (' + bLoc + ')' : ''} ಗ್ರಾಹಕರನ್ನು ಆಕರ್ಷಿಸಲು ಉತ್ತಮ ಮಾರ್ಕೆಟಿಂಗ್ ತಂತ್ರಗಳು ಯಾವುವು?`;
          return `What are the most effective marketing strategies to attract customers for my ${bType || 'business'}${bLoc ? ' in ' + bLoc : ''}?`;

        case 'costs':
          if (lang === 'te') return `నా ${bType || 'వ్యాపారంలో'} ఖర్చులను ఎలా తగ్గించుకోవాలి మరియు బడ్జెట్‌ను ఎలా సమర్థవంతంగా నిర్వహించాలి?`;
          if (lang === 'hi') return `मेरे ${bType || 'बिजनेस'} की परिचालन लागत को कैसे कम करें और बजट का सही उपयोग कैसे करें?`;
          if (lang === 'ta') return `எனது ${bType || 'வணிகத்தின்'} செலவுகளை எவ்வாறு குறைப்பது மற்றும் பட்ஜெட்டை திறம்பட நிர்வகிப்பது எப்படி?`;
          if (lang === 'kn') return `ನನ್ನ ${bType || 'ವ್ಯವಹಾರದಲ್ಲಿ'} ವೆಚ್ಚವನ್ನು ಹೇಗೆ ಕಡಿಮೆ ಮಾಡುವುದು ಮತ್ತು ಬಜೆಟ್ ಅನ್ನು ಸರಿಯಾಗಿ ನಿರ್ವಹಿಸುವುದು ಹೇಗೆ?`;
          return `How can I reduce operational expenses and manage my budget${bBudget ? ' of ' + bBudget : ''} for my ${bType || 'business'}?`;

        case 'focus':
          if (lang === 'te') return `నా వ్యాపార వివరాలు${bGoal ? ' మరియు లక్ష్యం (' + bGoal + ')' : ''} ఆధారంగా, నేను తదుపరి ఏ ముఖ్యమైన పనులపై దృష్టి పెట్టాలి?`;
          if (lang === 'hi') return `मेरे बिजनेस विवरण${bGoal ? ' और लक्ष्य (' + bGoal + ')' : ''} के आधार पर, मुझे आगे किन प्राथमिकताओं पर ध्यान देना चाहिए?`;
          if (lang === 'ta') return `எனது வணிக விவரங்களின் அடிப்படையில், அடுத்து நான் எதில் கவனம் செலுத்த வேண்டும்?`;
          if (lang === 'kn') return `ನನ್ನ ವ್ಯವಹಾರದ ವಿವರಗಳ ಆಧಾರದ ಮೇಲೆ, ನಾನು ಮುಂದೆ ಯಾವುದರ ಮೇಲೆ ಗಮನಹರಿಸಬೇಕು?`;
          return `Based on my business details and goal to "${bGoal || 'succeed'}", what specific priorities should I focus on next?`;

        default:
          return `What advice do you have for my ${bType || 'business'}?`;
      }
    };

    // Dynamically contextualize titles when business details exist
    const getActionTitle = (actionKey, fallbackTitle) => {
      if (actionKey === 'grow' && bType) {
        return lang === 'en' ? `Grow my ${bType}` : fallbackTitle;
      }
      if (actionKey === 'marketing' && bLoc) {
        return lang === 'en' ? `Improve marketing in ${bLoc}` : fallbackTitle;
      }
      if (actionKey === 'costs' && bBudget) {
        return lang === 'en' ? `Reduce costs (${bBudget})` : fallbackTitle;
      }
      return fallbackTitle;
    };

    const actionItems = [
      ...(canContinuePrevious ? [{
        id: 'action-continue',
        key: 'continue',
        title: actionsConfig?.continue?.title || activeT.continuePreviousConversation || "Continue my previous conversation",
        category: actionsConfig?.continue?.category || "Journey Continuity",
        icon: "🔄",
      }] : []),
      {
        id: 'action-grow',
        key: 'grow',
        title: getActionTitle('grow', actionsConfig?.grow?.title || "Grow my business"),
        category: actionsConfig?.grow?.category || "Growth & Scale",
        icon: actionsConfig?.grow?.icon || "📈",
      },
      {
        id: 'action-marketing',
        key: 'marketing',
        title: getActionTitle('marketing', actionsConfig?.marketing?.title || "Improve my marketing"),
        category: actionsConfig?.marketing?.category || "Marketing",
        icon: actionsConfig?.marketing?.icon || "📢",
      },
      {
        id: 'action-costs',
        key: 'costs',
        title: getActionTitle('costs', actionsConfig?.costs?.title || "Reduce my costs"),
        category: actionsConfig?.costs?.category || "Cost Control",
        icon: actionsConfig?.costs?.icon || "💰",
      },
      {
        id: 'action-focus',
        key: 'focus',
        title: getActionTitle('focus', actionsConfig?.focus?.title || "What should I focus on next?"),
        category: actionsConfig?.focus?.category || "Strategy",
        icon: actionsConfig?.focus?.icon || "🎯",
      }
    ];

    return (
      <section className={`suggested-questions-container returning-actions ${isCompact ? 'compact' : ''}`}>
        <div className="suggested-header">
          <span className="suggested-label">
            {activeT.returningActionsLabel || "What would you like to work on today?"}
          </span>
        </div>
        <div className="suggested-grid">
          {actionItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="suggestion-card context-action-card"
              onClick={() => {
                if (item.key === 'continue' && onContinuePrevious) {
                  onContinuePrevious();
                } else {
                  onSelectQuestion(getActionQuery(item.key), item.id);
                }
              }}
            >
              <div className="suggestion-card-top">
                <span className="suggestion-icon">{item.icon}</span>
                <span className="suggestion-category">{item.category}</span>
              </div>
              <p className="suggestion-text">{item.title}</p>
              <span className="suggestion-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // If user is a NEW USER (not onboarded yet or right after onboarding):
  // Show beginner-friendly generic suggested questions
  const beginnerSuggestions = activeT.suggestions || translations.en.suggestions;

  return (
    <section className={`suggested-questions-container beginner-questions ${isCompact ? 'compact' : ''}`}>
      <div className="suggested-header">
        <span className="suggested-label">
          {activeT.beginnerQuestionsLabel || activeT.suggestedLabel || "Frequently asked by beginners:"}
        </span>
      </div>
      <div className="suggested-grid">
        {beginnerSuggestions.map((item) => (
          <button
            key={item.id}
            type="button"
            className="suggestion-card beginner-card"
            onClick={() => onSelectQuestion(item.text, item.id)}
          >
            <div className="suggestion-card-top">
              <span className="suggestion-icon">{item.icon}</span>
              <span className="suggestion-category">{item.category}</span>
            </div>
            <p className="suggestion-text">{item.text}</p>
            <span className="suggestion-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
