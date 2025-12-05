/**
 * SVG操作自定义Hook
 * 管理SVG的规范化、缩放、预览等操作
 */

import { useMemo } from 'react';
import { SvgProcessResult } from '../utils/imageProcessor';
import { parseSvgViewBox, getBoundaryBoxBounds } from '../utils/svgUtils';

interface UseSvgManipulationProps {
  svgResult: SvgProcessResult | null;
  hasBoundaryBox: boolean;
  actualWidth: number;
  actualHeight: number;
}

interface UseSvgManipulationReturn {
  previewSvg: string | null;
  normalizeBoundaryBoxDimensions: (svgString: string) => string;
  scaleSvgToBoundaryBox: (svgString: string) => string;
  ensureExactBoundaryBoxDimensions: (svgString: string) => string;
}

export const useSvgManipulation = ({
  svgResult,
  hasBoundaryBox,
  actualWidth,
  actualHeight,
}: UseSvgManipulationProps): UseSvgManipulationReturn => {
  // 规范化边界框尺寸
  const normalizeBoundaryBoxDimensions = (svgString: string): string => {
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      return svgString;
    }
    if (!svgResult) return svgString;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        return svgString;
      }

      const boundaryBox = root.querySelector('[data-boundary-box="true"]') as SVGRectElement | null;
      if (!boundaryBox) return svgString;

      const bounds = parseSvgViewBox(root);
      if (!bounds) return svgString;

      // 从边界框的data属性读取物理尺寸（如果不存在则使用默认值）
      const boundaryWidthMm = parseFloat(boundaryBox.getAttribute('data-boundary-width-mm') || '600');
      const boundaryHeightMm = parseFloat(boundaryBox.getAttribute('data-boundary-height-mm') || '400');

      // 计算在原始viewBox坐标系中的像素尺寸
      // 关键：向下取整，确保转换回毫米时不会超过设定值
      const originalPxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const originalPxPerMmY = svgResult.viewHeight / svgResult.heightMm;
      // 向下取整像素尺寸，确保不会因为浮点数精度问题导致尺寸偏大
      const boundaryWidthPxOriginal = Math.floor(boundaryWidthMm * originalPxPerMmX);
      const boundaryHeightPxOriginal = Math.floor(boundaryHeightMm * originalPxPerMmY);

      // 获取当前边界框位置
      let currentX = parseFloat(boundaryBox.getAttribute('x') || '0');
      let currentY = parseFloat(boundaryBox.getAttribute('y') || '0');

      // 更新边界框的尺寸（确保是整数，避免浮点数精度问题）
      boundaryBox.setAttribute('width', String(Math.round(boundaryWidthPxOriginal)));
      boundaryBox.setAttribute('height', String(Math.round(boundaryHeightPxOriginal)));

      // 确保边界框在原始viewBox范围内
      const originalBounds = {
        x: 0,
        y: 0,
        width: svgResult.viewWidth,
        height: svgResult.viewHeight
      };
      const maxX = originalBounds.x + originalBounds.width - boundaryWidthPxOriginal;
      const maxY = originalBounds.y + originalBounds.height - boundaryHeightPxOriginal;

      if (currentX < originalBounds.x || currentX > maxX || currentY < originalBounds.y || currentY > maxY) {
        // 超出范围，重新居中
        const centerX = originalBounds.x + originalBounds.width / 2;
        const centerY = originalBounds.y + originalBounds.height / 2;
        currentX = centerX - boundaryWidthPxOriginal / 2;
        currentY = centerY - boundaryHeightPxOriginal / 2;
      } else {
        // 在范围内，但确保不超出边界
        currentX = Math.max(originalBounds.x, Math.min(currentX, maxX));
        currentY = Math.max(originalBounds.y, Math.min(currentY, maxY));
      }

      boundaryBox.setAttribute('x', `${currentX}`);
      boundaryBox.setAttribute('y', `${currentY}`);

      // 更新保存的物理尺寸信息
      boundaryBox.setAttribute('data-boundary-width-mm', `${boundaryWidthMm}`);
      boundaryBox.setAttribute('data-boundary-height-mm', `${boundaryHeightMm}`);

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      console.warn('[normalizeBoundaryBoxDimensions] 规范化边界框尺寸失败', error);
      return svgString;
    }
  };

  // 缩放SVG到边界框
  const scaleSvgToBoundaryBox = (svgString: string): string => {
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      return svgString;
    }
    if (!svgResult) return svgString;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        return svgString;
      }

      const boundaryBox = root.querySelector('[data-boundary-box="true"]') as SVGRectElement | null;
      if (!boundaryBox) return svgString;

      // 从边界框的data属性读取物理尺寸（精确的毫米值）
      const boundaryWidthMm = parseFloat(boundaryBox.getAttribute('data-boundary-width-mm') || '0');
      const boundaryHeightMm = parseFloat(boundaryBox.getAttribute('data-boundary-height-mm') || '0');

      // 如果data属性中没有尺寸，则从rect属性读取并计算
      let bboxWidthPx: number;
      let bboxHeightPx: number;
      let bboxX: number;
      let bboxY: number;

      // 计算像素到毫米的转换比例
      const originalPxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const originalPxPerMmY = svgResult.viewHeight / svgResult.heightMm;
      
      // 使用设定的毫米值计算像素尺寸（向下取整，确保不会超过）
      const targetWidthMm = boundaryWidthMm > 0 ? boundaryWidthMm : actualWidth;
      const targetHeightMm = boundaryHeightMm > 0 ? boundaryHeightMm : actualHeight;
      
      // 计算与目标毫米值精确对应的像素尺寸（向下取整，确保不会超过）
      const targetWidthPx = Math.floor(targetWidthMm * originalPxPerMmX);
      const targetHeightPx = Math.floor(targetHeightMm * originalPxPerMmY);
      
      if (targetWidthPx <= 0 || targetHeightPx <= 0) return svgString;

      // 获取当前边界框位置
      bboxX = parseFloat(boundaryBox.getAttribute('x') || '0');
      bboxY = parseFloat(boundaryBox.getAttribute('y') || '0');
      bboxWidthPx = targetWidthPx;
      bboxHeightPx = targetHeightPx;

      // 调整整个SVG的transform，使边界框对齐到(0,0)
      const boundaryParent = boundaryBox.parentElement;
      if (boundaryParent && boundaryParent !== root) {
        const existingTransform = boundaryParent.getAttribute('transform') || '';
        const translateX = -bboxX;
        const translateY = -bboxY;
        const newTransform = existingTransform
          ? `translate(${translateX}, ${translateY}) ${existingTransform}`
          : `translate(${translateX}, ${translateY})`;
        boundaryParent.setAttribute('transform', newTransform);
      } else {
        boundaryBox.setAttribute('x', '0');
        boundaryBox.setAttribute('y', '0');
      }

      // 关键修复：根据向下取整后的像素尺寸，反向计算对应的毫米值
      // 这个毫米值会略小于设定的毫米值（因为向下取整），确保不会超过设定值
      const finalWidthMm = targetWidthPx / originalPxPerMmX;
      const finalHeightMm = targetHeightPx / originalPxPerMmY;
      
      // 将viewBox设置为与向下取整后的像素尺寸精确对应
      root.setAttribute('viewBox', `0 0 ${targetWidthPx} ${targetHeightPx}`);
      
      // 设置SVG的物理尺寸：使用反向计算的毫米值（不会超过设定值）
      // 这样 viewBox 像素值 / width 毫米值 = originalPxPerMm，比例是精确的
      root.setAttribute('width', `${finalWidthMm}mm`);
      root.setAttribute('height', `${finalHeightMm}mm`);
      
      // 同时更新边界框的像素尺寸为向下取整后的值，确保一致性（确保是整数）
      boundaryBox.setAttribute('width', String(Math.round(targetWidthPx)));
      boundaryBox.setAttribute('height', String(Math.round(targetHeightPx)));

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      console.warn('[scaleSvgToBoundaryBox] 缩放SVG到边界框失败', error);
      return svgString;
    }
  };

  // 预览SVG
  const previewSvg = useMemo(() => {
    if (!svgResult) return null;
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      return svgResult.svg;
    }
    try {
      let svgToProcess = svgResult.svg;

      // 如果存在边界框，规范化边界框尺寸
      if (hasBoundaryBox) {
        try {
          svgToProcess = normalizeBoundaryBoxDimensions(svgToProcess);
        } catch (error) {
          console.warn('[previewSvg] 规范化边界框尺寸失败，继续使用原始SVG', error);
        }
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgToProcess, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        return svgToProcess;
      }
      root.removeAttribute('width');
      root.removeAttribute('height');
      if (!root.getAttribute('preserveAspectRatio')) {
        root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      const existingStyle = root.getAttribute('style') ?? '';
      const normalizedStyle = existingStyle
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => {
          const lowered = item.toLowerCase();
          return !lowered.startsWith('width:') && !lowered.startsWith('height:') && !lowered.startsWith('max-width:') && !lowered.startsWith('max-height:');
        });
      normalizedStyle.push('width:100%', 'height:auto', 'max-width:100%', 'max-height:100%', 'display:block');
      root.setAttribute('style', normalizedStyle.join(';'));
      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      console.warn('[ImageProcessor] 预览 SVG 缩放失败', error);
      return svgResult.svg;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgResult?.svg, hasBoundaryBox]);

  // 导出时确保边界框尺寸精确（不改变SVG结构，只调整尺寸）
  const ensureExactBoundaryBoxDimensions = (svgString: string): string => {
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      return svgString;
    }
    if (!svgResult) return svgString;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        return svgString;
      }

      const boundaryBox = root.querySelector('[data-boundary-box="true"]') as SVGRectElement | null;
      if (!boundaryBox) return svgString;

      // 从边界框的data属性读取物理尺寸（精确的毫米值）
      const boundaryWidthMm = parseFloat(boundaryBox.getAttribute('data-boundary-width-mm') || '0');
      const boundaryHeightMm = parseFloat(boundaryBox.getAttribute('data-boundary-height-mm') || '0');

      if (boundaryWidthMm <= 0 || boundaryHeightMm <= 0) return svgString;

      // 获取当前viewBox
      const bounds = parseSvgViewBox(root);
      if (!bounds) return svgString;

      // 计算像素到毫米的转换比例
      const originalPxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const originalPxPerMmY = svgResult.viewHeight / svgResult.heightMm;

      // 获取边界框在原始viewBox中的位置
      const boundaryX = parseFloat(boundaryBox.getAttribute('x') || '0');
      const boundaryY = parseFloat(boundaryBox.getAttribute('y') || '0');
      
      // 计算与设定毫米值精确对应的像素尺寸（向下取整，确保不会超过）
      const targetWidthPx = Math.floor(boundaryWidthMm * originalPxPerMmX);
      const targetHeightPx = Math.floor(boundaryHeightMm * originalPxPerMmY);
      
      // 获取边界框的 stroke 信息（用于保留蓝色边框）
      const currentStroke = boundaryBox.getAttribute('stroke');
      const currentStrokeWidth = boundaryBox.getAttribute('stroke-width');
      
      // 关键修复：先将边界框移动到 (0, 0)
      boundaryBox.setAttribute('x', '0');
      boundaryBox.setAttribute('y', '0');
      
      // 更新边界框的像素尺寸为向下取整后的值（确保是整数）
      boundaryBox.setAttribute('width', String(targetWidthPx));
      boundaryBox.setAttribute('height', String(targetHeightPx));
      
      // 确保保留蓝色边框（总是设置，确保可见）
      boundaryBox.setAttribute('stroke', currentStroke || '#2563eb'); // 蓝色
      if (!currentStrokeWidth) {
        const strokeWidthPx = Math.max(1, 2 * Math.min(originalPxPerMmX, originalPxPerMmY));
        boundaryBox.setAttribute('stroke-width', `${strokeWidthPx}`);
      }
      // 确保有 vector-effect 属性，使 stroke 不随缩放变化
      boundaryBox.setAttribute('vector-effect', 'non-scaling-stroke');
      // 确保 fill 为 none
      boundaryBox.setAttribute('fill', 'none');
      
      // 设置 viewBox 为向下取整后的像素尺寸
      const finalViewBoxWidth = targetWidthPx;
      const finalViewBoxHeight = targetHeightPx;
      
      // 关键修复：直接使用设定的毫米值，确保比例精确匹配
      // 设置viewBox为边界框的像素尺寸（从 (0,0) 开始）
      // 设置 width/height 为设定的精确毫米值
      // 这样 viewBox 像素尺寸 / width 毫米值 = 精确的比例
      root.setAttribute('viewBox', `0 0 ${finalViewBoxWidth} ${finalViewBoxHeight}`);
      root.setAttribute('width', `${boundaryWidthMm}mm`);
      root.setAttribute('height', `${boundaryHeightMm}mm`);
      
      // 调整整个SVG内容，将边界框移动到 (0,0)
      // 需要将所有其他元素（路径、矩形等）平移，使它们相对于边界框的位置保持不变
      if (boundaryX !== 0 || boundaryY !== 0) {
        const translateX = -boundaryX;
        const translateY = -boundaryY;
        
        // 创建一个包装组，将所有其他元素放在组中，然后对整个组进行平移
        // 这是最简单可靠的方法
        const wrapperGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        wrapperGroup.setAttribute('transform', `translate(${translateX}, ${translateY})`);
        
        // 遍历所有子元素，将除了边界框外的所有元素移动到包装组中
        const childrenToMove: Element[] = [];
        for (const child of Array.from(root.children)) {
          if (child !== boundaryBox) {
            childrenToMove.push(child);
          }
        }
        
        // 将元素移动到包装组
        for (const child of childrenToMove) {
          wrapperGroup.appendChild(child);
        }
        
        // 将包装组添加到根元素
        // 注意：边界框应该在最后，这样它才能在最上层显示
        root.appendChild(wrapperGroup);
        
        // 确保边界框在最后（最上层），移除并重新添加
        root.removeChild(boundaryBox);
        root.appendChild(boundaryBox);
      }

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      console.warn('[ensureExactBoundaryBoxDimensions] 确保边界框尺寸精确失败', error);
      return svgString;
    }
  };

  return {
    previewSvg,
    normalizeBoundaryBoxDimensions,
    scaleSvgToBoundaryBox,
    ensureExactBoundaryBoxDimensions,
  };
};

