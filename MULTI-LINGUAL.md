# Multi-Lingual Support Refactoring Plan

## Overview

This document outlines a phased approach to refactor the WDK Starter React Native project for multi-lingual support using industry best practices for Expo.dev applications. The implementation will use `expo-localization`, `react-i18next`, and `i18next` for translation management.

## Current State Analysis

### Project Structure

- **Framework**: Expo Router (~54.0.8) with React Native 0.81.4
- **Architecture**: File-based routing with TypeScript
- **Key Directories**:
  - `src/app/` - 30+ screen components
  - `src/components/` - Reusable components
  - `src/utils/` - Utility functions
  - `src/config/` - Configuration files
  - `src/services/` - Service layer

### Hardcoded Text Locations

Based on codebase analysis, hardcoded strings are found in:

- Screen components (`src/app/*.tsx`) - titles, labels, placeholders, button text
- Reusable components (`src/components/*.tsx`) - "Back" button, headers
- Error messages (`src/utils/get-error-message.ts`)
- Alert dialogs (e.g., wallet deletion confirmation)
- Toast messages
- Form labels and placeholders
- Section headers and descriptions

### Key Challenges

1. **Widespread hardcoded strings** across 30+ screen files
2. **Dynamic text generation** (e.g., "Purchase for {amount} sats = ${usd}")
3. **Date/number formatting** needs localization
4. **RTL language support** (Arabic, Hebrew)
5. **Currency formatting** (already uses USD, needs multi-currency support)

## Technology Stack

### Core Libraries

- **expo-localization**: Device locale detection
- **react-i18next**: React bindings for i18next
- **i18next**: Core internationalization framework
- **@react-native-async-storage/async-storage**: Persist language preference (already installed)

### Initial Target Languages

- English (en) - Default/fallback
- Spanish (es)
- French (fr)
- German (de)
- Chinese Simplified (zh-CN)
- Japanese (ja)

## Phase 1: Foundation Setup (Week 1)

### 1.1 Install Dependencies

```bash
npx expo install expo-localization react-i18next i18next
```

### 1.2 Create i18n Directory Structure

```
src/
  i18n/
    locales/
      en/
        translation.json
        common.json
        screens.json
        errors.json
      es/
        translation.json
        common.json
        screens.json
        errors.json
      fr/
        ...
      de/
        ...
      zh-CN/
        ...
      ja/
        ...
    index.ts
    config.ts
```

### 1.3 Configure i18next

**File**: `src/i18n/index.ts`

Create i18next configuration with:

- Device locale detection via `expo-localization`
- AsyncStorage persistence for language preference
- Fallback to English
- Namespace support (common, screens, errors)
- Interpolation configuration for dynamic values

**File**: `src/i18n/config.ts`

Define:

- Supported languages list
- Default language
- Language switching utilities
- RTL language detection

### 1.4 Update app.json

Add `expo-localization` plugin to plugins array.

### 1.5 Create Translation Hook

**File**: `src/hooks/use-translation.ts`

Custom hook wrapping `useTranslation` with:

- Type-safe translation keys
- Namespace management
- Error handling for missing translations

## Phase 2: Core Components & Utilities (Week 1-2)

### 2.1 Initialize i18n in Root Layout

**File**: `src/app/_layout.tsx`

- Import and initialize i18n before app renders
- Handle async initialization
- Set up language change listeners

### 2.2 Refactor Common Components

#### Header Component

**File**: `src/components/header.tsx`

- Replace "Back" hardcoded text
- Make `title` prop translatable (or accept translation key)

#### Button Components

- Standardize button text through translation keys
- Create reusable button translation patterns

### 2.3 Create Translation Utilities

#### Format Utilities

**Files**:

- `src/utils/format-date.ts` - Localized date formatting
- `src/utils/format-number.ts` - Localized number formatting
- `src/utils/format-currency.ts` - Multi-currency support

Update existing:

- `src/utils/format-amount.ts` - Add i18n support
- `src/utils/format-usd-value.ts` - Add currency localization

### 2.4 Error Message Localization

**File**: `src/utils/get-error-message.ts`

- Map error codes to translation keys
- Support parameterized error messages
- Fallback to English error messages

## Phase 3: Screen-by-Screen Refactoring (Week 2-4)

### 3.1 Priority Screens (High Traffic)

1. **Wallet Screen** (`src/app/wallet.tsx`)

   - Balance labels
   - Transaction types
   - Action buttons

2. **Onboarding Flow** (`src/app/onboarding/`)

   - Welcome messages
   - Setup instructions
   - Navigation labels

3. **Send Flow** (`src/app/send/`)

   - Form labels
   - Validation messages
   - Confirmation dialogs
   - Transaction summaries

4. **Receive Flow** (`src/app/receive/`)

   - QR code labels
   - Address display
   - Network selection

### 3.2 Secondary Screens

5. **Settings** (`src/app/settings.tsx`)

   - Section headers
   - Info labels
   - Alert dialogs (wallet deletion)

6. **Spaces** (`src/app/spaces.tsx`)

   - Dynamic purchase button text
   - Duration options
   - Info sections

