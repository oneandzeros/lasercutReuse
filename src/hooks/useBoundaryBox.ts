/**
 * 边界框管理自定义Hook
 * 管理边界框的添加、拖拽、尺寸等逻辑
 */

import { useEffect, useRef, useState } from 'react';
import { SvgProcessResult } from '../utils/imageProcessor';
import { toSvgPoint } from '../utils/coordinateUtils';
import { getBoundaryBoxBounds, updateBoundaryBoxPosition, parseSvgViewBox, checkBoundaryBoxExists } from '../utils/svgUtils';

interface UseBoundaryBoxProps {
  svgResult: SvgProcessResult | null;
  onSvgUpdate: (svg: string) => void;
}

interface UseBoundaryBoxReturn {
  hasBoundaryBox: boolean;
  draggingBoundaryBox: boolean;
  boundaryBoxWidthMm: number;
  boundaryBoxHeightMm: number;
  svgContainerRef: React.RefObject<HTMLDivElement>;
  setBoundaryBoxWidthMm: React.Dispatch<React.SetStateAction<number>>;
  setBoundaryBoxHeightMm: React.Dispatch<React.SetStateAction<number>>;
  handleAddBoundaryBox: () => void;
  checkBoundaryBox: () => boolean;
}

export const useBoundaryBox = ({
  svgResult,
  onSvgUpdate,
}: UseBoundaryBoxProps): UseBoundaryBoxReturn => {
  const [hasBoundaryBox, setHasBoundaryBox] = useState(false);
  const [draggingBoundaryBox, setDraggingBoundaryBox] = useState(false);
  const [boundaryBoxWidthMm, setBoundaryBoxWidthMm] = useState(600);
  const [boundaryBoxHeightMm, setBoundaryBoxHeightMm] = useState(400);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const boundaryBoxDragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  // 检查边界框是否存在
  const checkBoundaryBox = (): boolean => {
    if (!svgResult) return false;
    return checkBoundaryBoxExists(svgResult.svg);
  };

  // 添加边界框
  const handleAddBoundaryBox = () => {
    if (!svgResult) return;
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      throw new Error('当前环境不支持 SVG 编辑');
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

      const { x: vbX, y: vbY, width: vbWidth, height: vbHeight } = bounds;

      // 计算毫米到像素的转换比例
      const pxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const pxPerMmY = svgResult.viewHeight / svgResult.heightMm;

      // 边界框尺寸（使用用户输入的尺寸）
      // 向下取整，确保转换回毫米时不会超过设定值
      const boundaryWidthPx = Math.floor(boundaryBoxWidthMm * pxPerMmX);
      const boundaryHeightPx = Math.floor(boundaryBoxHeightMm * pxPerMmY);

      // 计算居中位置
      const centerX = vbX + vbWidth / 2;
      const centerY = vbY + vbHeight / 2;
      const x = centerX - boundaryWidthPx / 2;
      const y = centerY - boundaryHeightPx / 2;

      // 检查是否已存在边界框，如果存在则先删除
      const existing = root.querySelector('[data-boundary-box="true"]');
      if (existing) {
        existing.parentNode?.removeChild(existing);
      }

      const ns = 'http://www.w3.org/2000/svg';
      const element = doc.createElementNS(ns, 'rect');
      element.setAttribute('x', String(Math.round(x)));
      element.setAttribute('y', String(Math.round(y)));
      element.setAttribute('width', String(Math.round(boundaryWidthPx)));
      element.setAttribute('height', String(Math.round(boundaryHeightPx)));
      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', '#2563eb'); // 蓝色
      const strokeWidthPx = Math.max(1, 2 * Math.min(pxPerMmX, pxPerMmY));
      element.setAttribute('stroke-width', `${strokeWidthPx}`);
      element.setAttribute('vector-effect', 'non-scaling-stroke');
      element.setAttribute('data-boundary-width-mm', `${boundaryBoxWidthMm}`);
      element.setAttribute('data-boundary-height-mm', `${boundaryBoxHeightMm}`);
      element.setAttribute('data-boundary-box', 'true');
      element.setAttribute('data-extra-shape', 'boundary');
      element.setAttribute('class', 'boundary-box-draggable');
      element.setAttribute('style', 'cursor: move;');

      root.appendChild(element);

      const serialized = new XMLSerializer().serializeToString(doc);
      onSvgUpdate(serialized);
      setHasBoundaryBox(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`添加边界框失败：${message}`);
    }
  };

  // 检查边界框是否存在
  useEffect(() => {
    if (svgResult) {
      const exists = checkBoundaryBoxExists(svgResult.svg);
      setHasBoundaryBox(exists);
    } else {
      setHasBoundaryBox(false);
    }
  }, [svgResult]);

  // 边界框拖拽处理
  useEffect(() => {
    if (!draggingBoundaryBox || !svgContainerRef.current || !svgResult) return;

    const container = svgContainerRef.current;
    const handleMove = (event: MouseEvent) => {
      if (!boundaryBoxDragStartRef.current || !svgResult) return;
      const svgElement = container.querySelector('svg') as SVGSVGElement | null;
      if (!svgElement) return;
      const svgPoint = toSvgPoint(event.clientX, event.clientY, svgElement);
      if (!svgPoint) return;

      const bounds = getBoundaryBoxBounds(svgResult.svg);
      if (!bounds) return;

      const dx = svgPoint.x - boundaryBoxDragStartRef.current.x;
      const dy = svgPoint.y - boundaryBoxDragStartRef.current.y;
      const newX = boundaryBoxDragStartRef.current.offsetX + dx;
      const newY = boundaryBoxDragStartRef.current.offsetY + dy;

      // 限制边界框在SVG视图框内
      const viewBox = parseSvgViewBox(svgElement);
      if (viewBox) {
        const clampedX = Math.max(viewBox.x, Math.min(newX, viewBox.x + viewBox.width - bounds.width));
        const clampedY = Math.max(viewBox.y, Math.min(newY, viewBox.y + viewBox.height - bounds.height));
        const updated = updateBoundaryBoxPosition(svgResult.svg, clampedX, clampedY);
        if (updated) {
          onSvgUpdate(updated);
        }
      } else {
        const updated = updateBoundaryBoxPosition(svgResult.svg, newX, newY);
        if (updated) {
          onSvgUpdate(updated);
        }
      }
    };

    const handleUp = () => {
      setDraggingBoundaryBox(false);
      boundaryBoxDragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingBoundaryBox, svgResult, onSvgUpdate]);

  // 边界框点击开始拖拽
  useEffect(() => {
    if (!svgContainerRef.current || !hasBoundaryBox) return;

    const container = svgContainerRef.current;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // 检查是否点击了边界框
      const rect = target.closest('[data-boundary-box="true"]') as SVGRectElement | null;
      if (!rect) return;

      const svgElement = container.querySelector('svg') as SVGSVGElement | null;
      if (!svgElement) return;
      const svgPoint = toSvgPoint(event.clientX, event.clientY, svgElement);
      if (!svgPoint) return;

      const bounds = getBoundaryBoxBounds(svgResult?.svg || '');
      if (!bounds) return;

      boundaryBoxDragStartRef.current = {
        x: svgPoint.x,
        y: svgPoint.y,
        offsetX: bounds.x,
        offsetY: bounds.y,
      };
      setDraggingBoundaryBox(true);
      event.preventDefault();
    };

    container.addEventListener('mousedown', handleMouseDown);
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
    };
  }, [hasBoundaryBox, svgResult]);

  return {
    hasBoundaryBox,
    draggingBoundaryBox,
    boundaryBoxWidthMm,
    boundaryBoxHeightMm,
    svgContainerRef,
    setBoundaryBoxWidthMm,
    setBoundaryBoxHeightMm,
    handleAddBoundaryBox,
    checkBoundaryBox,
  };
};

