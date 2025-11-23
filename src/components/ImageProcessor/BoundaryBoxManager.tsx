/**
 * 边界框管理组件
 * 负责边界框的添加和管理
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface BoundaryBoxManagerProps {
  hasBoundaryBox: boolean;
  boundaryBoxWidthMm: number;
  boundaryBoxHeightMm: number;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  onAddBoundaryBox: () => void;
  onClearShapes: () => void;
}

const BoundaryBoxManager: React.FC<BoundaryBoxManagerProps> = ({
  hasBoundaryBox,
  boundaryBoxWidthMm,
  boundaryBoxHeightMm,
  onWidthChange,
  onHeightChange,
  onAddBoundaryBox,
  onClearShapes,
}) => {
  const { t } = useTranslation();

  return (
    <div className="shape-section">
      <h5>{t('imageProcessor.shapeTools.management.title')}</h5>
      <div className="shape-control-grid">
        <label>
          {t('imageProcessor.shapeTools.management.boundaryWidth')}
          <input
            type="number"
            min={1}
            step={1}
            value={boundaryBoxWidthMm}
            onChange={(e) => {
              const value = Number(e.target.value);
              onWidthChange(Number.isFinite(value) ? Math.max(1, value) : 600);
            }}
          />
        </label>
        <label>
          {t('imageProcessor.shapeTools.management.boundaryHeight')}
          <input
            type="number"
            min={1}
            step={1}
            value={boundaryBoxHeightMm}
            onChange={(e) => {
              const value = Number(e.target.value);
              onHeightChange(Number.isFinite(value) ? Math.max(1, value) : 400);
            }}
          />
        </label>
      </div>
      <div className="shape-buttons">
        <button className="btn btn-secondary" onClick={onAddBoundaryBox}>
          {hasBoundaryBox ? t('imageProcessor.shapeTools.management.reAddBoundary') : t('imageProcessor.shapeTools.management.addBoundary')}
        </button>
        <button className="btn btn-secondary" onClick={onClearShapes}>
          {t('imageProcessor.shapeTools.management.clearShapes')}
        </button>
      </div>
    </div>
  );
};

export default BoundaryBoxManager;

