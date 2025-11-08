import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '激光切割余料再利用工具',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' }).catch(() => undefined);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('save-svg', async (_event, svgContent: string, defaultName: string) => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' };
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '保存SVG文件',
      defaultPath: defaultName || 'output.svg',
      filters: [
        { name: 'SVG 文件', extensions: ['svg'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });

    if (!filePath) {
      return { success: false, error: '用户取消保存' };
    }

    fs.writeFileSync(filePath, svgContent, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('保存SVG失败:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('load-svg', async () => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' };
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '打开SVG文件',
      filters: [
        { name: 'SVG 文件', extensions: ['svg'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (!filePaths || filePaths.length === 0) {
      return { success: false, error: '用户取消打开' };
    }

    const svg = fs.readFileSync(filePaths[0], 'utf-8');
    return { success: true, content: svg, path: filePaths[0] };
  } catch (error) {
    console.error('加载SVG失败:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('run-deepnest', async (_event, config: { materialSvg: string; partsSvg: string[]; outputPath: string }) => {
  console.log('收到 Deepnest 调用请求:', config);
  // TODO: 在这里集成真实 Deepnest 调用
  return {
    success: true,
    outputPath: config.outputPath,
    message: 'Deepnest 调用已模拟完成',
  };
});
