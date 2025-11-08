import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveSvg: (svgContent: string, filename: string) =>
    ipcRenderer.invoke('save-svg', svgContent, filename),
  loadSvg: () =>
    ipcRenderer.invoke('load-svg'),
  runDeepnest: (config: {
    materialSvg: string;
    partsSvg: string[];
    outputPath: string;
  }) => ipcRenderer.invoke('run-deepnest', config),
});

declare global {
  interface Window {
    electronAPI: {
      saveSvg: (svgContent: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      loadSvg: () => Promise<{ success: boolean; content?: string; path?: string; error?: string }>;
      runDeepnest: (config: {
        materialSvg: string;
        partsSvg: string[];
        outputPath: string;
      }) => Promise<{ success: boolean; outputPath?: string; message?: string }>;
    };
  }
}
