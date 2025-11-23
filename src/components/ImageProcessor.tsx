/**
 * 图像处理主组件（重构版本）
 * 使用拆分后的hooks和子组件
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  autoCorrectPerspective,
  processImageToSvg,
  AutoCorrectResult,
  SvgProcessResult,
} from '../utils/imageProcessor';
import { useCornerEditing } from '../hooks/useCornerEditing';
import { useBoundaryBox } from '../hooks/useBoundaryBox';
import { useShapeTools } from '../hooks/useShapeTools';
import { useSvgManipulation } from '../hooks/useSvgManipulation';
import CornerEditor from './ImageProcessor/CornerEditor';
import SvgPreview from './ImageProcessor/SvgPreview';
import ShapeTools from './ImageProcessor/ShapeTools';
import BoundaryBoxManager from './ImageProcessor/BoundaryBoxManager';
import ProcessingControls from './ImageProcessor/ProcessingControls';
import './ImageProcessor.css';

interface ImageProcessorProps {
  imageData: string;
  onSvgGenerated: (svg: string, actualSize?: { width: number; height: number }) => void;
  onBack: () => void;
}

const DEFAULT_WIDTH_MM = 603;
const DEFAULT_HEIGHT_MM = 482;

const ImageProcessor: React.FC<ImageProcessorProps> = ({ imageData, onSvgGenerated, onBack }) => {
  const { t } = useTranslation();
  // 基础状态
  const [processing, setProcessing] = useState(false);
  const [svgResult, setSvgResult] = useState<SvgProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [turdSize, setTurdSize] = useState(2);
  const [optTolerance, setOptTolerance] = useState(0.4);
  const [actualWidth, setActualWidth] = useState(DEFAULT_WIDTH_MM);
  const [actualHeight, setActualHeight] = useState(DEFAULT_HEIGHT_MM);
  const [autoCorrect, setAutoCorrect] = useState<AutoCorrectResult | null>(null);
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isImageReady, setIsImageReady] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);

  // 使用自定义Hooks
  const cornerEditing = useCornerEditing({
    imageData,
    imageRef,
    isImageReady,
    actualWidth,
    actualHeight,
    autoCorrect,
    onCorrectedImageChange: setCorrectedImage,
    onAutoCorrectUpdate: setAutoCorrect,
  });

  const boundaryBox = useBoundaryBox({
    svgResult,
    onSvgUpdate: (svg) => {
      if (svgResult) {
        setSvgResult({ ...svgResult, svg });
      }
    },
  });

  const shapeTools = useShapeTools({
    svgResult,
    hasBoundaryBox: boundaryBox.hasBoundaryBox,
    onSvgUpdate: (svg) => {
      if (svgResult) {
        setSvgResult({ ...svgResult, svg });
      }
    },
    onError: setError,
    t, // 传递翻译函数
  });

  const svgManipulation = useSvgManipulation({
    svgResult,
    hasBoundaryBox: boundaryBox.hasBoundaryBox,
    actualWidth,
    actualHeight,
  });

  // 图片加载处理
  const handleImageLoaded = () => {
    if (!imageRef.current) return;
    setImageSize({
      width: imageRef.current.naturalWidth,
      height: imageRef.current.naturalHeight,
    });
    setIsImageReady(true);
  };

  // 重置状态（当图片数据变化时）
  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.src = imageData;
    }
    setSvgResult(null);
    setAutoCorrect(null);
    setError(null);
    setCorrectedImage(null);
    setIsImageReady(false);
    setThreshold(null);
    setTurdSize(2);
    setOptTolerance(0.4);
    setActualWidth(DEFAULT_WIDTH_MM);
    setActualHeight(DEFAULT_HEIGHT_MM);
    cornerEditing.resetCorners();
    boundaryBox.setBoundaryBoxWidthMm(600);
    boundaryBox.setBoundaryBoxHeightMm(400);
    shapeTools.resetShapeState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageData]);

  // 自动校正
  const handleAutoCorrect = async () => {
    setProcessing(true);
    setError(null);
    try {
      const result = await autoCorrectPerspective(imageData);
      setAutoCorrect(result);
      setActualWidth(result.widthMm ?? DEFAULT_WIDTH_MM);
      setActualHeight(result.heightMm ?? DEFAULT_HEIGHT_MM);
      cornerEditing.setManualCorners(result.corners);
      cornerEditing.setCornersDirty(false);
      setCorrectedImage(result.correctedDataUrl);
      if (imageRef.current) {
        imageRef.current.src = result.originalDataUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t('imageProcessor.errors.autoCorrectFailed', { message }));
    } finally {
      setProcessing(false);
    }
  };

  // 应用角点（包装hook的方法，添加错误处理）
  const handleApplyCorners = async () => {
    try {
      await cornerEditing.handleApplyCorners();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  // 生成SVG
  const handleProcess = async () => {
    if (cornerEditing.cornersDirty) {
      setError(t('imageProcessor.errors.cornerModified'));
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
      shapeTools.setShapeMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t('imageProcessor.errors.imageProcessFailed', { message }));
    } finally {
      setProcessing(false);
    }
  };

  // 确认使用
  const handleConfirm = () => {
    if (!svgResult) return;
    const size = actualWidth > 0 && actualHeight > 0 ? { width: actualWidth, height: actualHeight } : undefined;
    onSvgGenerated(svgResult.svg, size);
  };

  // 下载SVG
  const handleDownload = () => {
    if (!svgResult) return;
    let svgToDownload = svgResult.svg;

    // 在导出前确保边界框尺寸正确
    if (boundaryBox.hasBoundaryBox) {
      svgToDownload = svgManipulation.normalizeBoundaryBoxDimensions(svgToDownload);
      svgToDownload = svgManipulation.scaleSvgToBoundaryBox(svgToDownload);
    }

    // 生成时间戳（月日时分）
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${month}${day}-${hour}${minute}`;

    const blob = new Blob([svgToDownload], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `material-${timestamp}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 添加边界框（包装hook的方法，添加错误处理）
  const handleAddBoundaryBox = () => {
    try {
      boundaryBox.handleAddBoundaryBox();
      shapeTools.setShapeMessage(
        `已添加边界框（${boundaryBox.boundaryBoxWidthMm}mm × ${boundaryBox.boundaryBoxHeightMm}mm），可拖拽调整位置`,
        'success'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      shapeTools.setShapeMessage(`添加边界框失败：${message}`, 'error');
    }
  };

  return (
    <div className="image-processor">
      <div className="processor-container">
        <div className="image-preview">
          <h3>{t('imageProcessor.originalImage')}</h3>
          <div className="preview-wrapper">
            <img ref={imageRef} alt="待处理" className="preview-image" onLoad={handleImageLoaded} />
            <CornerEditor
              imageRef={imageRef}
              imageSize={imageSize}
              isImageReady={isImageReady}
              manualCorners={cornerEditing.manualCorners}
              draggingIndex={cornerEditing.draggingIndex}
              autoCorrect={autoCorrect}
              onOverlayClick={cornerEditing.handleOverlayClick}
              onHandlePointerDown={cornerEditing.handleHandlePointerDown}
            />
          </div>
          {correctedImage && (
            <div className="corrected-preview">
              <h4>{t('imageProcessor.correctedPreview')}</h4>
              <img src={correctedImage} alt={t('imageProcessor.correctedPreview')} />
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
        </div>

        <ProcessingControls
          processing={processing}
          threshold={threshold}
          turdSize={turdSize}
          optTolerance={optTolerance}
          actualWidth={actualWidth}
          actualHeight={actualHeight}
          cornersDirty={cornerEditing.cornersDirty}
          applyingCorners={cornerEditing.applyingCorners}
          manualCorners={cornerEditing.manualCorners}
          onThresholdChange={setThreshold}
          onTurdSizeChange={setTurdSize}
          onOptToleranceChange={setOptTolerance}
          onActualWidthChange={setActualWidth}
          onActualHeightChange={setActualHeight}
          onAutoCorrect={handleAutoCorrect}
          onApplyCorners={handleApplyCorners}
          onProcess={handleProcess}
        />

        {svgResult && (
          <>
            <SvgPreview
              svgResult={svgResult}
              previewSvg={svgManipulation.previewSvg}
              svgContainerRef={boundaryBox.svgContainerRef}
            />
            <div className="svg-shape-tools">
              <h4>{t('imageProcessor.shapeTools.title')}</h4>
              <p className="hint">
                {boundaryBox.hasBoundaryBox
                  ? t('imageProcessor.shapeTools.hint')
                  : t('imageProcessor.shapeTools.hintNoBoundary')}
              </p>

              <BoundaryBoxManager
                hasBoundaryBox={boundaryBox.hasBoundaryBox}
                boundaryBoxWidthMm={boundaryBox.boundaryBoxWidthMm}
                boundaryBoxHeightMm={boundaryBox.boundaryBoxHeightMm}
                onWidthChange={boundaryBox.setBoundaryBoxWidthMm}
                onHeightChange={boundaryBox.setBoundaryBoxHeightMm}
                onAddBoundaryBox={handleAddBoundaryBox}
                onClearShapes={shapeTools.handleClearShapes}
              />

              <ShapeTools
                hasBoundaryBox={boundaryBox.hasBoundaryBox}
                shapeState={shapeTools.shapeState}
                onShapeStateChange={(updates: Partial<typeof shapeTools.shapeState>) => {
                  shapeTools.setShapeState((prev) => ({ ...prev, ...updates }));
                }}
                onAddShape={shapeTools.handleAddShape}
                onAutoFill={shapeTools.handleAutoFillRectangles}
                onStopAutoFill={shapeTools.handleStopAutoFill}
                autoFilling={shapeTools.autoFilling}
                autoFillProgress={shapeTools.autoFillProgress}
                shapeMessage={shapeTools.shapeMessage}
                shapeMessageTone={shapeTools.shapeMessageTone}
              />
            </div>
            <div className="svg-actions">
              <button className="btn btn-primary" onClick={handleConfirm}>
                {t('imageProcessor.actions.confirm')}
              </button>
              <button className="btn" onClick={handleDownload} disabled={!svgResult}>
                {t('imageProcessor.actions.download')}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="processor-controls">
        <button className="btn" onClick={onBack}>
          {t('imageProcessor.backToCapture')}
        </button>
      </div>
    </div>
  );
};

export default ImageProcessor;

