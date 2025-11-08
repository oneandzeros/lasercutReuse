import { Point } from './imageProcessor';

export interface PerspectiveTransformOptions {
  targetWidth: number;
  targetHeight: number;
}

export function applyPerspectiveTransform(
  _img: HTMLImageElement,
  srcCorners: Point[],
  _options: PerspectiveTransformOptions
): { dataUrl: string; width: number; height: number } {
  console.warn('applyPerspectiveTransform 未实现，将返回原始图像');
  return { dataUrl: _img.src, width: _img.width, height: _img.height };
}
