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

export interface SvgProcessResult {
  svg: string;
  viewWidth: number;
  viewHeight: number;
  mask: Uint8Array;
  widthMm: number;
  heightMm: number;
}

export interface RectangleSuggestion {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface RectanglePackingOptions {
  maxWidthMm: number;
  maxHeightMm: number;
  minWidthMm?: number;
  minHeightMm?: number;
  stepMm?: number;
  gapMm?: number;
  coverageThreshold?: number;
  orientation?: 'landscape' | 'portrait' | 'both';
  maxShapes?: number;
  progressIntervalRows?: number;
  yieldAfterRows?: number;
  onProgress?: (progress: RectanglePackingProgress) => void | Promise<void>;
  shouldAbort?: () => boolean;
}

export interface RectanglePackingProgress {
  progress: number;
  processedRows: number;
  totalRows: number;
  suggestions: number;
  lastSuggestion?: RectangleSuggestion | null;
}

const BOARD_WIDTH_MM = 525;
const BOARD_HEIGHT_MM = 645;
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
    widthMm?: number;
    heightMm?: number;
  }
): Promise<SvgProcessResult> {
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

  return new Promise<SvgProcessResult>((resolve, reject) => {
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
          const widthMm = options?.widthMm ?? BOARD_WIDTH_MM;
          const heightMm = options?.heightMm ?? BOARD_HEIGHT_MM;
          const adjusted = adjustSvgDimensions(svg, {
            widthMm: options?.widthMm,
            heightMm: options?.heightMm,
            viewWidth: canvas.width,
            viewHeight: canvas.height,
          });
          resolve({
            svg: adjusted,
            viewWidth: canvas.width,
            viewHeight: canvas.height,
            mask: binaryData.slice(),
            widthMm,
            heightMm,
          });
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

function adjustSvgDimensions(
  svg: string,
  params: { widthMm?: number; heightMm?: number; viewWidth: number; viewHeight: number }
): string {
  const { widthMm, heightMm, viewWidth, viewHeight } = params;
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svg;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg') {
      return svg;
    }

    if (!root.getAttribute('viewBox')) {
      root.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
    }

    if (widthMm && widthMm > 0) {
      root.setAttribute('width', `${widthMm}mm`);
    }
    if (heightMm && heightMm > 0) {
      root.setAttribute('height', `${heightMm}mm`);
    }

    if (!root.getAttribute('xmlns')) {
      root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    return new XMLSerializer().serializeToString(doc);
  } catch (error) {
    console.warn('[processImageToSvg] 调整 SVG 尺寸失败', error);
    return svg;
  }
}

function buildDescendingRange(max: number, min: number, step: number): number[] {
  const values: number[] = [];
  if (step <= 0) {
    values.push(max, min);
    return Array.from(new Set(values)).sort((a, b) => b - a);
  }
  let current = max;
  while (current >= min) {
    values.push(Number(current.toFixed(4)));
    current -= step;
  }
  if (values[values.length - 1] !== Number(min.toFixed(4))) {
    values.push(Number(min.toFixed(4)));
  }
  return Array.from(new Set(values)).sort((a, b) => b - a);
}

export async function suggestRectanglesFromMask(
  mask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  widthMm: number,
  heightMm: number,
  options: RectanglePackingOptions
): Promise<RectangleSuggestion[]> {
  if (mask.length !== maskWidth * maskHeight) {
    throw new Error('蒙版尺寸与数组长度不一致');
  }
  if (widthMm <= 0 || heightMm <= 0) {
    throw new Error('无效的实际尺寸');
  }

  const pxPerMmX = maskWidth / widthMm;
  const pxPerMmY = maskHeight / heightMm;

  const maxWidthMm = Math.max(options.maxWidthMm, 1);
  const maxHeightMm = Math.max(options.maxHeightMm, 1);
  const minWidthMm = Math.max(options.minWidthMm ?? 20, 1);
  const minHeightMm = Math.max(options.minHeightMm ?? 20, 1);
  const stepMm = Math.max(options.stepMm ?? 10, 0.2);
  const gapMm = Math.max(options.gapMm ?? 5, 0);
  const coverageThreshold = Math.min(Math.max(options.coverageThreshold ?? 0.95, 0), 1);
  const orientation = options.orientation ?? 'both';
  const maxShapes = options.maxShapes ?? 200;
  const progressIntervalRows = Math.max(1, Math.round(options.progressIntervalRows ?? 5));
  const yieldAfterRows = Math.max(0, Math.round(options.yieldAfterRows ?? 20));
  const onProgress = options.onProgress;
  const shouldAbort = options.shouldAbort;

  const widthCandidates = buildDescendingRange(maxWidthMm, minWidthMm, stepMm);
  const heightCandidates = buildDescendingRange(maxHeightMm, minHeightMm, stepMm);

  const sizePairs: Array<{ widthMm: number; heightMm: number }> = [];
  const seen = new Set<string>();

  const addPair = (w: number, h: number) => {
    const key = `${w.toFixed(3)}-${h.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      sizePairs.push({ widthMm: w, heightMm: h });
    }
  };

  widthCandidates.forEach((w) => {
    heightCandidates.forEach((h) => {
      if (orientation === 'landscape') {
        addPair(w, h);
      } else if (orientation === 'portrait') {
        addPair(h, w);
      } else {
        addPair(w, h);
        if (w !== h) {
          addPair(h, w);
        }
      }
    });
  });

  sizePairs.sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm);

  const available = new Uint8Array(maskWidth * maskHeight);
  const original = new Uint8Array(maskWidth * maskHeight);
  for (let i = 0; i < mask.length; i++) {
    const isWhite = mask[i] > 200 ? 1 : 0;
    available[i] = isWhite;
    original[i] = isWhite;
  }

  const gapPxX = Math.round(gapMm * pxPerMmX);
  const gapPxY = Math.round(gapMm * pxPerMmY);
  const stepPxX = Math.max(1, Math.round(stepMm * pxPerMmX));
  const stepPxY = Math.max(1, Math.round(stepMm * pxPerMmY));

  const suggestions: RectangleSuggestion[] = [];
  const totalRows = Math.max(1, Math.ceil(maskHeight / stepPxY));
  let processedRows = 0;

  const reportProgress = async (force = false) => {
    if (!onProgress) return;
    if (!force && processedRows % progressIntervalRows !== 0) return;
    try {
      const payload: RectanglePackingProgress = {
        progress: Math.min(1, processedRows / totalRows),
        processedRows,
        totalRows,
        suggestions: suggestions.length,
        lastSuggestion: suggestions.length > 0 ? suggestions[suggestions.length - 1] : null,
      };
      const maybe = onProgress(payload);
      if (maybe instanceof Promise) {
        await maybe;
      }
    } catch (error) {
      console.warn('[suggestRectanglesFromMask] 进度回调异常', error);
    }
  };

  await reportProgress(true);

  const isAreaUnused = (x: number, y: number, w: number, h: number): boolean => {
    const startX = Math.max(0, x - gapPxX);
    const startY = Math.max(0, y - gapPxY);
    const endX = Math.min(maskWidth, x + w + gapPxX);
    const endY = Math.min(maskHeight, y + h + gapPxY);
    for (let yy = startY; yy < endY; yy++) {
      const rowOffset = yy * maskWidth;
      for (let xx = startX; xx < endX; xx++) {
        if (!available[rowOffset + xx]) {
          return false;
        }
      }
    }
    return true;
  };

  const whiteCoverageRatio = (x: number, y: number, w: number, h: number): number => {
    let white = 0;
    let total = 0;
    for (let yy = y; yy < y + h; yy++) {
      const rowOffset = yy * maskWidth;
      for (let xx = x; xx < x + w; xx++) {
        total++;
        if (original[rowOffset + xx]) {
          white++;
        }
      }
    }
    return total === 0 ? 0 : white / total;
  };

  const markUsed = (x: number, y: number, w: number, h: number) => {
    const startX = Math.max(0, x - gapPxX);
    const startY = Math.max(0, y - gapPxY);
    const endX = Math.min(maskWidth, x + w + gapPxX);
    const endY = Math.min(maskHeight, y + h + gapPxY);
    for (let yy = startY; yy < endY; yy++) {
      const rowOffset = yy * maskWidth;
      for (let xx = startX; xx < endX; xx++) {
        available[rowOffset + xx] = 0;
      }
    }
  };

  const toMm = (valuePx: number, perMm: number) => valuePx / perMm;

  for (let y = 0; y < maskHeight && suggestions.length < maxShapes; y += stepPxY) {
    if (shouldAbort && shouldAbort()) {
      break;
    }
    
    processedRows += 1;
    for (let x = 0; x < maskWidth && suggestions.length < maxShapes; x += stepPxX) {
      if (shouldAbort && shouldAbort()) {
        break;
      }
      
      if (!available[y * maskWidth + x]) continue;

      for (const pair of sizePairs) {
        const widthPx = Math.max(1, Math.round(pair.widthMm * pxPerMmX));
        const heightPx = Math.max(1, Math.round(pair.heightMm * pxPerMmY));
        if (widthPx < 1 || heightPx < 1) continue;
        if (x + widthPx > maskWidth || y + heightPx > maskHeight) continue;

        if (!isAreaUnused(x, y, widthPx, heightPx)) continue;

        const coverage = whiteCoverageRatio(x, y, widthPx, heightPx);
        if (coverage < coverageThreshold) continue;

        suggestions.push({
          xMm: toMm(x, pxPerMmX),
          yMm: toMm(y, pxPerMmY),
          widthMm: toMm(widthPx, pxPerMmX),
          heightMm: toMm(heightPx, pxPerMmY),
        });

        markUsed(x, y, widthPx, heightPx);
        break;
      }
    }

    await reportProgress();

    if (yieldAfterRows > 0 && processedRows % yieldAfterRows === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    
    if (shouldAbort && shouldAbort()) {
      break;
    }
  }

  processedRows = Math.min(processedRows, totalRows);
  await reportProgress(true);

  return suggestions;
}
