/**
 * i18n配置文件
 * 支持多语言切换，当前支持中文和英文
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

// 支持的语言列表
export const supportedLanguages = [
  { code: 'zh-CN', name: '中文', nativeName: '简体中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
] as const;

export type SupportedLanguageCode = typeof supportedLanguages[number]['code'];

// 资源文件
const resources = {
  'zh-CN': {
    translation: zhCN,
  },
  'en-US': {
    translation: enUS,
  },
};

i18n
  .use(LanguageDetector) // 自动检测浏览器语言
  .use(initReactI18next) // 初始化react-i18next
  .init({
    resources,
    fallbackLng: 'en-US', // 默认语言
    supportedLngs: supportedLanguages.map((lang) => lang.code),
    interpolation: {
      escapeValue: false, // React已经转义了
    },
    detection: {
      // 语言检测配置
      // 优先级：1. localStorage中保存的语言 2. 浏览器语言 3. 默认语言(en-US)
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'], // 保存到localStorage，确保应用重启后仍能记住用户选择
      lookupLocalStorage: 'i18nextLng',
      // 确保即使浏览器语言不支持，也使用localStorage中的设置
      checkWhitelist: true, // 只使用支持的语言列表中的语言
    },
  });

export default i18n;

