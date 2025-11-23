# FaboGinger

**中文 | [English](#english)**

---

## 项目简介 / Project Introduction

FaboGinger 是一个基于 Electron + React 的桌面应用程序，专门用于激光切割余料的再利用。通过拍照识别剩余材料、自动透视校正、位图描摹和排版优化，帮助用户最大化利用激光切割后的剩余材料。

FaboGinger is a desktop application built with Electron + React, designed for laser cutting material reuse. It helps users maximize the utilization of leftover materials from laser cutting through photo recognition, automatic perspective correction, bitmap tracing, and nesting optimization.

## 主要功能 / Key Features

### 三步工作流程 / Three-Step Workflow

1. **拍摄余料 / Capture Material**
   - 使用摄像头实时拍照或上传本地图片
   - 支持图片旋转调整
   - Real-time camera capture or upload local images
   - Support image rotation adjustment

2. **处理图像 / Process Image**
   - ✅ **自动透视校正**：自动检测红色标记角点并进行透视变换
     - Automatic perspective correction: Auto-detect red tape corners and perform perspective transformation
   - ✅ **手动角点校正**：支持拖动或点击调整四个角点位置，确保透视准确
     - Manual corner correction: Drag or click to adjust four corner positions for accurate perspective
   - ✅ **实际尺寸设置**：支持设置材料的实际物理尺寸（如 906 型号：603mm × 482mm）
     - Actual size setting: Set the physical dimensions of materials (e.g., model 906: 603mm × 482mm)
   - ✅ **Potrace 位图描摹**：将处理后的图像转换为高质量 SVG 矢量图
     - Potrace bitmap tracing: Convert processed images to high-quality SVG vector graphics
   - ✅ **SVG 预览与编辑**：支持 SVG 预览、缩放和拖拽调整
     - SVG preview and editing: Support SVG preview, zoom, and drag adjustment
   - ✅ **边界框管理**：添加、调整和拖拽边界框，定义可用区域
     - Boundary box management: Add, adjust, and drag boundary boxes to define available areas
   - ✅ **基础图形工具**：
     - Basic shape tools:
     - 手动添加圆角矩形和圆形
     - Manually add rounded rectangles and circles
     - 自动填充矩形：智能扫描空白区域并自动填充矩形（每个 ≤ 100×50mm）
     - Auto-fill rectangles: Intelligently scan blank areas and auto-fill rectangles (each ≤ 100×50mm)
   - ✅ **可调参数**：圆角、留白、线宽、间距等参数均可自定义
     - Adjustable parameters: Corner radius, padding, stroke width, gap, etc. are customizable

3. **排版优化 / Nesting Optimization**
   - 查看生成的 SVG 材料轮廓
   - View generated SVG material outline
   - 调用 Deepnest 进行排版优化（开发中）
   - Call Deepnest for nesting optimization (in development)
   - 导出 SVG 文件
   - Export SVG files

### 其他特性 / Additional Features

- 🌐 **多语言支持**：完整的中英文界面切换
  - Multi-language support: Complete Chinese/English interface switching
- 💾 **本地文件操作**：Electron 原生对话框支持，便捷的文件保存和加载
  - Local file operations: Electron native dialogs for convenient file save and load
- 🎨 **直观的用户界面**：清晰的三步流程指示器，实时预览反馈
  - Intuitive user interface: Clear three-step process indicator with real-time preview feedback

## 技术栈 / Tech Stack

- **前端框架 / Frontend Framework**: React 18.2 + TypeScript
- **桌面应用框架 / Desktop Framework**: Electron 28.0
- **构建工具 / Build Tool**: Vite 5.0
- **图像处理 / Image Processing**: 
  - Potrace 2.1.8（位图描摹）
  - Custom perspective correction algorithms（透视校正算法）
- **国际化 / Internationalization**: i18next + react-i18next
- **打包工具 / Packaging**: electron-builder 24.9

## 安装与开发 / Installation & Development

### 环境要求 / Requirements

- Node.js >= 18.0
- npm >= 9.0

### 安装依赖 / Install Dependencies

```bash
npm install
```

### 开发模式 / Development Mode

```bash
npm run dev
```

启动后：
- React 前端运行在 `http://localhost:5173`
- Electron 会在前端加载完成后自动启动
- 开发工具会自动打开

After startup:
- React frontend runs on `http://localhost:5173`
- Electron will start automatically after the frontend loads
- DevTools will open automatically

### 构建 / Build

#### 开发构建 / Development Build

```bash
npm run build
```

生成的渲染进程代码位于 `dist-react/`，Electron 主进程输出至 `dist/`。

Rendered process code is in `dist-react/`, and Electron main process output is in `dist/`.

#### Windows 安装包构建 / Windows Installer Build

##### 标准安装包（NSIS）/ Standard Installer (NSIS)

```bash
npm run build:win
```

生成 Windows 安装程序（`.exe`），位于 `release/` 目录。

Generates Windows installer (`.exe`) in the `release/` directory.

##### 便携版 / Portable Version

```bash
npm run build:win:portable
```

生成便携版可执行文件，无需安装即可运行。

Generates a portable executable that runs without installation.

##### 所有架构 / All Architectures

```bash
npm run build:win:all
```

同时构建 x64 和 ia32 架构的安装包。

Builds installers for both x64 and ia32 architectures.

##### 仅构建目录（不打包）/ Directory Only (No Packaging)

```bash
npm run build:win:dir
```

仅生成未打包的应用程序目录，用于测试。

Generates only the unpacked application directory for testing.

### 安装包特性 / Installer Features

- ✅ 支持自定义安装目录 / Support custom installation directory
- ✅ 自动创建桌面快捷方式 / Auto-create desktop shortcut
- ✅ 自动创建开始菜单快捷方式 / Auto-create start menu shortcut
- ✅ 支持中英文界面 / Support Chinese/English interface
- ✅ 支持 x64 和 ia32 架构 / Support x64 and ia32 architectures
- ✅ 提供便携版选项 / Portable version available

## 使用说明 / Usage Guide

### 基本流程 / Basic Workflow

1. **拍摄或上传余料照片**
   - 启动应用后，点击"拍照"按钮使用摄像头，或点击"上传图片"选择本地文件
   - 确认图片后进入下一步
   
   **Capture or upload material photo**
   - After launching the app, click "Capture" to use the camera, or click "Upload Image" to select a local file
   - Confirm the image and proceed to the next step

2. **处理图像**
   - 系统会自动尝试检测红色标记角点（建议在余料四角贴上红色胶带）
   - 如果自动检测不准确，可以点击"角点校正"手动调整四个角点
   - 设置材料的实际尺寸（可选，如 906 型号：603mm × 482mm）
   - 调整 Potrace 参数以获得最佳的 SVG 描摹效果
   - 点击"生成 SVG"创建矢量图
   - （可选）添加边界框和基础图形来标记可用区域
   - 确认无误后点击"确认使用"进入排版优化
   
   **Process image**
   - The system will automatically try to detect red tape corners (recommend placing red tape on the four corners)
   - If auto-detection is inaccurate, click "Corner Correction" to manually adjust the four corners
   - Set the actual material size (optional, e.g., model 906: 603mm × 482mm)
   - Adjust Potrace parameters for optimal SVG tracing
   - Click "Generate SVG" to create vector graphics
   - (Optional) Add boundary boxes and basic shapes to mark available areas
   - Click "Confirm Use" after verification to proceed to nesting optimization

3. **排版优化**
   - 查看生成的 SVG 材料轮廓
   - 点击"下载当前 SVG"保存文件
   - （开发中）调用 Deepnest 进行排版优化
   
   **Nesting optimization**
   - View the generated SVG material outline
   - Click "Download Current SVG" to save the file
   - (In development) Call Deepnest for nesting optimization

## 项目结构 / Project Structure

```
FaboGinger/
├── electron/                 # Electron 主进程代码
│   ├── main.ts              # Main process
│   └── preload.ts           # Preload script
├── src/
│   ├── components/          # React 组件
│   │   ├── CameraCapture.tsx       # 相机捕获组件
│   │   ├── ImageProcessor.tsx      # 图像处理主组件
│   │   │   └── ImageProcessor/     # 图像处理子组件
│   │   │       ├── BoundaryBoxManager.tsx
│   │   │       ├── CornerEditor.tsx
│   │   │       ├── ProcessingControls.tsx
│   │   │       ├── ShapeTools.tsx
│   │   │       └── SvgPreview.tsx
│   │   ├── NestingPanel.tsx        # 排版优化面板
│   │   └── LanguageSwitcher.tsx    # 语言切换器
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useBoundaryBox.ts
│   │   ├── useCornerEditing.ts
│   │   ├── useShapeTools.ts
│   │   └── useSvgManipulation.ts
│   ├── utils/               # 工具函数
│   │   ├── imageProcessor.ts      # 图像处理算法
│   │   ├── perspective.ts         # 透视校正
│   │   ├── coordinateUtils.ts     # 坐标工具
│   │   └── svgUtils.ts            # SVG 工具
│   ├── i18n/                # 国际化配置
│   │   ├── config.ts
│   │   └── locales/
│   │       ├── zh-CN.json   # 中文翻译
│   │       └── en-US.json   # 英文翻译
│   └── App.tsx              # 主应用组件
├── build/                   # 构建配置和资源
├── dist/                    # Electron 主进程构建输出
├── dist-react/              # React 应用构建输出
└── release/                 # 打包后的安装程序
```

## 功能详细说明 / Feature Details

### 自动透视校正 / Automatic Perspective Correction

系统会自动检测图片中的红色标记角点。建议在余料的四个角贴上红色胶带，以便系统准确识别。检测到角点后，系统会自动进行透视变换，将倾斜拍摄的图片校正为正视图。

The system automatically detects red tape corners in the image. It is recommended to place red tape on the four corners of the material for accurate detection. After detecting corners, the system automatically performs perspective transformation to correct tilted images to a front view.

### 手动角点校正 / Manual Corner Correction

如果自动检测不准确，可以使用手动校正功能：
- 拖动绿色圆点调整已检测到的角点位置
- 点击图片空白区域添加缺失的角点
- 至少需要标记 3 个角点（建议 4 个）才能完成透视校正
- 修改角点后需要点击"应用角点"才能生效

If auto-detection is inaccurate, you can use manual correction:
- Drag green dots to adjust detected corner positions
- Click blank areas to add missing corners
- At least 3 corners (4 recommended) are needed for perspective correction
- Click "Apply Corners" after modifying corners to take effect

### 边界框与图形工具 / Boundary Box & Shape Tools

边界框用于定义材料的可用区域。在边界框内，你可以：
- **手动添加图形**：添加圆角矩形或圆形，可设置留白、圆角、线宽等参数
- **自动填充矩形**：系统会智能扫描边界框内的空白区域，自动填充矩形（每个矩形 ≤ 100×50mm）
  - 可设置矩形间距和扫描步长
  - 支持随时停止自动填充过程

Boundary boxes define available areas of the material. Within boundary boxes, you can:
- **Manually add shapes**: Add rounded rectangles or circles with customizable padding, corner radius, stroke width, etc.
- **Auto-fill rectangles**: The system intelligently scans blank areas within the boundary box and auto-fills rectangles (each ≤ 100×50mm)
  - Adjustable rectangle gap and scan step
  - Support stopping the auto-fill process at any time

### SVG 预览与编辑 / SVG Preview & Editing

- 生成的 SVG 支持实时预览
- 可以缩放查看细节
- 边界框支持拖拽调整位置
- 所有操作都会实时反映在预览中

- Generated SVG supports real-time preview
- Zoom to view details
- Boundary boxes can be dragged to adjust position
- All operations are reflected in real-time in the preview

## 注意事项 / Notes

1. **图标文件 / Icon File**
   - Windows 安装包需要 `build/icon.ico` 文件。如果文件不存在，electron-builder 会使用默认图标。建议准备自定义图标以提升专业度。
   - Windows installer requires `build/icon.ico` file. If missing, electron-builder will use the default icon. It's recommended to prepare a custom icon for professionalism.

2. **代码签名 / Code Signing**
   - 如需代码签名，请在 `electron-builder.json` 中配置 `win.certificateFile` 和 `win.certificatePassword`。
   - For code signing, configure `win.certificateFile` and `win.certificatePassword` in `electron-builder.json`.

3. **相机权限 / Camera Permission**
   - 首次使用摄像头功能时，系统会请求相机权限，请允许访问。
   - When using the camera for the first time, the system will request camera permission. Please allow access.

4. **红色标记 / Red Markers**
   - 为了获得最佳的自动检测效果，建议在余料四角贴上红色胶带作为标记。
   - For best auto-detection results, it's recommended to place red tape on the four corners of the material as markers.

## 开发计划 / Development Roadmap

- [ ] 完善 Deepnest 集成 / Complete Deepnest integration
- [ ] 支持更多图形类型 / Support more shape types
- [ ] 优化自动填充算法 / Optimize auto-fill algorithm
- [ ] 添加材料数据库 / Add material database
- [ ] 支持批量处理 / Support batch processing

## 许可证 / License

MIT License

## 贡献 / Contributing

欢迎提交 Issue 和 Pull Request！

Contributions are welcome! Please feel free to submit Issues and Pull Requests.

---

## English

## Project Introduction

FaboGinger is a desktop application built with Electron + React, designed for laser cutting material reuse. It helps users maximize the utilization of leftover materials from laser cutting through photo recognition, automatic perspective correction, bitmap tracing, and nesting optimization.

**中文 | [English](#english)**

---

*For detailed documentation, see the Chinese section above.*
