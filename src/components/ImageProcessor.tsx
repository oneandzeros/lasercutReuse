import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import {
  autoCorrectPerspective,
  processImageToSvg,
  AutoCorrectResult,
  generateCorrectedImage,
  normalizeCorners,
  Point,
} from '../utils/imageProcessor';
import './ImageProcessor.css';

interface ImageProcessorProps {
  imageData: string;
  onSvgGenerated: (svg: string, actualSize?: { width: number; height: number }) => void;
  onBack: () => void;
}

const DEFAULT_WIDTH_MM = 645;
const DEFAULT_HEIGHT_MM = 525;

const ImageProcessor: React.FC<ImageProcessorProps> = ({ imageData, onSvgGenerated, onBack }) => {
  const [processing, setProcessing] = useState(false);
  const [svgResult, setSvgResult] = useState<string | null>(null);
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
      const svg = await processImageToSvg(baseImage, {
        threshold: threshold ?? undefined,
        turdSize,
        optTolerance,
      });
      setSvgResult(svg);
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
    onSvgGenerated(svgResult, size);
  };

  const handleDownload = () => {
    if (!svgResult) return;
    const blob = new Blob([svgResult], { type: 'image/svg+xml' });
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
            <div className="svg-container" dangerouslySetInnerHTML={{ __html: svgResult }} />
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
