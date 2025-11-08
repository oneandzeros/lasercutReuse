# 激光切割余料再利用工具

基于 Electron + React 的桌面工具，帮助对激光切割机剩余材料进行拍照识别、转换为 SVG，并集成 Deepnest 进行排版优化。

## 开发

```bash
npm install
npm run dev
```

- React 前端运行在 `http://localhost:5173`
- Electron 会在其加载完成后启动

## 构建

```bash
npm run build
```

生成的渲染进程代码位于 `dist-react/`，Electron 主进程输出至 `dist/`。

## 主要功能

- 摄像头拍照或上传余料照片
- 自动检测红色标记角点（支持手动校正的后续开发）
- Potrace 位图描摹生成 SVG
- Deepnest 排版流程占位
