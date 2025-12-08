/**
 * 图形工具自定义Hook
 * 管理手动添加图形和自动填充的逻辑
 */

import { useEffect, useRef, useState } from 'react';
import { SvgProcessResult, suggestRectanglesFromMask, RectanglePackingProgress, RectangleSuggestion } from '../utils/imageProcessor';
import { getBoundaryBoxBounds, parseSvgViewBox } from '../utils/svgUtils';

/**
 * 合并多个相邻矩形的外轮廓，去除重合边
 * 使用边界框算法：计算所有矩形的并集边界框
 */
function mergeRectangleOutlines(rects: Array<{ x: number; y: number; w: number; h: number }>): string {
  if (rects.length === 0) return '';
  if (rects.length === 1) {
    const r = rects[0];
    return `M ${r.x} ${r.y} L ${r.x + r.w} ${r.y} L ${r.x + r.w} ${r.y + r.h} L ${r.x} ${r.y + r.h} Z`;
  }

  // 对于多个矩形，我们需要找到它们的外轮廓
  // 方法：收集所有不在其他矩形内部的角点，然后按顺序连接
  
  const tolerance = 0.5; // 容差
  const corners: Array<{ x: number; y: number; rectIndex: number }> = [];
  
  // 收集所有矩形的角点
  rects.forEach((r, idx) => {
    corners.push(
      { x: r.x, y: r.y, rectIndex: idx },
      { x: r.x + r.w, y: r.y, rectIndex: idx },
      { x: r.x + r.w, y: r.y + r.h, rectIndex: idx },
      { x: r.x, y: r.y + r.h, rectIndex: idx }
    );
  });

  // 过滤出在外边界上的角点（不在任何其他矩形的内部）
  const outerCorners: Array<{ x: number; y: number }> = [];
  
  corners.forEach((corner) => {
    // 检查这个角点是否在其他矩形内部（不包括边界）
    const isInsideOther = rects.some((r, idx) => {
      if (idx === corner.rectIndex) return false;
      return corner.x > r.x + tolerance && corner.x < r.x + r.w - tolerance &&
             corner.y > r.y + tolerance && corner.y < r.y + r.h - tolerance;
    });
    
    if (!isInsideOther) {
      // 避免重复点
      const exists = outerCorners.some(p => 
        Math.abs(p.x - corner.x) < tolerance && Math.abs(p.y - corner.y) < tolerance
      );
      if (!exists) {
        outerCorners.push({ x: corner.x, y: corner.y });
      }
    }
  });

  // 如果没有外边界点，使用边界框
  if (outerCorners.length < 3) {
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;
  }

  // 计算边界框中心
  const minX = Math.min(...outerCorners.map(p => p.x));
  const minY = Math.min(...outerCorners.map(p => p.y));
  const maxX = Math.max(...outerCorners.map(p => p.x));
  const maxY = Math.max(...outerCorners.map(p => p.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // 按角度排序（顺时针或逆时针）
  outerCorners.sort((a, b) => {
    const angleA = Math.atan2(a.y - centerY, a.x - centerX);
    const angleB = Math.atan2(b.y - centerY, b.x - centerX);
    return angleA - angleB;
  });

  // 生成路径
  let path = `M ${outerCorners[0].x} ${outerCorners[0].y}`;
  for (let i = 1; i < outerCorners.length; i++) {
    path += ` L ${outerCorners[i].x} ${outerCorners[i].y}`;
  }
  path += ' Z';

  return path;
}

export type ShapeMessageTone = 'info' | 'success' | 'warning' | 'error';

export interface ShapeState {
  padding: number;
  cornerRadius: number;
  strokeWidth: number;
  strokeColor: string;
  gap: number; // 仅自动填充使用
  step: number; // 仅自动填充使用
  minRectWidth: number; // 最小矩形宽度（mm）
  minRectHeight: number; // 最小矩形高度（mm）
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

export const DEFAULT_SHAPE_STATE: ShapeState = {
  padding: 2,
  cornerRadius: 2,
  strokeWidth: 0.1,
  strokeColor: '#ff4d4f',
  gap: 0,
  step: 3.0,
  minRectWidth: 30,
  minRectHeight: 20,
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
  // 使用ref保存最新的shapeState，确保异步函数能访问到最新值
  const shapeStateRef = useRef<ShapeState>(shapeState);
  // 使用ref保存最新的svgResult，确保多次自动填充时使用最新状态
  const svgResultRef = useRef<SvgProcessResult | null>(svgResult);
  
  // 当shapeState更新时，同步更新ref
  useEffect(() => {
    shapeStateRef.current = shapeState;
  }, [shapeState]);
  
  // 当svgResult更新时，同步更新ref
  useEffect(() => {
    svgResultRef.current = svgResult;
  }, [svgResult]);

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

      // 限制在边界框内部的白色区域内
      const boundaryX = Math.round(boundaryBounds.x);
      const boundaryY = Math.round(boundaryBounds.y);
      const boundaryWidth = Math.round(boundaryBounds.width);
      const boundaryHeight = Math.round(boundaryBounds.height);

      // 在边界框内部查找白色区域，用于放置图形
      const minShapeSize = 20; // 最小图形尺寸（像素）
      let foundWhiteArea = false;
      let whiteAreaX = boundaryX + paddingX;
      let whiteAreaY = boundaryY + paddingY;
      let whiteAreaWidth = Math.max(boundaryWidth - paddingX * 2, minShapeSize);
      let whiteAreaHeight = Math.max(boundaryHeight - paddingY * 2, minShapeSize);

      // 扫描边界框内部，找到白色区域
      const scanStep = 10; // 扫描步长
      for (let y = boundaryY; y < boundaryY + boundaryHeight - minShapeSize && !foundWhiteArea; y += scanStep) {
        for (let x = boundaryX; x < boundaryX + boundaryWidth - minShapeSize; x += scanStep) {
          // 检查该区域是否为白色
          let isWhite = true;
          const checkSize = minShapeSize;
          for (let yy = y; yy < y + checkSize && yy < boundaryY + boundaryHeight; yy++) {
            for (let xx = x; xx < x + checkSize && xx < boundaryX + boundaryWidth; xx++) {
              const idx = yy * svgResult.viewWidth + xx;
              if (idx >= 0 && idx < svgResult.mask.length && svgResult.mask[idx] <= 200) {
                isWhite = false;
                break;
              }
            }
            if (!isWhite) break;
          }
          
          if (isWhite) {
            // 找到白色区域，计算可用的最大尺寸
            let maxW = boundaryX + boundaryWidth - x - paddingX;
            let maxH = boundaryY + boundaryHeight - y - paddingY;
            
            // 向右扩展查找最大宽度
            for (let xx = x + checkSize; xx < boundaryX + boundaryWidth; xx++) {
              let colIsWhite = true;
              for (let yy = y; yy < y + checkSize && yy < boundaryY + boundaryHeight; yy++) {
                const idx = yy * svgResult.viewWidth + xx;
                if (idx >= 0 && idx < svgResult.mask.length && svgResult.mask[idx] <= 200) {
                  colIsWhite = false;
                  break;
                }
              }
              if (!colIsWhite) break;
              maxW = xx - x + 1 - paddingX;
            }
            
            // 向下扩展查找最大高度
            for (let yy = y + checkSize; yy < boundaryY + boundaryHeight; yy++) {
              let rowIsWhite = true;
              for (let xx = x; xx < x + Math.min(checkSize, maxW) && xx < boundaryX + boundaryWidth; xx++) {
                const idx = yy * svgResult.viewWidth + xx;
                if (idx >= 0 && idx < svgResult.mask.length && svgResult.mask[idx] <= 200) {
                  rowIsWhite = false;
                  break;
                }
              }
              if (!rowIsWhite) break;
              maxH = yy - y + 1 - paddingY;
            }
            
            whiteAreaX = x + paddingX;
            whiteAreaY = y + paddingY;
            whiteAreaWidth = Math.max(maxW, minShapeSize);
            whiteAreaHeight = Math.max(maxH, minShapeSize);
            foundWhiteArea = true;
            break;
          }
        }
      }

      // 如果没找到白色区域，使用边界框内部区域（带padding）
      if (!foundWhiteArea) {
        whiteAreaX = boundaryX + paddingX;
        whiteAreaY = boundaryY + paddingY;
        whiteAreaWidth = Math.max(boundaryWidth - paddingX * 2, minShapeSize);
        whiteAreaHeight = Math.max(boundaryHeight - paddingY * 2, minShapeSize);
      }

      const boxX = whiteAreaX;
      const boxY = whiteAreaY;
      const boxWidth = whiteAreaWidth;
      const boxHeight = whiteAreaHeight;

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
      
      // 在异步操作开始前获取最新的shapeState值，确保使用最新的间距设置
      // 使用ref来获取最新的状态值，避免闭包问题
      const actualShapeState = shapeStateRef.current;
      
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 使用 ref 获取最新的 svgResult，确保多次自动填充时使用最新状态
      const currentSvgResult = svgResultRef.current;
      if (!currentSvgResult) {
        throw new Error('SVG 结果不可用');
      }

      // 获取边界框范围（使用最新的 SVG）
      const boundaryBounds = getBoundaryBoxBounds(currentSvgResult.svg);
      if (!boundaryBounds) {
        throw new Error('无法获取边界框范围');
      }

      // 创建限制在边界框内部的mask，并应用padding（留白）
      const pxPerMmX = currentSvgResult.viewWidth / currentSvgResult.widthMm;
      const pxPerMmY = currentSvgResult.viewHeight / currentSvgResult.heightMm;
      const boundaryX = Math.round(boundaryBounds.x);
      const boundaryY = Math.round(boundaryBounds.y);
      const boundaryWidth = Math.round(boundaryBounds.width);
      const boundaryHeight = Math.round(boundaryBounds.height);

      // 计算padding对应的像素值（使用最新的状态值）
      const paddingMm = Math.max(0, actualShapeState.padding);
      const paddingX = Math.round(paddingMm * pxPerMmX);
      const paddingY = Math.round(paddingMm * pxPerMmY);

      // 计算应用padding后的有效区域
      const innerX = boundaryX + paddingX;
      const innerY = boundaryY + paddingY;
      const innerWidth = Math.max(0, boundaryWidth - paddingX * 2);
      const innerHeight = Math.max(0, boundaryHeight - paddingY * 2);
      
      // 计算边界框的实际尺寸（毫米）- 用于进度显示和最大矩形尺寸
      const boundaryWidthMm = boundaryWidth / pxPerMmX; // 边界框宽度（毫米）
      const boundaryHeightMm = boundaryHeight / pxPerMmY; // 边界框高度（毫米）
      const effectiveWidthMm = Math.max(0, boundaryWidthMm - paddingMm * 2); // 减去padding后的有效宽度（毫米）
      const effectiveHeightMm = Math.max(0, boundaryHeightMm - paddingMm * 2); // 减去padding后的有效高度（毫米）

      // 先解析SVG文档，提取已存在的自动填充矩形（用于在 mask 中标记为已占用）
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentSvgResult.svg, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('未找到 SVG 根节点');
      }

      // 提取已存在的自动填充矩形，用于在 mask 中标记为已占用
      const existingRects: Array<{ x: number; y: number; width: number; height: number }> = [];
      const existingElements = root.querySelectorAll('[data-auto-fill="true"]');
      existingElements.forEach((element) => {
        if (element.tagName === 'rect') {
          const rectEl = element as SVGRectElement;
          const x = parseFloat(rectEl.getAttribute('x') || '0');
          const y = parseFloat(rectEl.getAttribute('y') || '0');
          const width = parseFloat(rectEl.getAttribute('width') || '0');
          const height = parseFloat(rectEl.getAttribute('height') || '0');
          if (Number.isFinite(x) && Number.isFinite(y) && 
              Number.isFinite(width) && Number.isFinite(height) &&
              width > 0 && height > 0) {
            existingRects.push({ x, y, width, height });
          }
        } else if (element.tagName === 'path') {
          // 对于 path 元素，使用 getBBox 获取边界框（如果可用）
          const pathEl = element as SVGPathElement;
          try {
            const bbox = pathEl.getBBox();
            if (bbox.width > 0 && bbox.height > 0) {
              existingRects.push({ 
                x: bbox.x, 
                y: bbox.y, 
                width: bbox.width, 
                height: bbox.height 
              });
            }
          } catch (e) {
            // getBBox 可能在某些环境下不可用，跳过
            console.warn('无法获取 path 元素的边界框:', e);
          }
        }
      });

      // 创建限制在边界框内部的mask，并应用padding（留白）
      // 同时将已存在的矩形区域标记为已占用
      const restrictedMask = new Uint8Array(currentSvgResult.viewWidth * currentSvgResult.viewHeight);
      for (let y = 0; y < currentSvgResult.viewHeight; y++) {
        // 每处理10行检查一次abort，避免长时间阻塞
        if (y % 10 === 0 && autoFillAbortRef.current) {
          throw new Error('USER_CANCELLED');
        }
        for (let x = 0; x < currentSvgResult.viewWidth; x++) {
          const idx = y * currentSvgResult.viewWidth + x;
          // 只有在边界框内部且在padding区域之外的区域才保留原始mask值
          if (x >= innerX && x < innerX + innerWidth &&
              y >= innerY && y < innerY + innerHeight) {
            restrictedMask[idx] = currentSvgResult.mask[idx];
            
            // 检查是否在已存在的矩形区域内，如果是则标记为已占用（设为0/黑色）
            const isInExistingRect = existingRects.some(rect => {
              return x >= rect.x && x < rect.x + rect.width &&
                     y >= rect.y && y < rect.y + rect.height;
            });
            if (isInExistingRect) {
              restrictedMask[idx] = 0; // 标记为已占用
            }
          } else {
            // 边界框外或padding区域内设为0（黑色，不可用）
            restrictedMask[idx] = 0;
          }
        }
      }
      
      // 在调用suggestRectanglesFromMask之前再次检查abort
      if (autoFillAbortRef.current) {
        throw new Error('USER_CANCELLED');
      }

      const ns = 'http://www.w3.org/2000/svg';
      const cornerRadiusPx = Math.max(0, actualShapeState.cornerRadius) * Math.min(pxPerMmX, pxPerMmY);
      const strokeWidthPx = Math.max(0.1, actualShapeState.strokeWidth * Math.min(pxPerMmX, pxPerMmY));

      // 存储实时添加的矩形，用于最后合并（当gap=0时）
      const realtimeRects: Array<{ rect: RectangleSuggestion; element: Element }> = [];

      // 添加单个矩形到SVG的辅助函数
      const addRectToSvg = (rect: RectangleSuggestion): Element => {
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
        el.setAttribute('stroke', actualShapeState.strokeColor);
        el.setAttribute('stroke-width', `${strokeWidthPx}`);
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('data-auto-fill', 'true');
        el.setAttribute('data-extra-shape', 'auto');
        root.appendChild(el);
        return el;
      };

      // 使用最新的状态值（确保间距等参数是最新的）
      const suggestions = await suggestRectanglesFromMask(
        restrictedMask,
        currentSvgResult.viewWidth,
        currentSvgResult.viewHeight,
        currentSvgResult.widthMm,
        currentSvgResult.heightMm,
        {
          // 最大宽高使用边界框的有效尺寸（不设限）
          maxWidthMm: Math.max(1, effectiveWidthMm),
          maxHeightMm: Math.max(1, effectiveHeightMm),
          // 最小宽高使用用户设置的值
          minWidthMm: Math.max(1, actualShapeState.minRectWidth),
          minHeightMm: Math.max(1, actualShapeState.minRectHeight),
          stepMm: Math.max(1.0, actualShapeState.step),
          gapMm: actualShapeState.gap, // 使用最新的间距值
          coverageThreshold: 0.9,
          orientation: 'both',
          maxShapes: 500,
          progressIntervalRows: 5,
          yieldAfterRows: 2, // 减少到2行，让yield更频繁，确保stop按钮能及时响应
          onProgress: (progress) => {
            setAutoFillProgress(progress);
          },
          onRectangleAdded: async (rect) => {
            // 实时添加矩形到SVG
            const element = addRectToSvg(rect);
            realtimeRects.push({ rect, element });
            
            // 更新SVG显示
            const serialized = new XMLSerializer().serializeToString(doc);
            onSvgUpdate(serialized);
            
            // 让出控制权，确保UI可以更新
            await new Promise((resolve) => setTimeout(resolve, 0));
          },
          shouldAbort: () => autoFillAbortRef.current,
          originalMask: currentSvgResult.mask, // 传递原始mask用于区分黑色边界
          effectiveHeightMm: effectiveHeightMm, // 传递有效扫描区域高度，用于正确计算总行数
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

      // 所有矩形已经通过 onRectangleAdded 实时添加，现在检查是否需要合并（gap=0时）
      if (actualShapeState.gap === 0 && cornerRadiusPx === 0 && suggestions.length > 0) {
        // 删除所有实时添加的单独rect元素
        realtimeRects.forEach(({ element }) => {
          element.parentNode?.removeChild(element);
        });

        // 将所有矩形转换为路径，合并相邻的矩形
        const tolerance = 2.0; // 允许的误差（像素）- 增加到2像素以处理微小的对齐误差
        
        // 先将坐标对齐到整数像素，确保精确对齐
        const rects: Array<{ x: number; y: number; w: number; h: number }> = suggestions.map((rect) => ({
          x: Math.round(rect.xMm * pxPerMmX), // 对齐到整数像素
          y: Math.round(rect.yMm * pxPerMmY), // 对齐到整数像素
          w: Math.round(rect.widthMm * pxPerMmX), // 对齐到整数像素
          h: Math.round(rect.heightMm * pxPerMmY), // 对齐到整数像素
        }));

        // 创建一个函数来生成矩形的路径（只绘制外轮廓）
        const rectToPath = (r: { x: number; y: number; w: number; h: number }): string => {
          return `M ${r.x} ${r.y} L ${r.x + r.w} ${r.y} L ${r.x + r.w} ${r.y + r.h} L ${r.x} ${r.y + r.h} Z`;
        };

        // 检测相邻矩形并合并它们的路径
        const mergedPaths: string[] = [];
        const processed = new Set<number>();
        
        for (let i = 0; i < rects.length; i++) {
          // 检查是否应该中止
          if (autoFillAbortRef.current) {
            throw new Error('USER_CANCELLED');
          }
          
          if (processed.has(i)) continue;
          
          const currentRects = [rects[i]];
          processed.add(i);
          
          // 查找所有与当前矩形相邻的矩形
          let foundAdjacent = true;
          while (foundAdjacent) {
            // 检查是否应该中止
            if (autoFillAbortRef.current) {
              throw new Error('USER_CANCELLED');
            }
            
            foundAdjacent = false;
            for (let j = 0; j < rects.length; j++) {
              if (processed.has(j)) continue;
              
              const r2 = rects[j];
              // 检查是否与当前组中的任何矩形相邻
              for (const r1 of currentRects) {
                // 检查r1的右边缘是否与r2的左边缘重合
                if (Math.abs((r1.x + r1.w) - r2.x) < tolerance) {
                  const overlapTop = Math.max(r1.y, r2.y);
                  const overlapBottom = Math.min(r1.y + r1.h, r2.y + r2.h);
                  if (overlapBottom > overlapTop + tolerance) {
                    currentRects.push(r2);
                    processed.add(j);
                    foundAdjacent = true;
                    break;
                  }
                }
                // 检查r1的左边缘是否与r2的右边缘重合
                if (Math.abs(r1.x - (r2.x + r2.w)) < tolerance) {
                  const overlapTop = Math.max(r1.y, r2.y);
                  const overlapBottom = Math.min(r1.y + r1.h, r2.y + r2.h);
                  if (overlapBottom > overlapTop + tolerance) {
                    currentRects.push(r2);
                    processed.add(j);
                    foundAdjacent = true;
                    break;
                  }
                }
                // 检查r1的下边缘是否与r2的上边缘重合
                if (Math.abs((r1.y + r1.h) - r2.y) < tolerance) {
                  const overlapLeft = Math.max(r1.x, r2.x);
                  const overlapRight = Math.min(r1.x + r1.w, r2.x + r2.w);
                  if (overlapRight > overlapLeft + tolerance) {
                    currentRects.push(r2);
                    processed.add(j);
                    foundAdjacent = true;
                    break;
                  }
                }
                // 检查r1的上边缘是否与r2的下边缘重合
                if (Math.abs(r1.y - (r2.y + r2.h)) < tolerance) {
                  const overlapLeft = Math.max(r1.x, r2.x);
                  const overlapRight = Math.min(r1.x + r1.w, r2.x + r2.w);
                  if (overlapRight > overlapLeft + tolerance) {
                    currentRects.push(r2);
                    processed.add(j);
                    foundAdjacent = true;
                    break;
                  }
                }
              }
              if (foundAdjacent) break;
            }
          }
          
          // 为当前组的矩形生成合并的路径，去除重合边
          if (currentRects.length === 1) {
            // 单个矩形，直接用path绘制
            mergedPaths.push(rectToPath(currentRects[0]));
          } else {
            // 多个相邻矩形：计算合并后的外轮廓，去除内部重合边
            const mergedPath = mergeRectangleOutlines(currentRects);
            mergedPaths.push(mergedPath);
          }
        }
        
        // 创建path元素
        mergedPaths.forEach((pathData) => {
          // 检查是否应该中止
          if (autoFillAbortRef.current) {
            throw new Error('USER_CANCELLED');
          }
          
          const pathEl = doc.createElementNS(ns, 'path');
          pathEl.setAttribute('d', pathData);
          pathEl.setAttribute('fill', 'none');
          pathEl.setAttribute('stroke', actualShapeState.strokeColor);
          pathEl.setAttribute('stroke-width', `${strokeWidthPx}`);
          pathEl.setAttribute('stroke-linejoin', 'miter'); // 让相邻边合并
          pathEl.setAttribute('stroke-miterlimit', '10');
          pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
          pathEl.setAttribute('data-auto-fill', 'true');
          pathEl.setAttribute('data-extra-shape', 'auto');
          root.appendChild(pathEl);
        });
      }
      // 如果gap不为0或cornerRadius不为0，矩形已经通过onRectangleAdded实时添加，无需额外处理

      const serialized = new XMLSerializer().serializeToString(doc);
      onSvgUpdate(serialized);
      setShapeMessage(t('imageProcessor.shapeTools.messages.autoFillSuccess', { count: suggestions.length }), 'success');
    } catch (err) {
      // 如果是用户取消操作，不显示错误信息，只显示取消消息
      if (err instanceof Error && err.message === 'USER_CANCELLED') {
        setShapeMessage(t('imageProcessor.shapeTools.messages.autoFillCancelled'), 'info');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setShapeMessage(t('imageProcessor.shapeTools.messages.autoFillFailed', { message }), 'error');
      }
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

      // 只清除非边界框的图形（包括手动添加和自动填充的图形）
      const extraShapes = root.querySelectorAll('[data-extra-shape]:not([data-boundary-box="true"])');
      const removedCount = extraShapes.length;
      extraShapes.forEach((node) => {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });

      // 确保清理完成后再更新
      const serialized = new XMLSerializer().serializeToString(doc);
      onSvgUpdate(serialized);
      
      if (removedCount > 0) {
        setShapeMessage(t('imageProcessor.shapeTools.messages.shapesCleared'), 'info');
      } else {
        setShapeMessage(t('imageProcessor.shapeTools.messages.noShapesToClear', { defaultValue: '没有需要清理的图形' }), 'info');
      }
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

