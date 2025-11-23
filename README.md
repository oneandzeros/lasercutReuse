# FaboGinger

激光切割余料再利用工具

基于 Electron + React 的桌面工具，帮助对激光切割机剩余材料进行拍照识别、转换为 SVG，并集成 Deepnest 进行排版优化。

## 开发

```bash
npm install
npm run dev
```

- React 前端运行在 `http://localhost:5173`
- Electron 会在其加载完成后启动

## 构建

### 开发构建

```bash
npm run build
```

生成的渲染进程代码位于 `dist-react/`，Electron 主进程输出至 `dist/`。

### Windows 安装包构建

#### 标准安装包（NSIS）

```bash
npm run build:win
```

生成 Windows 安装程序（`.exe`），位于 `release/` 目录。

#### 便携版

```bash
npm run build:win:portable
```

生成便携版可执行文件，无需安装即可运行。

#### 所有架构

```bash
npm run build:win:all
```

同时构建 x64 和 ia32 架构的安装包。

#### 仅构建目录（不打包）

```bash
npm run build:win:dir
```

仅生成未打包的应用程序目录，用于测试。

### 安装包特性

- ✅ 支持自定义安装目录
- ✅ 自动创建桌面快捷方式
- ✅ 自动创建开始菜单快捷方式
- ✅ 支持中英文界面
- ✅ 支持 x64 和 ia32 架构
- ✅ 提供便携版选项

### 注意事项

1. **图标文件**：Windows 安装包需要 `build/icon.ico` 文件。如果文件不存在，electron-builder 会使用默认图标。建议准备自定义图标以提升专业度（详见 `build/README.md`）。

2. **代码签名**：如需代码签名，请在 `electron-builder.json` 中配置 `win.certificateFile` 和 `win.certificatePassword`。

## 主要功能

- 摄像头拍照或上传余料照片
- 自动检测红色标记角点（支持手动校正的后续开发）
- Potrace 位图描摹生成 SVG
- Deepnest 排版流程占位
