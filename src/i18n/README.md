# i18n 国际化说明

本项目已集成 i18n（国际化）功能，支持多语言切换。

## 支持的语言

- **中文（简体）** (`zh-CN`) - 默认语言
- **English** (`en-US`)

## 文件结构

```
src/i18n/
├── config.ts              # i18n配置文件
├── locales/
│   ├── zh-CN.json        # 中文翻译
│   └── en-US.json        # 英文翻译
└── README.md             # 本文件
```

## 使用方法

### 在组件中使用翻译

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('app.title')}</h1>
      <p>{t('app.step1')}</p>
    </div>
  );
}
```

### 带参数的翻译

```tsx
// JSON: "tip": "在图上点击剩余角点以补齐（{{count}}/4）"
t('imageProcessor.cornerCorrection.tip', { count: manualCorners.length })
```

### 语言切换

语言切换器已集成在 `App.tsx` 中，用户可以通过右上角的语言选择器切换语言。

语言偏好会自动保存到 `localStorage`，下次访问时会自动使用上次选择的语言。

## 添加新语言

1. 在 `src/i18n/locales/` 目录下创建新的语言文件，例如 `ja-JP.json`（日语）
2. 复制 `zh-CN.json` 或 `en-US.json` 作为模板
3. 翻译所有文本内容
4. 在 `src/i18n/config.ts` 中：
   - 在 `supportedLanguages` 数组中添加新语言
   - 在 `resources` 对象中添加新语言的资源

示例：

```typescript
// config.ts
export const supportedLanguages = [
  { code: 'zh-CN', name: '中文', nativeName: '简体中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'ja-JP', name: '日本語', nativeName: '日本語' }, // 新增
] as const;

const resources = {
  'zh-CN': { translation: zhCN },
  'en-US': { translation: enUS },
  'ja-JP': { translation: jaJP }, // 新增
};
```

## 翻译键命名规范

翻译键采用点分隔的层级结构，建议按功能模块组织：

- `common.*` - 通用文本（按钮、状态等）
- `app.*` - 应用主界面
- `cameraCapture.*` - 相机捕获功能
- `imageProcessor.*` - 图像处理功能
  - `imageProcessor.autoCorrect.*` - 自动校正
  - `imageProcessor.cornerCorrection.*` - 角点校正
  - `imageProcessor.shapeTools.*` - 图形工具
- `nestingPanel.*` - 排版优化功能

## 注意事项

1. **保持键的一致性**：所有语言文件必须包含相同的键
2. **使用插值**：对于动态内容，使用 `{{variable}}` 语法
3. **默认值**：可以使用 `defaultValue` 参数提供后备文本（开发时有用）
4. **复数形式**：i18next 支持复数形式，但当前未使用，如需要可参考 i18next 文档

## 技术栈

- [i18next](https://www.i18next.com/) - 国际化框架
- [react-i18next](https://react.i18next.com/) - React 集成
- [i18next-browser-languagedetector](https://github.com/i18next/i18next-browser-languagedetector) - 浏览器语言检测

