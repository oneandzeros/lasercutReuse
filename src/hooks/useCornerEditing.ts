/**
 * 角点编辑自定义Hook
 * 管理角点的添加、拖拽、应用等逻辑
 */

import { useEffect, useRef, useState } from 'react';
import { Point, AutoCorrectResult, generateCorrectedImage, normalizeCorners } from '../utils/imageProcessor';
import { toImagePoint, clampToImage } from '../utils/coordinateUtils';
import { saveCornerData } from '../utils/cornerDataStorage';

interface UseCornerEditingProps {
  imageData: string;
  imageRef: React.RefObject<HTMLImageElement>;
  isImageReady: boolean;
  actualWidth: number;
  actualHeight: number;
  autoCorrect: AutoCorrectResult | null;
  onCorrectedImageChange: (image: string) => void;
  onAutoCorrectUpdate: (result: AutoCorrectResult | null) => void;
}

interface UseCornerEditingReturn {
  manualCorners: Point[];
  cornersDirty: boolean;
  applyingCorners: boolean;
  draggingIndex: number | null;
  setManualCorners: React.Dispatch<React.SetStateAction<Point[]>>;
  setCornersDirty: React.Dispatch<React.SetStateAction<boolean>>;
  handleOverlayClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleHandlePointerDown: (event: React.PointerEvent<HTMLDivElement>, index: number) => void;
  handleApplyCorners: () => Promise<void>;
  resetCorners: () => void;
}

export const useCornerEditing = ({
  imageData,
  imageRef,
  isImageReady,
  actualWidth,
  actualHeight,
  autoCorrect,
  onCorrectedImageChange,
  onAutoCorrectUpdate,
}: UseCornerEditingProps): UseCornerEditingReturn => {
  const [manualCorners, setManualCorners] = useState<Point[]>([]);
  const [cornersDirty, setCornersDirty] = useState(false);
  const [applyingCorners, setApplyingCorners] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  // 重置角点
  const resetCorners = () => {
    setManualCorners([]);
    setCornersDirty(false);
    setDraggingIndex(null);
    draggingIndexRef.current = null;
  };

  // 处理角点手柄按下事件
  const handleHandlePointerDown = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    setDraggingIndex(index);
    draggingIndexRef.current = index;
  };

  // 处理图片点击事件，添加角点
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    const target = event.target as HTMLElement;
    if (target.dataset.handle === 'true') return;
    if (manualCorners.length >= 4) return;
    
    const point = toImagePoint(event.clientX, event.clientY, imageRef.current);
    if (!point) return;
    
    setManualCorners((prev) => {
      const next = [...prev, clampToImage(point, imageRef.current)];
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

  // 应用角点校正
  const handleApplyCorners = async () => {
    if (!imageRef.current) {
      throw new Error('图片尚未加载完成');
    }
    if (manualCorners.length < 3) {
      throw new Error('请至少标记三个角点');
    }
    
    setApplyingCorners(true);
    try {
      const normalized = normalizeCorners(
        manualCorners,
        imageRef.current.naturalWidth,
        imageRef.current.naturalHeight
      );
      const result = await generateCorrectedImage(imageData, normalized, {
        widthMm: actualWidth > 0 ? actualWidth : undefined,
        heightMm: actualHeight > 0 ? actualHeight : undefined,
      });
      
      setManualCorners(result.corners);
      onCorrectedImageChange(result.dataUrl);
      setCornersDirty(false);
      
      // 保存角点数据和实际尺寸值到 localStorage
      if (imageRef.current) {
        saveCornerData({
          corners: result.corners,
          widthMm: actualWidth,
          heightMm: actualHeight,
          originalWidth: imageRef.current.naturalWidth,
          originalHeight: imageRef.current.naturalHeight,
        });
      }
      
      onAutoCorrectUpdate(
        autoCorrect
          ? {
              ...autoCorrect,
              correctedDataUrl: result.dataUrl,
              corners: result.corners,
              widthMm: result.widthMm,
              heightMm: result.heightMm,
            }
          : null
      );
    } finally {
      setApplyingCorners(false);
    }
  };

  // 角点拖拽处理
  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMove = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      const point = toImagePoint(event.clientX, event.clientY, imageRef.current);
      if (!point) return;
      
      setManualCorners((prev) => {
        if (draggingIndex === null || !prev[draggingIndex]) return prev;
        const next = [...prev];
        next[draggingIndex] = clampToImage(point, imageRef.current);
        return next;
      });
      setCornersDirty(true);
    };

    const handleUp = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return;
      pointerIdRef.current = null;
      setDraggingIndex(null);
      draggingIndexRef.current = null;
      
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
  }, [draggingIndex, imageRef]);

  // 自动应用角点（当角点数量达到4个时）
  useEffect(() => {
    if (draggingIndex !== null) return;

    if (
      manualCorners.length === 4 &&
      cornersDirty &&
      !applyingCorners &&
      imageRef.current &&
      isImageReady
    ) {
      const timer = setTimeout(() => {
        if (draggingIndexRef.current === null) {
          handleApplyCorners().catch((err) => {
            console.warn('[useCornerEditing] 自动应用角点失败', err);
          });
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualCorners.length, cornersDirty, applyingCorners, isImageReady, draggingIndex]);

  return {
    manualCorners,
    cornersDirty,
    applyingCorners,
    draggingIndex,
    setManualCorners,
    setCornersDirty,
    handleOverlayClick,
    handleHandlePointerDown,
    handleApplyCorners,
    resetCorners,
  };
};

