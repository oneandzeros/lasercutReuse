import { useEffect, useRef, useState } from 'react';
import { autoCorrectPerspective, processImageToSvg, AutoCorrectResult } from '../utils/imageProcessor';
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

  const imageRef = useRef<HTMLImageElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.src = imageData;
    }
    setSvgResult(null);
    setAutoCorrect(null);
    setError(null);
  }, [imageData]);

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

      if (autoCorrect.corners && autoCorrect.corners.length > 0) {
        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        autoCorrect.corners.forEach((corner, index) => {
          const x = (corner.x / img.naturalWidth) * canvas.width;
          const y = (corner.y / img.naturalHeight) * canvas.height;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        if (autoCorrect.corners.length === 4) {
          const first = autoCorrect.corners[0];
          ctx.lineTo((first.x / img.naturalWidth) * canvas.width, (first.y / img.naturalHeight) * canvas.height);
        }
        ctx.stroke();

        autoCorrect.corners.forEach((corner, index) => {
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
  }, [autoCorrect]);

  const handleAutoCorrect = async () => {
    setProcessing(true);
    setError(null);
    try {
      const result = await autoCorrectPerspective(imageData);
      setAutoCorrect(result);
      setActualWidth(result.widthMm ?? DEFAULT_WIDTH_MM);
      setActualHeight(result.heightMm ?? DEFAULT_HEIGHT_MM);
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

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    try {
      const baseImage = autoCorrect?.correctedDataUrl ?? imageData;
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
            <img ref={imageRef} alt="待处理" className="preview-image" />
            <canvas ref={debugCanvasRef} className="debug-overlay" />
          </div>
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
