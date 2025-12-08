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
import { useShapeTools, DEFAULT_SHAPE_STATE } from '../hooks/useShapeTools';
import { useSvgManipulation } from '../hooks/useSvgManipulation';
import { loadCornerData, saveCornerData } from '../utils/cornerDataStorage';
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
  const handleImageLoaded = async () => {
    if (!imageRef.current) return;
    const currentWidth = imageRef.current.naturalWidth;
    const currentHeight = imageRef.current.naturalHeight;
    
    setImageSize({
      width: currentWidth,
      height: currentHeight,
    });
    setIsImageReady(true);

    // 检查是否有保存的数据
    const savedData = loadCornerData();
    if (savedData) {
      // 检查图片尺寸是否匹配
      if (
        savedData.originalWidth === currentWidth &&
        savedData.originalHeight === currentHeight
      ) {
        // 尺寸匹配，自动应用保存的数据
        setActualWidth(savedData.widthMm);
        setActualHeight(savedData.heightMm);
        cornerEditing.setManualCorners(savedData.corners);
        cornerEditing.setCornersDirty(false);
        
        // 应用保存的形状参数
        if (savedData.shapeState) {
          shapeTools.setShapeState(savedData.shapeState);
        } else {
          // 如果没有保存的形状参数，使用默认值
          shapeTools.setShapeState(DEFAULT_SHAPE_STATE);
        }
        
        // 应用保存的边界框尺寸
        if (savedData.boundaryBoxWidthMm !== undefined) {
          boundaryBox.setBoundaryBoxWidthMm(savedData.boundaryBoxWidthMm);
        }
        if (savedData.boundaryBoxHeightMm !== undefined) {
          boundaryBox.setBoundaryBoxHeightMm(savedData.boundaryBoxHeightMm);
        }
        
        // 自动应用角点
        try {
          await cornerEditing.handleApplyCorners();
        } catch (err) {
          console.warn('[ImageProcessor] 自动应用保存的角点失败', err);
        }
      } else {
        // 尺寸不匹配，使用系统默认数据
        setActualWidth(DEFAULT_WIDTH_MM);
        setActualHeight(DEFAULT_HEIGHT_MM);
        shapeTools.setShapeState(DEFAULT_SHAPE_STATE);
        boundaryBox.setBoundaryBoxWidthMm(600);
        boundaryBox.setBoundaryBoxHeightMm(400);
      }
    } else {
      // 没有保存的数据，使用系统默认数据
      setActualWidth(DEFAULT_WIDTH_MM);
      setActualHeight(DEFAULT_HEIGHT_MM);
      shapeTools.setShapeState(DEFAULT_SHAPE_STATE);
      boundaryBox.setBoundaryBoxWidthMm(600);
      boundaryBox.setBoundaryBoxHeightMm(400);
    }
  };

  // 监听 shapeState 和边界框尺寸变化，实时保存到 localStorage
  useEffect(() => {
    // 只有在图片已加载的情况下才保存
    if (!isImageReady || !imageRef.current) return;
    
    const currentWidth = imageRef.current.naturalWidth;
    const currentHeight = imageRef.current.naturalHeight;
    
    // 读取当前保存的数据
    const savedData = loadCornerData();
    
    // 如果保存的数据存在且图片尺寸匹配，更新 shapeState 和边界框尺寸字段
    if (
      savedData &&
      savedData.originalWidth === currentWidth &&
      savedData.originalHeight === currentHeight
    ) {
      saveCornerData({
        ...savedData,
        shapeState: shapeTools.shapeState,
        boundaryBoxWidthMm: boundaryBox.boundaryBoxWidthMm,
        boundaryBoxHeightMm: boundaryBox.boundaryBoxHeightMm,
      });
    }
    // 如果没有保存的数据或尺寸不匹配，不在这里创建（等到应用角点后再创建完整数据）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeTools.shapeState, boundaryBox.boundaryBoxWidthMm, boundaryBox.boundaryBoxHeightMm, isImageReady]);

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
      // 应用角点后，更新保存的数据以包含当前的 shapeState 和边界框尺寸
      // 因为 cornerEditing.handleApplyCorners() 已经保存了角点数据，这里只需要更新 shapeState 和边界框尺寸
      if (imageRef.current && isImageReady) {
        const savedData = loadCornerData();
        if (savedData && 
            savedData.originalWidth === imageRef.current.naturalWidth &&
            savedData.originalHeight === imageRef.current.naturalHeight) {
          saveCornerData({
            ...savedData,
            shapeState: shapeTools.shapeState,
            boundaryBoxWidthMm: boundaryBox.boundaryBoxWidthMm,
            boundaryBoxHeightMm: boundaryBox.boundaryBoxHeightMm,
          });
        }
      }
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
    let svgToExport = svgResult.svg;
    
    // 在导出前确保边界框尺寸正确
    if (boundaryBox.hasBoundaryBox) {
      svgToExport = svgManipulation.normalizeBoundaryBoxDimensions(svgToExport);
      // 使用 ensureExactBoundaryBoxDimensions 来确保导出时边界框尺寸精确
      // 这会设置 SVG 的 width/height 为边界框的精确毫米值，并调整 viewBox
      svgToExport = svgManipulation.ensureExactBoundaryBoxDimensions(svgToExport);
    }
    
    const size = actualWidth > 0 && actualHeight > 0 ? { width: actualWidth, height: actualHeight } : undefined;
    onSvgGenerated(svgToExport, size);
  };

  // 下载SVG
  const handleDownload = () => {
    if (!svgResult) return;
    let svgToDownload = svgResult.svg;

    // 在导出前确保边界框尺寸正确（但不改变位置，保持与预览一致）
    if (boundaryBox.hasBoundaryBox) {
      svgToDownload = svgManipulation.normalizeBoundaryBoxDimensions(svgToDownload);
      // 使用 ensureExactBoundaryBoxDimensions 来确保导出时边界框尺寸精确
      svgToDownload = svgManipulation.ensureExactBoundaryBoxDimensions(svgToDownload);
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

