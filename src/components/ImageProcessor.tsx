import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import {
  autoCorrectPerspective,
  processImageToSvg,
  AutoCorrectResult,
  generateCorrectedImage,
  normalizeCorners,
  Point,
  SvgProcessResult,
  suggestRectanglesFromMask,
} from '../utils/imageProcessor';
import './ImageProcessor.css';

type ShapeMessageTone = 'info' | 'success' | 'warning' | 'error';

interface ImageProcessorProps {
  imageData: string;
  onSvgGenerated: (svg: string, actualSize?: { width: number; height: number }) => void;
  onBack: () => void;
}

const DEFAULT_WIDTH_MM = 525;
const DEFAULT_HEIGHT_MM = 645;

const ImageProcessor: React.FC<ImageProcessorProps> = ({ imageData, onSvgGenerated, onBack }) => {
  const [processing, setProcessing] = useState(false);
  const [svgResult, setSvgResult] = useState<SvgProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [turdSize, setTurdSize] = useState(2);
  const [optTolerance, setOptTolerance] = useState(0.4);
  const [actualWidth, setActualWidth] = useState(DEFAULT_WIDTH_MM);
  const [actualHeight, setActualHeight] = useState(DEFAULT_HEIGHT_MM);
  const [autoCorrect, setAutoCorrect] = useState<AutoCorrectResult | null>(null);
  const [manualCorners, setManualCorners] = useState<Point[]>([]);
  const [cornersDirty, setCornersDirty] = useState(false);
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [applyingCorners, setApplyingCorners] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isImageReady, setIsImageReady] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [shapePadding, setShapePadding] = useState(12);
  const [shapeCornerRadius, setShapeCornerRadius] = useState(24);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(1);
  const [shapeStrokeColor, setShapeStrokeColor] = useState('#ff4d4f');
  const [shapeGap, setShapeGap] = useState(5);
  const [shapeStep, setShapeStep] = useState(0.2);
  const [shapeMessage, setShapeMessage] = useState<string | null>(null);
  const [shapeMessageTone, setShapeMessageTone] = useState<ShapeMessageTone>('info');
  const [autoFilling, setAutoFilling] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const toImagePoint = (clientX: number, clientY: number): Point | null => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const xRatio = (clientX - rect.left) / rect.width;
    const yRatio = (clientY - rect.top) / rect.height;
    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      return null;
    }
    return {
      x: xRatio * imageRef.current.naturalWidth,
      y: yRatio * imageRef.current.naturalHeight,
    };
  };

  const clampToImage = (point: Point): Point => {
    if (!imageRef.current) return point;
    return {
      x: Math.min(Math.max(point.x, 0), imageRef.current.naturalWidth - 1),
      y: Math.min(Math.max(point.y, 0), imageRef.current.naturalHeight - 1),
    };
  };

  const getHandleStyle = (corner: Point): CSSProperties => {
    const width = imageRef.current?.naturalWidth ?? imageSize.width;
    const height = imageRef.current?.naturalHeight ?? imageSize.height;
    if (!width || !height) {
      return { left: '0%', top: '0%' };
    }
    return {
      left: `${(corner.x / width) * 100}%`,
      top: `${(corner.y / height) * 100}%`,
    };
  };

  const handleHandlePointerDown = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    setDraggingIndex(index);
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    const target = event.target as HTMLElement;
    if (target.dataset.handle === 'true') return;
    if (manualCorners.length >= 4) return;
    const point = toImagePoint(event.clientX, event.clientY);
    if (!point) return;
    setManualCorners((prev) => {
      const next = [...prev, clampToImage(point)];
      if (imageRef.current && next.length >= 3) {
        try {
          return normalizeCorners(next, imageRef.current.naturalWidth, imageRef.current.naturalHeight);
        } catch {
          return next;
        }
      }
      return next;
    });
    setCornersDirty(true);
  };

  const handleImageLoaded = () => {
    if (!imageRef.current) return;
    setImageSize({
      width: imageRef.current.naturalWidth,
      height: imageRef.current.naturalHeight,
    });
    setIsImageReady(true);
  };

  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.src = imageData;
    }
    setSvgResult(null);
    setAutoCorrect(null);
    setError(null);
    setManualCorners([]);
    setCorrectedImage(null);
    setCornersDirty(false);
    setIsImageReady(false);
    setShapePadding(12);
    setShapeCornerRadius(24);
    setShapeStrokeWidth(1);
    setShapeStrokeColor('#ff4d4f');
    setShapeGap(5);
    setShapeStep(0.2);
    setShapeMessage(null);
    setShapeMessageTone('info');
    setAutoFilling(false);
  }, [imageData]);

  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMove = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      const point = toImagePoint(event.clientX, event.clientY);
      if (!point) return;
      setManualCorners((prev) => {
        if (draggingIndex === null || !prev[draggingIndex]) return prev;
        const next = [...prev];
        next[draggingIndex] = clampToImage(point);
        return next;
      });
      setCornersDirty(true);
    };

    const handleUp = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      pointerIdRef.current = null;
      setDraggingIndex(null);
      if (imageRef.current) {
        setManualCorners((prev) => {
          if (prev.length >= 3) {
            try {
              return normalizeCorners(prev, imageRef.current!.naturalWidth, imageRef.current!.naturalHeight);
            } catch {
              return prev;
            }
          }
          return prev;
        });
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [draggingIndex]);

  useEffect(() => {
    if (!autoCorrect || !imageRef.current || !debugCanvasRef.current) return;

    const img = imageRef.current;
    const canvas = debugCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const rect = img.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (autoCorrect.redPixels) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
        autoCorrect.redPixels.forEach((p) => {
          ctx.beginPath();
          ctx.arc((p.x / img.naturalWidth) * canvas.width, (p.y / img.naturalHeight) * canvas.height, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      const cornersToDraw = manualCorners.length >= 3 ? manualCorners : autoCorrect.corners;
      if (cornersToDraw && cornersToDraw.length > 0) {
        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        cornersToDraw.forEach((corner, index) => {
          const x = (corner.x / img.naturalWidth) * canvas.width;
          const y = (corner.y / img.naturalHeight) * canvas.height;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        if (cornersToDraw.length === 4) {
          const first = cornersToDraw[0];
          ctx.lineTo((first.x / img.naturalWidth) * canvas.width, (first.y / img.naturalHeight) * canvas.height);
        }
        ctx.stroke();

        cornersToDraw.forEach((corner, index) => {
          const x = (corner.x / img.naturalWidth) * canvas.width;
          const y = (corner.y / img.naturalHeight) * canvas.height;
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${index + 1}`, x, y);
        });
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [autoCorrect, manualCorners]);

  const parseSvgViewBox = (root: SVGSVGElement): { x: number; y: number; width: number; height: number } | null => {
    const raw = root.getAttribute('viewBox');
    if (raw) {
      const parts = raw
        .replace(/,/g, ' ')
        .trim()
        .split(/\s+/)
        .map(Number);
      if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
        const [x, y, width, height] = parts;
        if (width > 0 && height > 0) {
          return { x, y, width, height };
        }
      }
    }

    const parseDimension = (value: string | null): number => {
      if (!value) return NaN;
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    const width = parseDimension(root.getAttribute('width'));
    const height = parseDimension(root.getAttribute('height'));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    return { x: 0, y: 0, width, height };
  };

  const handleAddShape = (shape: 'roundedRect' | 'circle') => {
    if (!svgResult) return;
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      setError('当前环境不支持 SVG 编辑');
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
      const { x: vbX, y: vbY, width: vbWidth, height: vbHeight } = bounds;
      const paddingMm = Math.max(0, shapePadding);
      const pxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const pxPerMmY = svgResult.viewHeight / svgResult.heightMm;
      const paddingX = paddingMm * pxPerMmX;
      const paddingY = paddingMm * pxPerMmY;
      const cornerRadiusPx = Math.max(0, shapeCornerRadius) * Math.min(pxPerMmX, pxPerMmY);
      const ns = 'http://www.w3.org/2000/svg';
      let element: Element;

      if (shape === 'roundedRect') {
        const width = Math.max(vbWidth - paddingX * 2, 0);
        const height = Math.max(vbHeight - paddingY * 2, 0);
        element = doc.createElementNS(ns, 'rect');
        element.setAttribute('x', `${vbX + paddingX}`);
        element.setAttribute('y', `${vbY + paddingY}`);
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
        const radius = Math.max(0, Math.min(vbWidth, vbHeight) / 2 - Math.max(paddingX, paddingY));
        element = doc.createElementNS(ns, 'circle');
        element.setAttribute('cx', `${vbX + vbWidth / 2}`);
        element.setAttribute('cy', `${vbY + vbHeight / 2}`);
        element.setAttribute('r', `${radius}`);
      }

      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', shapeStrokeColor);
      const strokeWidthPx = Math.max(0.1, shapeStrokeWidth * Math.min(pxPerMmX, pxPerMmY));
      element.setAttribute('stroke-width', `${strokeWidthPx}`);
      element.setAttribute('vector-effect', 'non-scaling-stroke');
      element.setAttribute('data-extra-shape', 'manual');

      root.appendChild(element);

      const serialized = new XMLSerializer().serializeToString(doc);
      setSvgResult((prev) => (prev ? { ...prev, svg: serialized } : prev));
      setShapeMessage('已添加一个基础图形');
      setShapeMessageTone('success');
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setShapeMessage(`添加基础图形失败：${message}`);
      setShapeMessageTone('error');
      setError(null);
    }
  };

  const handleClearShapes = () => {
    if (!svgResult) return;
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      setError('当前环境不支持 SVG 编辑');
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgResult.svg, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('未找到 SVG 根节点');
      }

      const extraShapes = root.querySelectorAll('[data-extra-shape]');
      extraShapes.forEach((node) => node.parentNode?.removeChild(node));

      const serialized = new XMLSerializer().serializeToString(doc);
      setSvgResult((prev) => (prev ? { ...prev, svg: serialized } : prev));
      setShapeMessage('已清空追加图形');
      setShapeMessageTone('info');
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setShapeMessage(`清空追加图形失败：${message}`);
      setShapeMessageTone('error');
      setError(null);
    }
  };

  const handleAutoFillRectangles = async () => {
    console.log('[autoFill] trigger');
    if (!svgResult) {
      console.warn('[autoFill] skipped: svgResult is null');
      setShapeMessage('请先生成 SVG 后再尝试自动填充');
      setShapeMessageTone('warning');
      return;
    }
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      console.error('[autoFill] skipped: DOMParser/XMLSerializer unavailable');
      setShapeMessage('当前环境不支持 SVG 编辑');
      setShapeMessageTone('error');
      return;
    }

    try {
      console.time('[autoFill] total');
      console.time('[autoFill] suggestRectanglesFromMask');
      setAutoFilling(true);
      setShapeMessage('正在自动填充矩形…');
      setShapeMessageTone('info');
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const suggestions = suggestRectanglesFromMask(
        svgResult.mask,
        svgResult.viewWidth,
        svgResult.viewHeight,
        svgResult.widthMm,
        svgResult.heightMm,
        {
          maxWidthMm: 100,
          maxHeightMm: 50,
          minWidthMm: 30,
          minHeightMm: 20,
          stepMm: Math.max(0.2, shapeStep),
          gapMm: shapeGap,
          coverageThreshold: 0.9,
          orientation: 'both',
          maxShapes: 500,
        }
      );

      console.timeEnd('[autoFill] suggestRectanglesFromMask');
      console.log('[autoFill] suggestions count:', suggestions.length);

      if (suggestions.length === 0) {
        console.log('[autoFill] no suggestions found');
        setShapeMessage('未找到可用的白色区域，请尝试减小间距或调整扫描步长。');
        setShapeMessageTone('warning');
        return;
      }

      console.time('[autoFill] DOM parsing & append');
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgResult.svg, 'image/svg+xml');
      const root = doc.documentElement as SVGSVGElement | null;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('未找到 SVG 根节点');
      }

      const existing = root.querySelectorAll('[data-auto-fill="true"]');
      existing.forEach((node) => node.parentNode?.removeChild(node));

      const ns = 'http://www.w3.org/2000/svg';
      const pxPerMmX = svgResult.viewWidth / svgResult.widthMm;
      const pxPerMmY = svgResult.viewHeight / svgResult.heightMm;
      const cornerRadiusPx = Math.max(0, shapeCornerRadius) * Math.min(pxPerMmX, pxPerMmY);
      const strokeWidthPx = Math.max(0.1, shapeStrokeWidth * Math.min(pxPerMmX, pxPerMmY));

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
        el.setAttribute('stroke', shapeStrokeColor);
        el.setAttribute('stroke-width', `${strokeWidthPx}`);
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('data-auto-fill', 'true');
        el.setAttribute('data-extra-shape', 'auto');
        root.appendChild(el);
      });

      const serialized = new XMLSerializer().serializeToString(doc);
      console.timeEnd('[autoFill] DOM parsing & append');
      setSvgResult((prev) => (prev ? { ...prev, svg: serialized } : prev));
      setShapeMessage(`已自动填充 ${suggestions.length} 个矩形（每个 ≤ 100×50 mm）。`);
      setShapeMessageTone('success');
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[autoFill] error:', message, err);
      setShapeMessage(`自动填充失败：${message}`);
      setShapeMessageTone('error');
      setError(null);
    } finally {
      setAutoFilling(false);
      console.timeEnd('[autoFill] total');
    }
  };

  const handleAutoCorrect = async () => {
    setProcessing(true);
    setError(null);
    try {
      const result = await autoCorrectPerspective(imageData);
      setAutoCorrect(result);
      setActualWidth(result.widthMm ?? DEFAULT_WIDTH_MM);
      setActualHeight(result.heightMm ?? DEFAULT_HEIGHT_MM);
      setManualCorners(result.corners);
      setCornersDirty(false);
      setCorrectedImage(result.correctedDataUrl);
      if (imageRef.current) {
        imageRef.current.src = result.originalDataUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`自动透视校正失败：${message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyCorners = async () => {
    if (!imageRef.current) {
      setError('图片尚未加载完成');
      return;
    }
    if (manualCorners.length < 3) {
      setError('请至少标记三个角点');
      return;
    }
    setApplyingCorners(true);
    setError(null);
    try {
      const normalized = normalizeCorners(manualCorners, imageRef.current.naturalWidth, imageRef.current.naturalHeight);
      const result = await generateCorrectedImage(imageData, normalized, {
        widthMm: actualWidth > 0 ? actualWidth : undefined,
        heightMm: actualHeight > 0 ? actualHeight : undefined,
      });
      setManualCorners(result.corners);
      setCorrectedImage(result.dataUrl);
      setCornersDirty(false);
      setAutoCorrect((prev) =>
        prev
          ? {
              ...prev,
              correctedDataUrl: result.dataUrl,
              corners: result.corners,
              widthMm: result.widthMm,
              heightMm: result.heightMm,
            }
          : prev
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`角点应用失败：${message}`);
    } finally {
      setApplyingCorners(false);
    }
  };

  const handleProcess = async () => {
    if (cornersDirty) {
      setError('角点已修改，请先点击“应用角点”');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const baseImage = correctedImage ?? autoCorrect?.correctedDataUrl ?? imageData;
      const result = await processImageToSvg(baseImage, {
        threshold: threshold ?? undefined,
        turdSize,
        optTolerance,
        widthMm: actualWidth > 0 ? actualWidth : undefined,
        heightMm: actualHeight > 0 ? actualHeight : undefined,
      });
      setSvgResult(result);
      setShapeMessage(null);
      setShapeMessageTone('info');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`图像处理失败：${message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!svgResult) return;
    const size = actualWidth > 0 && actualHeight > 0 ? { width: actualWidth, height: actualHeight } : undefined;
    onSvgGenerated(svgResult.svg, size);
  };

  const handleDownload = () => {
    if (!svgResult) return;
    const blob = new Blob([svgResult.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'material.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="image-processor">
      <div className="processor-container">
        <div className="image-preview">
          <h3>原始图片</h3>
          <div className="preview-wrapper">
            <img ref={imageRef} alt="待处理" className="preview-image" onLoad={handleImageLoaded} />
            <canvas ref={debugCanvasRef} className="debug-overlay" />
            <div className={`corner-overlay ${isImageReady ? 'ready' : ''}`} onClick={handleOverlayClick}>
              {isImageReady && manualCorners.length >= 3 && (
                <svg
                  className="corner-svg"
                  viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                  preserveAspectRatio="none"
                >
                  <polygon
                    className="corner-polygon"
                    points={manualCorners.map((corner) => `${corner.x},${corner.y}`).join(' ')}
                  />
                </svg>
              )}
              {manualCorners.map((corner, index) => (
                <div
                  key={index}
                  className={`corner-handle ${draggingIndex === index ? 'dragging' : ''}`}
                  style={getHandleStyle(corner)}
                  onPointerDown={(event) => handleHandlePointerDown(event, index)}
                  data-handle="true"
                >
                  <span className="corner-label">{index + 1}</span>
                </div>
              ))}
              {isImageReady && manualCorners.length < 4 && (
                <div className="corner-tip">在图上点击剩余角点以补齐（{manualCorners.length}/4）</div>
              )}
            </div>
          </div>
          {correctedImage && (
            <div className="corrected-preview">
              <h4>校正预览</h4>
              <img src={correctedImage} alt="校正结果" />
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="processing-section">
          <div className="processing-params">
            <h4>自动校正</h4>
            <button className="btn btn-primary" onClick={handleAutoCorrect} disabled={processing}>
              {processing ? '处理中…' : '重新自动识别角点'}
            </button>
            <p className="hint">系统会尝试自动识别红色胶带角点并进行透视校正。</p>
          </div>

          <div className="processing-params">
            <h4>角点校正</h4>
            <p className="hint">
              拖动绿色圆点或点击图片添加缺失角点（顺序：左上 → 右上 → 右下 → 左下），以确保透视正确。
            </p>
            <div className={`corner-status ${cornersDirty ? 'dirty' : 'clean'}`}>
              当前状态：{cornersDirty ? '未应用（请点击“应用角点”）' : '已应用'}
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleApplyCorners}
              disabled={applyingCorners || manualCorners.length < 3}
            >
              {applyingCorners ? '应用中…' : '应用角点'}
            </button>
            {manualCorners.length < 3 && (
              <small className="hint">至少标记三个角点（建议四个）以完成透视校正。</small>
            )}
          </div>

          <div className="processing-params">
            <h4>实际尺寸（可选）</h4>
            <label>
              宽度 (mm)
              <input type="number" min={0} step={0.1} value={actualWidth}
                     onChange={(e) => setActualWidth(Number(e.target.value))} />
            </label>
            <label>
              高度 (mm)
              <input type="number" min={0} step={0.1} value={actualHeight}
                     onChange={(e) => setActualHeight(Number(e.target.value))} />
            </label>
            <small>用于将 SVG 按真实尺寸缩放。</small>
          </div>

          <div className="processing-params">
            <h4>Potrace 参数</h4>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={threshold === null}
                onChange={(e) => setThreshold(e.target.checked ? null : 128)}
              />
              自动阈值
            </label>
            {threshold !== null && (
              <label>
                阈值 {threshold}
                <input type="range" min={0} max={255} value={threshold}
                       onChange={(e) => setThreshold(Number(e.target.value))} />
              </label>
            )}
            <label>
              忽略杂点 (turdSize): {turdSize}
              <input type="range" min={0} max={10} value={turdSize}
                     onChange={(e) => setTurdSize(Number(e.target.value))} />
            </label>
            <label>
              平滑容差: {optTolerance.toFixed(2)}
              <input type="range" min={0} max={2} step={0.1} value={optTolerance}
                     onChange={(e) => setOptTolerance(Number(e.target.value))} />
            </label>
          </div>

          <button className="btn btn-primary btn-process" onClick={handleProcess} disabled={processing}>
            {processing ? '处理中…' : '生成SVG'}
          </button>
        </div>

        {svgResult && (
          <div className="svg-preview">
            <h3>生成的SVG</h3>
            <div className="svg-container" dangerouslySetInnerHTML={{ __html: svgResult.svg }} />
            <div className="svg-shape-tools">
              <h4>追加基础图形</h4>
              <p className="hint">
                在空白区域填入基础图形，默认尽量贴边，可调整留白、圆角和线宽；圆形会忽略圆角设置。
              </p>
              <div className="shape-tool-layout">
                <div className="shape-inputs">
                  <div className="shape-control-grid">
                    <label>
                      留白
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={shapePadding}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setShapePadding(Number.isFinite(value) ? Math.max(0, value) : 0);
                        }}
                      />
                    </label>
                    <label>
                      圆角
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={shapeCornerRadius}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setShapeCornerRadius(Number.isFinite(value) ? Math.max(0, value) : 0);
                        }}
                      />
                    </label>
                    <label>
                      线宽
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={shapeStrokeWidth}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setShapeStrokeWidth(Number.isFinite(value) ? Math.max(0.1, value) : 0.1);
                        }}
                      />
                    </label>
                    <label>
                      矩形间距 (mm)
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={shapeGap}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setShapeGap(Number.isFinite(value) ? Math.max(0, value) : 0);
                        }}
                      />
                    </label>
                    <label className="color-picker">
                      颜色
                      <input
                        type="color"
                        value={shapeStrokeColor}
                        onChange={(e) => setShapeStrokeColor(e.target.value)}
                      />
                    </label>
                    <label>
                      扫描步长 (mm)
                      <input
                        type="number"
                        min={0.2}
                        step={0.1}
                        value={shapeStep}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setShapeStep(Number.isFinite(value) ? Math.max(0.2, value) : 0.2);
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="shape-actions">
                  <div className="shape-buttons">
                    <button className="btn btn-secondary" onClick={() => handleAddShape('roundedRect')}>
                      添加圆角矩形
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleAddShape('circle')}>
                      添加圆形
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAutoFillRectangles}
                      disabled={autoFilling}
                    >
                      {autoFilling ? '自动填充中…' : '自动填充矩形'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleClearShapes}>
                      清空追加图形
                    </button>
                  </div>
                  {shapeMessage && (
                    <div className={`shape-message ${shapeMessageTone}`}>
                      {autoFilling && <span className="shape-spinner" aria-hidden="true" />}
                      {shapeMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="svg-actions">
              <button className="btn btn-primary" onClick={handleConfirm}>确认使用</button>
              <button className="btn" onClick={handleDownload}>下载SVG</button>
            </div>
          </div>
        )}
      </div>

      <div className="processor-controls">
        <button className="btn" onClick={onBack}>← 返回重拍</button>
      </div>
    </div>
  );
};

export default ImageProcessor;
