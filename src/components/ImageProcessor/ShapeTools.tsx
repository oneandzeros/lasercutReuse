/**
 * 图形工具组件
 * 包含手动添加图形和自动填充功能
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { RectanglePackingProgress } from '../../utils/imageProcessor';
import { ShapeMessageTone } from '../../hooks/useShapeTools';

interface ShapeState {
  padding: number;
  cornerRadius: number;
  strokeWidth: number;
  strokeColor: string;
  gap: number;
  step: number;
}

interface ShapeToolsProps {
  hasBoundaryBox: boolean;
  shapeState: ShapeState;
  onShapeStateChange: (updates: Partial<ShapeState>) => void;
  onAddShape: (shape: 'roundedRect' | 'circle') => void;
  onAutoFill: () => void;
  onStopAutoFill: () => void;
  autoFilling: boolean;
  autoFillProgress: RectanglePackingProgress | null;
  shapeMessage: string | null;
  shapeMessageTone: ShapeMessageTone;
}

const ShapeTools: React.FC<ShapeToolsProps> = ({
  hasBoundaryBox,
  shapeState,
  onShapeStateChange,
  onAddShape,
  onAutoFill,
  onStopAutoFill,
  autoFilling,
  autoFillProgress,
  shapeMessage,
  shapeMessageTone,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* 手动添加图形区域 */}
      <div className="shape-section">
        <h5>{t('imageProcessor.shapeTools.manual.title')}</h5>
        <div className="shape-control-grid">
          <label>
            {t('imageProcessor.shapeTools.manual.padding')}
            <input
              type="number"
              min={0}
              step={1}
              value={shapeState.padding}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ padding: Number.isFinite(value) ? Math.max(0, value) : 0 });
              }}
            />
          </label>
          <label>
            {t('imageProcessor.shapeTools.manual.cornerRadius')}
            <input
              type="number"
              min={0}
              step={1}
              value={shapeState.cornerRadius}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ cornerRadius: Number.isFinite(value) ? Math.max(0, value) : 0 });
              }}
            />
          </label>
          <label>
            {t('imageProcessor.shapeTools.manual.strokeWidth')}
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={shapeState.strokeWidth}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ strokeWidth: Number.isFinite(value) ? Math.max(0.1, value) : 0.1 });
              }}
            />
          </label>
          <label className="color-picker">
            {t('imageProcessor.shapeTools.manual.color')}
            <input
              type="color"
              value={shapeState.strokeColor}
              onChange={(e) => onShapeStateChange({ strokeColor: e.target.value })}
            />
          </label>
        </div>
        <div className="shape-buttons">
          <button
            className="btn btn-secondary"
            onClick={() => onAddShape('roundedRect')}
            disabled={!hasBoundaryBox}
            title={!hasBoundaryBox ? t('imageProcessor.shapeTools.manual.needBoundary') : ''}
          >
            {t('imageProcessor.shapeTools.manual.addRoundedRect')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onAddShape('circle')}
            disabled={!hasBoundaryBox}
            title={!hasBoundaryBox ? t('imageProcessor.shapeTools.manual.needBoundary') : ''}
          >
            {t('imageProcessor.shapeTools.manual.addCircle')}
          </button>
        </div>
      </div>

      {/* 自动填充矩形区域 */}
      <div className="shape-section">
        <h5>{t('imageProcessor.shapeTools.autoFill.title')}</h5>
        <div className="shape-control-grid">
          <label>
            {t('imageProcessor.shapeTools.manual.padding')}
            <input
              type="number"
              min={0}
              step={1}
              value={shapeState.padding}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ padding: Number.isFinite(value) ? Math.max(0, value) : 0 });
              }}
            />
          </label>
          <label>
            {t('imageProcessor.shapeTools.manual.cornerRadius')}
            <input
              type="number"
              min={0}
              step={1}
              value={shapeState.cornerRadius}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ cornerRadius: Number.isFinite(value) ? Math.max(0, value) : 0 });
              }}
            />
          </label>
          <label>
            {t('imageProcessor.shapeTools.manual.strokeWidth')}
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={shapeState.strokeWidth}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ strokeWidth: Number.isFinite(value) ? Math.max(0.1, value) : 0.1 });
              }}
            />
          </label>
          <label className="color-picker">
            {t('imageProcessor.shapeTools.manual.color')}
            <input
              type="color"
              value={shapeState.strokeColor}
              onChange={(e) => onShapeStateChange({ strokeColor: e.target.value })}
            />
          </label>
          <label>
            {t('imageProcessor.shapeTools.autoFill.gap')}
            <input
              type="number"
              min={0}
              step={1}
              value={shapeState.gap}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ gap: Number.isFinite(value) ? Math.max(0, value) : 0 });
              }}
            />
          </label>
          <label>
            {t('imageProcessor.shapeTools.autoFill.step')}
            <input
              type="number"
              min={1.0}
              step={0.1}
              value={shapeState.step}
              onChange={(e) => {
                const value = Number(e.target.value);
                onShapeStateChange({ step: Number.isFinite(value) ? Math.max(1.0, value) : 1.0 });
              }}
            />
          </label>
        </div>
        <div className="shape-buttons">
          <button
            className="btn btn-primary"
            onClick={onAutoFill}
            disabled={autoFilling || !hasBoundaryBox}
            title={!hasBoundaryBox ? t('imageProcessor.shapeTools.manual.needBoundary') : ''}
          >
            {autoFilling ? t('imageProcessor.shapeTools.autoFill.filling') : t('imageProcessor.shapeTools.autoFill.button')}
          </button>
          {autoFilling && (
            <button className="btn btn-secondary" onClick={onStopAutoFill}>
              {t('imageProcessor.shapeTools.autoFill.stop')}
            </button>
          )}
        </div>
        {autoFilling && autoFillProgress && (
          <div className="shape-progress">
            <span>{t('imageProcessor.shapeTools.autoFill.progress', { progress: Math.round((autoFillProgress.progress ?? 0) * 100) })}</span>
            <span>
              {t('imageProcessor.shapeTools.autoFill.rows', { processed: autoFillProgress.processedRows, total: autoFillProgress.totalRows || 0 })}
            </span>
            <span>{t('imageProcessor.shapeTools.autoFill.suggestions', { count: autoFillProgress.suggestions })}</span>
          </div>
        )}
      </div>

      {/* 消息显示 */}
      {shapeMessage && (
        <div className={`shape-message ${shapeMessageTone}`}>
          {autoFilling && <span className="shape-spinner" aria-hidden="true" />}
          {shapeMessage}
        </div>
      )}
    </>
  );
};

export default ShapeTools;

