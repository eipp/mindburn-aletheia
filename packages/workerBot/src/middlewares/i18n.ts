import { I18n } from '@telegraf/i18n';
import path from 'path';
import { createLogger } from '@mindburn/shared';

const logger = createLogger('worker-bot:i18n');

// Initialize i18n with default configuration
export const i18n = new I18n({
  directory: path.resolve(__dirname, '../../locales'),
  defaultLanguage: 'en',
  sessionName: 'session',
  useSession: true,
  templateData: {
    pluralize: (count: number, key: string, language: string) => {
      // Simple pluralization rules - extend as needed
      if (language === 'en') {
        return count === 1 ? key : `${key}s`;
      }
      return key;
    },
    formatNumber: (number: number) => {
      return new Intl.NumberFormat().format(number);
    },
    formatDate: (date: Date | string | number) => {
      return new Intl.DateTimeFormat().format(new Date(date));
    }
  }
});

// Add language detection
i18n.use((ctx, next) => {
  try {
    // Get user's language preference from Telegram
    const languageCode = ctx.from?.language_code;
    
    if (languageCode && i18n.availableLocales().includes(languageCode)) {
      ctx.i18n.locale(languageCode);
    } else {
      ctx.i18n.locale(i18n.defaultLanguage);
    }
  } catch (error) {
    logger.error('Language detection error:', error);
    ctx.i18n.locale(i18n.defaultLanguage);
  }
  
  return next();
}); 