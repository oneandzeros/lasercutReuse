/**
 * 角点数据持久化工具
 * 用于保存和加载用户设置的角点数据、实际尺寸值和形状参数
 */

import { Point } from './imageProcessor';
import { ShapeState } from '../hooks/useShapeTools';

export interface SavedCornerData {
  corners: Point[];
  widthMm: number;
  heightMm: number;
  originalWidth: number;
  originalHeight: number;
  shapeState?: ShapeState; // 可选，用于向后兼容
  boundaryBoxWidthMm?: number; // 可选，边界框宽度（毫米）
  boundaryBoxHeightMm?: number; // 可选，边界框高度（毫米）
}

const STORAGE_KEY = 'faboginger:lastCornerData';

/**
 * 保存角点数据到 localStorage
 */
export function saveCornerData(data: SavedCornerData): void {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    console.warn('[cornerDataStorage] 保存角点数据失败', error);
  }
}

/**
 * 从 localStorage 加载角点数据
 * @returns 保存的角点数据，如果不存在或解析失败则返回 null
 */
export function loadCornerData(): SavedCornerData | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) {
      return null;
    }
    const data = JSON.parse(json) as SavedCornerData;
    
    // 验证数据格式
    if (
      Array.isArray(data.corners) &&
      typeof data.widthMm === 'number' &&
      typeof data.heightMm === 'number' &&
      typeof data.originalWidth === 'number' &&
      typeof data.originalHeight === 'number' &&
      data.corners.length >= 3 &&
      data.corners.every((p) => typeof p.x === 'number' && typeof p.y === 'number')
    ) {
      // 验证 shapeState（如果存在）
      if (data.shapeState !== undefined) {
        const ss = data.shapeState;
        if (
          typeof ss.padding === 'number' &&
          typeof ss.cornerRadius === 'number' &&
          typeof ss.strokeWidth === 'number' &&
          typeof ss.strokeColor === 'string' &&
          typeof ss.gap === 'number' &&
          typeof ss.step === 'number' &&
          typeof ss.minRectWidth === 'number' &&
          typeof ss.minRectHeight === 'number'
        ) {
          // shapeState 格式正确
        } else {
          // shapeState 格式不正确，删除它
          delete data.shapeState;
        }
      }
      
      // 验证边界框尺寸（如果存在）
      if (data.boundaryBoxWidthMm !== undefined && typeof data.boundaryBoxWidthMm !== 'number') {
        delete data.boundaryBoxWidthMm;
      }
      if (data.boundaryBoxHeightMm !== undefined && typeof data.boundaryBoxHeightMm !== 'number') {
        delete data.boundaryBoxHeightMm;
      }
      
      return data;
    }
    
    console.warn('[cornerDataStorage] 加载的数据格式无效');
    return null;
  } catch (error) {
    console.warn('[cornerDataStorage] 加载角点数据失败', error);
    return null;
  }
}

/**
 * 清除保存的角点数据
 */
export function clearCornerData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[cornerDataStorage] 清除角点数据失败', error);
  }
}

