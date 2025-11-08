import type { Point } from './imageProcessor';

export interface PerspectiveTransformOptions {
  targetWidth: number;
  targetHeight: number;
  fillColor?: [number, number, number, number];
}

export function applyPerspectiveTransform(
  img: HTMLImageElement,
  srcCorners: Point[],
  options: PerspectiveTransformOptions
): { dataUrl: string; width: number; height: number } {
  if (srcCorners.length !== 4) {
    throw new Error('透视变换需要四个角点');
  }

  const { targetWidth, targetHeight, fillColor } = options;

  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: targetWidth - 1, y: 0 },
    { x: targetWidth - 1, y: targetHeight - 1 },
    { x: 0, y: targetHeight - 1 },
  ];

  const matrix = computePerspectiveMatrix(srcCorners, dstCorners);
  const inverseMatrix = invertMatrix3x3(matrix);

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = img.width;
  sourceCanvas.height = img.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('无法获取原图画布上下文');
  }
  sourceCtx.drawImage(img, 0, 0, img.width, img.height);
  const sourceImageData = sourceCtx.getImageData(0, 0, img.width, img.height);
  const sourceData = sourceImageData.data;

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;
  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx) {
    throw new Error('无法获取目标画布上下文');
  }
  const targetImageData = targetCtx.createImageData(targetWidth, targetHeight);
  const targetData = targetImageData.data;

  const fill = fillColor ?? [255, 255, 255, 255];

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const { x: srcX, y: srcY } = applyMatrix(inverseMatrix, { x, y });

      if (srcX >= 0 && srcX < img.width - 1 && srcY >= 0 && srcY < img.height - 1) {
        const x1 = Math.floor(srcX);
        const y1 = Math.floor(srcY);
        const x2 = x1 + 1;
        const y2 = y1 + 1;

        const dx = srcX - x1;
        const dy = srcY - y1;

        const idx = (y * targetWidth + x) * 4;

        const p11 = getPixel(sourceData, img.width, img.height, x1, y1);
        const p12 = getPixel(sourceData, img.width, img.height, x2, y1);
        const p21 = getPixel(sourceData, img.width, img.height, x1, y2);
        const p22 = getPixel(sourceData, img.width, img.height, x2, y2);

        targetData[idx] = bilinear(p11[0], p12[0], p21[0], p22[0], dx, dy);
        targetData[idx + 1] = bilinear(p11[1], p12[1], p21[1], p22[1], dx, dy);
        targetData[idx + 2] = bilinear(p11[2], p12[2], p21[2], p22[2], dx, dy);
        targetData[idx + 3] = bilinear(p11[3], p12[3], p21[3], p22[3], dx, dy);
      } else {
        const idx = (y * targetWidth + x) * 4;
        targetData[idx] = fill[0];
        targetData[idx + 1] = fill[1];
        targetData[idx + 2] = fill[2];
        targetData[idx + 3] = fill[3];
      }
    }
  }

  targetCtx.putImageData(targetImageData, 0, 0);
  return { dataUrl: targetCanvas.toDataURL('image/png'), width: targetWidth, height: targetHeight };
}

function bilinear(c00: number, c10: number, c01: number, c11: number, dx: number, dy: number): number {
  const c0 = c00 * (1 - dx) + c10 * dx;
  const c1 = c01 * (1 - dx) + c11 * dx;
  return c0 * (1 - dy) + c1 * dy;
}

function getPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): [number, number, number, number] {
  const clampedX = Math.min(Math.max(x, 0), width - 1);
  const clampedY = Math.min(Math.max(y, 0), height - 1);
  const idx = (clampedY * width + clampedX) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

function computePerspectiveMatrix(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const h = solveLinearSystem(A, b);
  if (!h) {
    throw new Error('透视矩阵求解失败');
  }

  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1,
  ];
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) {
        pivot = row;
      }
    }

    if (Math.abs(M[pivot][col]) < 1e-10) {
      return null;
    }

    if (pivot !== col) {
      [M[pivot], M[col]] = [M[col], M[pivot]];
    }

    const pivotVal = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivotVal;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = M[row][col];
        for (let j = col; j <= n; j++) {
          M[row][j] -= factor * M[col][j];
        }
      }
    }
  }

  return M.map((row) => row[n]);
}

function invertMatrix3x3(m: number[]): number[] {
  const det =
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);

  if (Math.abs(det) < 1e-12) {
    throw new Error('透视矩阵不可逆');
  }

  const invDet = 1 / det;

  return [
    (m[4] * m[8] - m[5] * m[7]) * invDet,
    (m[2] * m[7] - m[1] * m[8]) * invDet,
    (m[1] * m[5] - m[2] * m[4]) * invDet,
    (m[5] * m[6] - m[3] * m[8]) * invDet,
    (m[0] * m[8] - m[2] * m[6]) * invDet,
    (m[2] * m[3] - m[0] * m[5]) * invDet,
    (m[3] * m[7] - m[4] * m[6]) * invDet,
    (m[1] * m[6] - m[0] * m[7]) * invDet,
    (m[0] * m[4] - m[1] * m[3]) * invDet,
  ];
}

function applyMatrix(matrix: number[], point: { x: number; y: number }): { x: number; y: number } {
  const x = point.x;
  const y = point.y;
  const denom = matrix[6] * x + matrix[7] * y + matrix[8];

  if (Math.abs(denom) < 1e-10) {
    return { x: -1, y: -1 };
  }

  const newX = (matrix[0] * x + matrix[1] * y + matrix[2]) / denom;
  const newY = (matrix[3] * x + matrix[4] * y + matrix[5]) / denom;
  return { x: newX, y: newY };
}
