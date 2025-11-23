/**
 * 图形工具自定义Hook
 * 管理手动添加图形和自动填充的逻辑
 */

import { useRef, useState } from 'react';
import { SvgProcessResult, suggestRectanglesFromMask, RectanglePackingProgress } from '../utils/imageProcessor';
import { getBoundaryBoxBounds, parseSvgViewBox } from '../utils/svgUtils';

export type ShapeMessageTone = 'info' | 'success' | 'warning' | 'error';

interface ShapeState {
  padding: number;
  cornerRadius: number;
  strokeWidth: number;
  strokeColor: string;
  gap: number; // 仅自动填充使用
  step: number; // 仅自动填充使用
}

interface UseShapeToolsProps {
  svgResult: SvgProcessResult | null;
  hasBoundaryBox: boolean;
  onSvgUpdate: (svg: string) => void;
  onError: (error: string) => void;
  t?: (key: string, options?: any) => string; // 可选的翻译函数
}

interface UseShapeToolsReturn {
  shapeState: ShapeState;
  setShapeState: React.Dispatch<React.SetStateAction<ShapeState>>;
  autoFilling: boolean;
  autoFillProgress: RectanglePackingProgress | null;
  shapeMessage: string | null;
  shapeMessageTone: ShapeMessageTone;
  handleAddShape: (shape: 'roundedRect' | 'circle') => void;
  handleAutoFillRectangles: () => Promise<void>;
  handleStopAutoFill: () => void;
  handleClearShapes: () => void;
  setShapeMessage: (message: string | null, tone?: ShapeMessageTone) => void;
  resetShapeState: () => void;
}

const DEFAULT_SHAPE_STATE: ShapeState = {
  padding: 12,
  cornerRadius: 2,
  strokeWidth: 0.1,
  strokeColor: '#ff4d4f',
  gap: 0,
  step: 1.0,
};

