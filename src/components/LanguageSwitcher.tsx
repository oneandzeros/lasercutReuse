/**
 * 语言切换组件
 * 允许用户切换界面语言
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, SupportedLanguageCode } from '../i18n/config';
import './LanguageSwitcher.css';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (langCode: SupportedLanguageCode) => {
    // changeLanguage会自动保存到localStorage，下次打开应用时会自动使用保存的语言
    i18n.changeLanguage(langCode);
  };

  const currentLanguage = i18n.language as SupportedLanguageCode;

  return (
    <div className="language-switcher">
      <select
        value={currentLanguage}
        onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguageCode)}
        className="language-select"
        aria-label="Language selector"
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;

