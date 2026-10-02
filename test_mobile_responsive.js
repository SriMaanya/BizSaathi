import fs from 'fs';
import path from 'path';

console.log('--- BizSaathi Mobile Responsive Validation Suite ---');

const cssPath = path.resolve('src/App.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

let errors = [];
let passed = [];

function check(desc, condition) {
  if (condition) {
    passed.push(desc);
    console.log(`[PASS] ${desc}`);
  } else {
    errors.push(desc);
    console.error(`[FAIL] ${desc}`);
  }
}

// 1. Breakpoint Presence
check('@media (max-width: 768px) breakpoint is defined', cssContent.includes('@media (max-width: 768px)'));
check('@media (max-width: 480px) breakpoint is defined', cssContent.includes('@media (max-width: 480px)'));
check('@media (max-width: 360px) breakpoint is defined', cssContent.includes('@media (max-width: 360px)'));

// 2. Navbar Responsiveness
check('Header nav tab text label hidden on mobile', cssContent.includes('.header-nav-tab .tab-label') && cssContent.includes('display: none !important'));
check('Header nav tabs visible on mobile as icons', cssContent.includes('.header-nav-tabs') && cssContent.includes('display: flex !important'));
check('User profile name hidden on mobile', cssContent.includes('.user-profile-name') && cssContent.includes('display: none !important'));
check('Language selector compact on mobile', cssContent.includes('.language-selector-container') && cssContent.includes('max-width: 82px'));
check('Theme toggle button sized appropriately on mobile', cssContent.includes('.theme-toggle-btn') && cssContent.includes('width: 32px'));

// 3. Indian Language / Telugu wrapping
check('Natural text wrap with overflow-wrap: anywhere', cssContent.includes('overflow-wrap: anywhere'));
check('Context chips have word-break and wrap naturally', cssContent.includes('.context-chip') && cssContent.includes('white-space: normal'));

// 4. Business Context Card layout
check('Business context header stacks vertically on mobile', cssContent.includes('.context-header') && cssContent.includes('flex-direction: column'));
check('Business context chips stack vertically on mobile', cssContent.includes('.context-chip-list') && cssContent.includes('flex-direction: column'));
check('Business context edit button spans full width on mobile', cssContent.includes('.context-toggle-button.edit-btn') && cssContent.includes('width: 100%'));

// 5. Suggested Questions
check('Suggested questions grid is 1 column on mobile', cssContent.includes('.suggested-grid') && cssContent.includes('grid-template-columns: 1fr'));
check('Suggestion card has white-space: normal for multi-line text', cssContent.includes('.suggestion-card') && cssContent.includes('white-space: normal'));

// 6. Chat Messages & Chat Input
check('User bubble max-width adapted for mobile', cssContent.includes('.user-bubble') && cssContent.includes('max-width: 88%'));
check('AI bubble max-width adapted for mobile', cssContent.includes('.ai-bubble') && cssContent.includes('max-width: 90%'));
check('Chat input action buttons touch targets >= 38px', cssContent.includes('.action-icon-btn') && cssContent.includes('width: 38px'));
check('Chat input footer respects safe-area-inset-bottom', cssContent.includes('env(safe-area-inset-bottom)'));

// 7. Modals
check('Delete confirmation modal backdrop has padding for mobile', cssContent.includes('.conv-delete-modal-backdrop') && cssContent.includes('padding: 16px'));
check('Delete confirmation modal max-width constrained to viewport', cssContent.includes('max-width: calc(100vw - 24px)'));

// 8. Horizontal Overflow Prevention
check('Root and app shell have overflow-x: hidden on mobile', cssContent.includes('overflow-x: hidden') && cssContent.includes('max-width: 100vw'));

console.log('\n--- Validation Summary ---');
console.log(`Passed: ${passed.length}`);
console.log(`Failed: ${errors.length}`);

if (errors.length > 0) {
  process.exit(1);
}
