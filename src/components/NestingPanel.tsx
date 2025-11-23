import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './NestingPanel.css';

interface NestingPanelProps {
  materialSvg: string;
  actualSize?: { width: number; height: number };
  onBack: () => void;
}

const NestingPanel: React.FC<NestingPanelProps> = ({ materialSvg, actualSize, onBack }) => {
  const { t } = useTranslation();
  const [outputMessage, setOutputMessage] = useState<string | null>(null);

  const handleRunDeepnest = async () => {
    if (!window.electronAPI) {
      setOutputMessage(t('nestingPanel.error.electronNotInit', { defaultValue: 'Electron API 未初始化' }));
      return;
    }

    setOutputMessage(t('nestingPanel.callingDeepnest', { defaultValue: '正在调用 Deepnest ...' }));
    const result = await window.electronAPI.runDeepnest({
      materialSvg,
      partsSvg: [],
      outputPath: 'nested-output.svg',
    });

    if (result.success) {
      setOutputMessage(result.message ?? t('nestingPanel.deepnestComplete', { defaultValue: 'Deepnest 调用完成' }));
    } else {
      setOutputMessage(result.message ?? t('nestingPanel.deepnestFailed', { defaultValue: '调用失败' }));
    }
  };

  const handleDownload = () => {
    if (!materialSvg) return;
    
    // 生成时间戳（月日时分）
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${month}${day}-${hour}${minute}`;
    
    const blob = new Blob([materialSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `material-${timestamp}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="nesting-panel">
      <div className="panel-header">
        <button className="btn" onClick={onBack}>{t('nestingPanel.back')}</button>
        <div className="size-info">
          {actualSize ? (
            <span>{t('nestingPanel.actualSize', { width: actualSize.width.toFixed(1), height: actualSize.height.toFixed(1) })}</span>
          ) : (
            <span>{t('nestingPanel.noActualSize', { defaultValue: '未设置实际尺寸' })}</span>
          )}
        </div>
        <button className="btn btn-secondary" onClick={handleDownload}>{t('nestingPanel.download')}</button>
      </div>

      <div className="material-preview" dangerouslySetInnerHTML={{ __html: materialSvg }} />

      <div className="panel-actions">
        <button className="btn btn-primary" onClick={handleRunDeepnest}>{t('nestingPanel.optimize')}</button>
        {outputMessage && <span className="run-message">{outputMessage}</span>}
      </div>
    </div>
  );
};

export default NestingPanel;
