/**
 * 处理参数控制组件
 * 包含自动校正、角点校正、实际尺寸、Potrace参数等控制
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Point } from '../../utils/imageProcessor';

interface ProcessingControlsProps {
  processing: boolean;
  threshold: number | null;
  turdSize: number;
  optTolerance: number;
  actualWidth: number;
  actualHeight: number;
  cornersDirty: boolean;
  applyingCorners: boolean;
  manualCorners: Point[];
  onThresholdChange: (threshold: number | null) => void;
  onTurdSizeChange: (turdSize: number) => void;
  onOptToleranceChange: (optTolerance: number) => void;
  onActualWidthChange: (width: number) => void;
  onActualHeightChange: (height: number) => void;
  onAutoCorrect: () => void;
  onApplyCorners: () => void;
  onProcess: () => void;
}

const ProcessingControls: React.FC<ProcessingControlsProps> = ({
  processing,
  threshold,
  turdSize,
  optTolerance,
  actualWidth,
  actualHeight,
  cornersDirty,
  applyingCorners,
  manualCorners,
  onThresholdChange,
  onTurdSizeChange,
  onOptToleranceChange,
  onActualWidthChange,
  onActualHeightChange,
  onAutoCorrect,
  onApplyCorners,
  onProcess,
}) => {
  const { t } = useTranslation();

  return (
    <div className="processing-section">
      <div className="processing-params">
        <h4>{t('imageProcessor.autoCorrect.title')}</h4>
        <button className="btn btn-primary" onClick={onAutoCorrect} disabled={processing}>
          {processing ? t('common.processing') : t('imageProcessor.autoCorrect.button')}
        </button>
        <p className="hint">{t('imageProcessor.autoCorrect.hint')}</p>
      </div>

      <div className="processing-params">
        <h4>{t('imageProcessor.cornerCorrection.title')}</h4>
        <p className="hint">{t('imageProcessor.cornerCorrection.hint')}</p>
        <div className={`corner-status ${cornersDirty ? 'dirty' : 'clean'}`}>
          {t('imageProcessor.cornerCorrection.status.current')}: {cornersDirty ? t('imageProcessor.cornerCorrection.status.dirty') : t('imageProcessor.cornerCorrection.status.clean')}
        </div>
        <button
          className="btn btn-secondary"
          onClick={onApplyCorners}
          disabled={applyingCorners || manualCorners.length < 3}
        >
          {applyingCorners ? t('imageProcessor.cornerCorrection.applying') : t('imageProcessor.cornerCorrection.applyButton')}
        </button>
        {manualCorners.length < 3 && (
          <small className="hint">{t('imageProcessor.cornerCorrection.minCornersHint')}</small>
        )}
      </div>

      <div className="processing-params">
        <h4>{t('imageProcessor.actualSize.title')}</h4>
        <p className="hint">{t('imageProcessor.actualSize.hint')}</p>
        <label>
          {t('imageProcessor.actualSize.width')}
          <input
            type="number"
            min={0}
            step={0.1}
            value={actualWidth}
            onChange={(e) => onActualWidthChange(Number(e.target.value))}
          />
        </label>
        <label>
          {t('imageProcessor.actualSize.height')}
          <input
            type="number"
            min={0}
            step={0.1}
            value={actualHeight}
            onChange={(e) => onActualHeightChange(Number(e.target.value))}
          />
        </label>
        <small>{t('imageProcessor.actualSize.description')}</small>
      </div>

      <div className="processing-params">
        <h4>{t('imageProcessor.potrace.title')}</h4>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={threshold === null}
            onChange={(e) => onThresholdChange(e.target.checked ? null : 128)}
          />
          {t('imageProcessor.potrace.autoThreshold')}
        </label>
        {threshold !== null && (
          <label>
            {t('imageProcessor.potrace.threshold')} {threshold}
            <input
              type="range"
              min={0}
              max={255}
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
            />
          </label>
        )}
        <label>
          {t('imageProcessor.potrace.turdSize')}: {turdSize}
          <input
            type="range"
            min={0}
            max={10}
            value={turdSize}
            onChange={(e) => onTurdSizeChange(Number(e.target.value))}
          />
        </label>
        <label>
          {t('imageProcessor.potrace.optTolerance')}: {optTolerance.toFixed(2)}
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={optTolerance}
            onChange={(e) => onOptToleranceChange(Number(e.target.value))}
          />
        </label>
      </div>

      <button className="btn btn-primary btn-process" onClick={onProcess} disabled={processing}>
        {processing ? t('common.processing') : t('imageProcessor.generateSvg')}
      </button>
    </div>
  );
};

export default ProcessingControls;

