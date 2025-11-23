/**
 * 角点编辑组件
 * 负责角点的显示、添加和拖拽编辑
 */

import React, { CSSProperties, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Point, AutoCorrectResult } from '../../utils/imageProcessor';
import './CornerEditor.css';

interface CornerEditorProps {
  imageRef: React.RefObject<HTMLImageElement>;
  imageSize: { width: number; height: number };
  isImageReady: boolean;
  manualCorners: Point[];
  draggingIndex: number | null;
  autoCorrect: AutoCorrectResult | null;
  onOverlayClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHandlePointerDown: (event: React.PointerEvent<HTMLDivElement>, index: number) => void;
}

const CornerEditor: React.FC<CornerEditorProps> = ({
  imageRef,
  imageSize,
  isImageReady,
  manualCorners,
  draggingIndex,
  autoCorrect,
  onOverlayClick,
  onHandlePointerDown,
}) => {
  const { t } = useTranslation();
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 计算角点手柄的样式位置
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

  // 绘制调试信息（红色像素点和角点）
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

      // 绘制红色像素点
      if (autoCorrect.redPixels) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
        autoCorrect.redPixels.forEach((p) => {
          ctx.beginPath();
          ctx.arc((p.x / img.naturalWidth) * canvas.width, (p.y / img.naturalHeight) * canvas.height, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 绘制角点连线
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

        // 绘制角点标记
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
  }, [autoCorrect, manualCorners, imageRef]);

  return (
    <>
      <canvas ref={debugCanvasRef} className="debug-overlay" />
      <div className={`corner-overlay ${isImageReady ? 'ready' : ''}`} onClick={onOverlayClick}>
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
            onPointerDown={(event) => onHandlePointerDown(event, index)}
            data-handle="true"
          >
            <span className="corner-label">{index + 1}</span>
          </div>
        ))}
        {isImageReady && manualCorners.length < 4 && (
          <div className="corner-tip">{t('imageProcessor.cornerCorrection.tip', { count: manualCorners.length })}</div>
        )}
      </div>
    </>
  );
};

export default CornerEditor;

