/**
 * 图像处理工具集：自动角点识别 + Potrace 描摹
 */

import { applyPerspectiveTransform } from './perspective';
import PotraceModule from 'potrace';

export interface Point {
  x: number;
  y: number;
}

export interface AutoCorrectResult {
  originalDataUrl: string;
  correctedDataUrl: string;
  widthMm: number;
  heightMm: number;
  corners: Point[];
  redPixels: Point[];
}

const BOARD_WIDTH_MM = 645;
const BOARD_HEIGHT_MM = 525;
const MAX_SCAN_PIXELS = 10_000;
const PIXELS_PER_MM = 4;

const Potrace: any = PotraceModule;

export async function autoCorrectPerspective(imageData: string): Promise<AutoCorrectResult> {
  const img = await loadImage(imageData);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');
  ctx.drawImage(img, 0, 0);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const redPixels = detectRedPixels(image);
  if (redPixels.length < 3) {
    throw new Error('未检测到足够的红色标记，请确认胶带清晰可见');
  }

  const inferred = inferCornersFromRedPixels(redPixels, image.width, image.height);
  const normalizedCorners = normalizeCorners(inferred, image.width, image.height);
  const corrected = applyCorrectionWithImage(img, normalizedCorners);

  return {
    originalDataUrl: imageData,
    correctedDataUrl: corrected.dataUrl,
    widthMm: corrected.widthMm,
    heightMm: corrected.heightMm,
    corners: corrected.corners,
    redPixels,
  };
}

export async function generateCorrectedImage(
  imageData: string,
  corners: Point[],
  options?: {
    widthMm?: number;
    heightMm?: number;
    pixelsPerMm?: number;
  }
): Promise<{
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  corners: Point[];
}> {
  const img = await loadImage(imageData);
  return applyCorrectionWithImage(img, corners, options);
}

export async function processImageToSvg(
  imageData: string,
  options?: {
    threshold?: number;
    turdSize?: number;
    optTolerance?: number;
  }
): Promise<string> {
  const img = await loadImage(imageData);

  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageDataObj.data;

  let threshold = options?.threshold;
  if (threshold === undefined || threshold === null) {
    threshold = calculateOtsuThreshold(data);
  }

  const binaryData = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const idx = i / 4;
    const value = gray > threshold ? 255 : 0;
    binaryData[idx] = value;
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageDataObj, 0, 0);

  const pngDataUrl = canvas.toDataURL('image/png');

  return new Promise<string>((resolve, reject) => {
    Potrace.trace(
      pngDataUrl,
      {
        threshold: 128,
        turdSize: options?.turdSize ?? 2,
        optTolerance: options?.optTolerance ?? 0.4,
        optCurve: true,
        turnPolicy: 'minority',
      },
      (error: Error | null, svg: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(svg);
        }
      }
    );
  });
}

export function normalizeCorners(corners: Point[], width: number, height: number): Point[] {
  if (corners.length < 3) {
    throw new Error('至少需要三个角点');
  }

  let working = corners.map((p) => clampPoint(p, width, height));

  if (working.length === 3) {
    const sortedByY = [...working].sort((a, b) => a.y - b.y);
    const topTwo = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = sortedByY[2];
    const topLeft = topTwo[0];
    const topRight = topTwo[1];
    const bottomRight = bottom;
    const bottomLeft = clampPoint(
      {
        x: topLeft.x + bottomRight.x - topRight.x,
        y: topLeft.y + bottomRight.y - topRight.y,
      },
      width,
      height
    );
    working = [topLeft, topRight, bottomRight, bottomLeft];
  } else if (working.length > 4) {
    working = selectFourExtremePoints(working);
  } else if (working.length === 4) {
    // nothing
  }

  if (working.length !== 4) {
    throw new Error('无法归一化角点');
  }

  const sortedByY = [...working].sort((a, b) => a.y - b.y);
  const topTwo = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottomTwo = sortedByY.slice(-2).sort((a, b) => a.x - b.x);

  if (topTwo.length < 2 || bottomTwo.length < 2) {
    throw new Error('角点排序失败');
  }

  const [topLeft, topRight] = topTwo;
  let [bottomLeft, bottomRight] = bottomTwo;

  // 确保 bottomRight 位于 bottomLeft 右侧
  if (bottomRight.x < bottomLeft.x) {
    [bottomLeft, bottomRight] = [bottomRight, bottomLeft];
  }

  const ordered: Point[] = [topLeft, topRight, bottomRight, bottomLeft];
  return ordered.map((p) => clampPoint(p, width, height));
}