7. **Activity** (`src/app/activity.tsx`)

   - Transaction status labels
   - Filter options

8. **Assets** (`src/app/assets.tsx`)

   - Asset labels
   - Balance displays

### 3.3 Remaining Screens

- Token Details
- Scan QR
- Wallet Setup flows
- Authorization

### 3.4 Translation Key Naming Convention

```
Format: namespace:category.key
Examples:
- common:buttons.back
- screens:wallet.title
- screens:send.form.amount
- errors:network.failed
- common:currency.usd
```

## Phase 4: Advanced Features (Week 4-5)

### 4.1 RTL Language Support

- Detect RTL languages (Arabic, Hebrew)
- Use `I18nManager.forceRTL()` for RTL layouts
- Test layout adjustments for RTL
- Update stylesheets to support RTL (use `flexDirection: 'row-reverse'` where needed)

### 4.2 Dynamic Content Localization

- Date/time formatting (relative: "2 hours ago")
- Number formatting (thousands separators, decimal points)
- Currency formatting (symbol placement, decimal precision)
- Pluralization rules (e.g., "1 transaction" vs "2 transactions")

### 4.3 Language Switcher

**File**: `src/app/settings.tsx` (new section)

- Add language selection UI
- Persist selection to AsyncStorage
- Reload app context on language change
- Show current language in settings

### 4.4 Testing Infrastructure

- Create translation key validation script
- Check for missing translations
- Validate interpolation parameters
- Test with all supported languages

## Phase 5: Translation Platform Integration Prep (Week 5-6)

### 5.1 Translation File Structure

Organize JSON files for easy import/export:

- Separate by namespace
- Use consistent key hierarchy
- Include context comments (via `_comment` fields)

### 5.2 Translation Management Scripts

**File**: `scripts/i18n/`

- `extract-keys.ts` - Extract all translation keys from codebase
- `validate-translations.ts` - Check completeness across languages
- `sync-translations.ts` - Sync with translation platform (future)
- `add-language.ts` - Scaffold new language files

### 5.3 Documentation

- Translation key reference guide
- Contributor guidelines for adding translations
- Translation platform setup instructions (Lokalise/Crowdin)

## Phase 6: Quality Assurance & Optimization (Week 6)

### 6.1 Testing

- Test all screens in each language
- Verify RTL layouts
- Test language switching
- Validate date/number/currency formatting
- Check for text overflow issues
- Test with long translations (German, Finnish)

### 6.2 Performance Optimization

- Lazy load translation files
- Cache frequently used translations
- Optimize bundle size (only include selected language in production)

### 6.3 Accessibility

- Ensure screen readers work with translations
- Test with system font scaling
- Verify text contrast in all languages

## Implementation Guidelines

### Translation Key Structure

```json
{
  "common": {
    "buttons": {
      "back": "Back",
      "cancel": "Cancel",
      "confirm": "Confirm",
      "delete": "Delete"
    },
    "labels": {
      "name": "Name",
      "amount": "Amount",
      "address": "Address"
    }
  },
  "screens": {
    "wallet": {
      "title": "Wallet",
      "balance": "Balance",
      "transactions": "Transactions"
    }
  }
}
```

### Component Usage Pattern

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <Text>{t('screens:wallet.title')}</Text>
  );
};
```

### Dynamic Values

```typescript
const { t } = useTranslation();
const amount = 1000;
const message = t('screens:send.amount', { amount });
// Translation: "Amount: {{amount}}"
```

### Pluralization

```typescript
const count = 5;
const message = t('common:transactions.count', { count });
// Handles: "1 transaction" vs "5 transactions"
```

## Migration Strategy

### Per-Screen Migration Steps

1. Identify all hardcoded strings in the file
2. Create translation keys in appropriate namespace
3. Replace strings with `t()` calls
4. Test in English first
5. Add translations for other languages
6. Test in all languages

### Backward Compatibility

- Keep English as fallback
- Gracefully handle missing translations
- Log missing translation keys in development

## Future Enhancements

### Translation Platform Integration

- Set up Lokalise/Crowdin/Transifex account
- Configure API integration
- Automate translation sync
- Enable translator collaboration

### Additional Languages

- Add more languages based on user demand
- Support regional variants (en-US, en-GB, zh-CN, zh-TW)

### Context-Aware Translations

- Different translations based on user context
- Formal vs informal language variants

## Success Metrics

- [ ] 100% of user-facing strings translated
- [ ] Support for 6+ languages
- [ ] RTL language support functional
- [ ] Language switcher in settings
- [ ] Zero missing translation errors in production
- [ ] Translation platform integration ready

## Timeline Summary

- **Week 1**: Foundation setup, core components
- **Week 2**: Priority screens refactoring
- **Week 3**: Secondary screens refactoring
- **Week 4**: Advanced features, remaining screens
- **Week 5**: Translation platform prep, testing
- **Week 6**: QA, optimization, documentation

**Total Estimated Time**: 6 weeks for complete implementation

## Notes

- Start with English translations extracted from current codebase
- Use professional translation services for initial translations
- Consider community contributions for additional languages
- Regular translation updates as features are added
- Monitor translation completeness in CI/CD pipeline