export const useShapeTools = ({
  svgResult,
  hasBoundaryBox,
  onSvgUpdate,
  onError,
  t = (key: string) => key, // 默认返回键本身
}: UseShapeToolsProps): UseShapeToolsReturn => {
  const [shapeState, setShapeState] = useState<ShapeState>(DEFAULT_SHAPE_STATE);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillProgress, setAutoFillProgress] = useState<RectanglePackingProgress | null>(null);
  const [shapeMessage, setShapeMessageState] = useState<string | null>(null);
  const [shapeMessageTone, setShapeMessageTone] = useState<ShapeMessageTone>('info');
  const autoFillAbortRef = useRef<boolean>(false);

  const setShapeMessage = (message: string | null, tone: ShapeMessageTone = 'info') => {
    setShapeMessageState(message);
    setShapeMessageTone(tone);
  };

  const resetShapeState = () => {
    setShapeState(DEFAULT_SHAPE_STATE);
    setShapeMessage(null);
    setAutoFilling(false);
    setAutoFillProgress(null);
    autoFillAbortRef.current = false;
  };

  // 手动添加图形
  const handleAddShape = (shape: 'roundedRect' | 'circle') => {
    if (!svgResult) return;
    if (!hasBoundaryBox) {
      setShapeMessage(t('imageProcessor.shapeTools.messages.noBoundary'), 'warning');
      return;
    }
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      onError(t('imageProcessor.errors.svgEditNotSupported'));
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgResult.svg, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('未找到 SVG 根节点');
      }

      const bounds = parseSvgViewBox(root);
      if (!bounds) {
        throw new Error('无法解析 SVG 的视图框');
      }

      // 获取边界框范围
      const boundaryBounds = getBoundaryBoxBounds(svgResult.svg);
      if (!boundaryBounds) {
        throw new Error('无法获取边界框范围');
      }

      const paddingMm = Math.max(0, shapeState.padding);
      const pxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const pxPerMmY = svgResult.viewHeight / svgResult.heightMm;
      const paddingX = paddingMm * pxPerMmX;
      const paddingY = paddingMm * pxPerMmY;
      const cornerRadiusPx = Math.max(0, shapeState.cornerRadius) * Math.min(pxPerMmX, pxPerMmY);
      const ns = 'http://www.w3.org/2000/svg';
      let element: Element;

      // 限制在边界框内部
      const boxX = boundaryBounds.x + paddingX;
      const boxY = boundaryBounds.y + paddingY;
      const boxWidth = Math.max(boundaryBounds.width - paddingX * 2, 0);
      const boxHeight = Math.max(boundaryBounds.height - paddingY * 2, 0);

      if (shape === 'roundedRect') {
        const width = Math.max(boxWidth, 0);
        const height = Math.max(boxHeight, 0);
        element = doc.createElementNS(ns, 'rect');
        element.setAttribute('x', `${boxX}`);
        element.setAttribute('y', `${boxY}`);
        element.setAttribute('width', `${width}`);
        element.setAttribute('height', `${height}`);
        if (width > 0 && height > 0) {
          const maxRadius = Math.min(width, height) / 2;
          const radius = Math.min(cornerRadiusPx, maxRadius);
          if (radius > 0) {
            element.setAttribute('rx', `${radius}`);
            element.setAttribute('ry', `${radius}`);
          }
        }
      } else {
        const radius = Math.max(0, Math.min(boxWidth, boxHeight) / 2);
        element = doc.createElementNS(ns, 'circle');
        element.setAttribute('cx', `${boxX + boxWidth / 2}`);
        element.setAttribute('cy', `${boxY + boxHeight / 2}`);
        element.setAttribute('r', `${radius}`);
      }

      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', shapeState.strokeColor);
      const strokeWidthPx = Math.max(0.1, shapeState.strokeWidth * Math.min(pxPerMmX, pxPerMmY));
      element.setAttribute('stroke-width', `${strokeWidthPx}`);
      element.setAttribute('vector-effect', 'non-scaling-stroke');
      element.setAttribute('data-extra-shape', 'manual');

      root.appendChild(element);

      const serialized = new XMLSerializer().serializeToString(doc);
      onSvgUpdate(serialized);
      setShapeMessage(t('imageProcessor.shapeTools.messages.shapeAdded'), 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setShapeMessage(t('imageProcessor.shapeTools.messages.addShapeFailed', { message }), 'error');
    }
  };

  // 自动填充矩形
  const handleAutoFillRectangles = async () => {
    if (!svgResult) {
      setShapeMessage(t('imageProcessor.shapeTools.messages.noSvg'), 'warning');
      return;
    }
    if (!hasBoundaryBox) {
      setShapeMessage(t('imageProcessor.shapeTools.messages.noBoundary'), 'warning');
      return;
    }
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      setShapeMessage(t('imageProcessor.errors.svgEditNotSupported'), 'error');
      return;
    }

    try {
      autoFillAbortRef.current = false;
      setAutoFilling(true);
      setShapeMessage(t('imageProcessor.shapeTools.autoFill.filling'), 'info');
      setAutoFillProgress({
        progress: 0,
        processedRows: 0,
        totalRows: 0,
        suggestions: 0,
        lastSuggestion: null,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 获取边界框范围
      const boundaryBounds = getBoundaryBoxBounds(svgResult.svg);
      if (!boundaryBounds) {
        throw new Error('无法获取边界框范围');
      }

      // 创建限制在边界框内部的mask
      const pxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const pxPerMmY = svgResult.viewHeight / svgResult.heightMm;
      const boundaryX = Math.round(boundaryBounds.x);
      const boundaryY = Math.round(boundaryBounds.y);
      const boundaryWidth = Math.round(boundaryBounds.width);
      const boundaryHeight = Math.round(boundaryBounds.height);

      const restrictedMask = new Uint8Array(svgResult.viewWidth * svgResult.viewHeight);
      for (let y = 0; y < svgResult.viewHeight; y++) {
        for (let x = 0; x < svgResult.viewWidth; x++) {
          const idx = y * svgResult.viewWidth + x;
          if (x >= boundaryX && x < boundaryX + boundaryWidth &&
              y >= boundaryY && y < boundaryY + boundaryHeight) {
            restrictedMask[idx] = svgResult.mask[idx];
          } else {
            restrictedMask[idx] = 0;
          }
        }
      }

      const suggestions = await suggestRectanglesFromMask(
        restrictedMask,
        svgResult.viewWidth,
        svgResult.viewHeight,
        svgResult.widthMm,
        svgResult.heightMm,
        {
          maxWidthMm: 100,
          maxHeightMm: 50,
          minWidthMm: 30,
          minHeightMm: 20,
          stepMm: Math.max(1.0, shapeState.step),
          gapMm: shapeState.gap,
          coverageThreshold: 0.9,
          orientation: 'both',
          maxShapes: 500,
          progressIntervalRows: 5,
          yieldAfterRows: 20,
          onProgress: (progress) => {
            setAutoFillProgress(progress);
          },
          shouldAbort: () => autoFillAbortRef.current,
        }
      );

      if (autoFillAbortRef.current) {
        setShapeMessage(t('imageProcessor.shapeTools.messages.autoFillCancelled'), 'info');
        return;
      }

      if (suggestions.length === 0) {
        setShapeMessage(t('imageProcessor.shapeTools.messages.noWhiteArea'), 'warning');
        return;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgResult.svg, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('未找到 SVG 根节点');
      }

      const existing = root.querySelectorAll('[data-auto-fill="true"]');
      existing.forEach((node) => node.parentNode?.removeChild(node));

      const ns = 'http://www.w3.org/2000/svg';
      const cornerRadiusPx = Math.max(0, shapeState.cornerRadius) * Math.min(pxPerMmX, pxPerMmY);
      const strokeWidthPx = Math.max(0.1, shapeState.strokeWidth * Math.min(pxPerMmX, pxPerMmY));

      suggestions.forEach((rect) => {
        const el = doc.createElementNS(ns, 'rect');
        const xPx = rect.xMm * pxPerMmX;
        const yPx = rect.yMm * pxPerMmY;
        const wPx = rect.widthMm * pxPerMmX;
        const hPx = rect.heightMm * pxPerMmY;

        el.setAttribute('x', `${xPx}`);
        el.setAttribute('y', `${yPx}`);
        el.setAttribute('width', `${wPx}`);
        el.setAttribute('height', `${hPx}`);
        const maxRadiusPx = Math.min(wPx, hPx) / 2;
        const radiusPx = Math.min(cornerRadiusPx, maxRadiusPx);
        if (radiusPx > 0) {
          el.setAttribute('rx', `${radiusPx}`);
          el.setAttribute('ry', `${radiusPx}`);
        }
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke', shapeState.strokeColor);
        el.setAttribute('stroke-width', `${strokeWidthPx}`);
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('data-auto-fill', 'true');
        el.setAttribute('data-extra-shape', 'auto');
        root.appendChild(el);
      });

      const serialized = new XMLSerializer().serializeToString(doc);
      onSvgUpdate(serialized);
      setShapeMessage(t('imageProcessor.shapeTools.messages.autoFillSuccess', { count: suggestions.length }), 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setShapeMessage(t('imageProcessor.shapeTools.messages.autoFillFailed', { message }), 'error');
    } finally {
      setAutoFilling(false);
      setAutoFillProgress(null);
    }
  };

  const handleStopAutoFill = () => {
    autoFillAbortRef.current = true;
    setShapeMessage(t('imageProcessor.shapeTools.messages.stoppingAutoFill', { defaultValue: '正在停止自动填充…' }), 'info');
  };

  const handleClearShapes = () => {
    if (!svgResult) return;
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      onError('当前环境不支持 SVG 编辑');
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgResult.svg, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('未找到 SVG 根节点');
      }

      // 只清除非边界框的图形
      const extraShapes = root.querySelectorAll('[data-extra-shape]:not([data-boundary-box="true"])');
      extraShapes.forEach((node) => node.parentNode?.removeChild(node));

      const serialized = new XMLSerializer().serializeToString(doc);
      onSvgUpdate(serialized);
      setShapeMessage(t('imageProcessor.shapeTools.messages.shapesCleared'), 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setShapeMessage(t('imageProcessor.shapeTools.messages.clearShapesFailed', { message }), 'error');
    }
  };

  return {
    shapeState,
    setShapeState,
    autoFilling,
    autoFillProgress,
    shapeMessage,
    shapeMessageTone,
    handleAddShape,
    handleAutoFillRectangles,
    handleStopAutoFill,
    handleClearShapes,
    setShapeMessage,
    resetShapeState,
  };
};