function calculateOtsuThreshold(data: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[gray]++;
  }

  const total = data.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * Math.pow(mB - mF, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
}

function detectRedPixels(image: ImageData): Point[] {
  const { data, width, height } = image;
  const pixels: Point[] = [];

  const step = Math.max(1, Math.round(Math.sqrt((width * height) / MAX_SCAN_PIXELS)));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (isRed(r, g, b)) {
        pixels.push({ x, y });
      }
    }
  }

  return pixels;
}

function isRed(r: number, g: number, b: number): boolean {
  const maxOther = Math.max(g, b);
  return r > 150 && r - maxOther > 40 && g < 200 && b < 200;
}

function inferCornersFromRedPixels(points: Point[], width: number, height: number): Point[] {
  const sortedByY = [...points].sort((a, b) => a.y - b.y);
  const topCandidates = sortedByY.slice(0, Math.max(2, Math.round(sortedByY.length * 0.1)));
  const bottomCandidate = sortedByY[sortedByY.length - 1];

  const topLeft = topCandidates.reduce((min, p) => (p.x < min.x ? p : min), topCandidates[0]);
  const topRight = topCandidates.reduce((max, p) => (p.x > max.x ? p : max), topCandidates[0]);

  const bottomRight = bottomCandidate;
  const bottomLeft = {
    x: topLeft.x + bottomRight.x - topRight.x,
    y: topLeft.y + bottomRight.y - topRight.y,
  };

  return [topLeft, topRight, bottomRight, clampPoint(bottomLeft, width, height)];
}

function clampPoint(point: Point, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(point.x, 0), width - 1),
    y: Math.min(Math.max(point.y, 0), height - 1),
  };
}

function selectFourExtremePoints(points: Point[]): Point[] {
  if (points.length <= 4) return points.slice(0, 4);
  const tl = points.reduce((acc, p) => (p.x + p.y < acc.x + acc.y ? p : acc), points[0]);
  const tr = points.reduce((acc, p) => (p.x - p.y > acc.x - acc.y ? p : acc), points[0]);
  const br = points.reduce((acc, p) => (p.x + p.y > acc.x + acc.y ? p : acc), points[0]);
  const bl = points.reduce((acc, p) => (p.y - p.x > acc.y - acc.x ? p : acc), points[0]);
  return [tl, tr, br, bl];
}

function applyCorrectionWithImage(
  img: HTMLImageElement,
  corners: Point[],
  options?: {
    widthMm?: number;
    heightMm?: number;
    pixelsPerMm?: number;
  }
): {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  corners: Point[];
} {
  const normalized = normalizeCorners(corners, img.width, img.height);
  const widthMm = options?.widthMm ?? BOARD_WIDTH_MM;
  const heightMm = options?.heightMm ?? BOARD_HEIGHT_MM;
  const pixelsPerMm = options?.pixelsPerMm ?? PIXELS_PER_MM;
  const targetWidth = Math.max(1, Math.round(widthMm * pixelsPerMm));
  const targetHeight = Math.max(1, Math.round(heightMm * pixelsPerMm));
  const transformed = applyPerspectiveTransform(img, normalized, {
    targetWidth,
    targetHeight,
  });

  return {
    dataUrl: transformed.dataUrl,
    widthMm,
    heightMm,
    widthPx: targetWidth,
    heightPx: targetHeight,
    corners: normalized,
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
