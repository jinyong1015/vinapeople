/** 브라우저 Canvas 기반 프로필 사진 압축 (업로드 전) */

export const PHOTO_COMPRESS_MAX_EDGE = 1200;
export const PHOTO_COMPRESS_TARGET_BYTES = 300 * 1024;
export const PHOTO_COMPRESS_INITIAL_QUALITY = 0.8;
export const PHOTO_COMPRESS_MIN_QUALITY = 0.45;
export const PHOTO_COMPRESS_QUALITY_STEP = 0.05;

export interface CompressPhotoResult {
  file: File;
  blob: Blob;
  originalBytes: number;
  compressedBytes: number;
  reductionRatio: number;
  width: number;
  height: number;
  quality: number;
  previewUrl: string;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 압축에 실패했습니다. 손상된 파일일 수 있습니다.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      // EXIF 방향 반영 (지원 브라우저)
      imageOrientation: 'from-image',
    } as ImageBitmapOptions);
  } catch {
    return await createImageBitmap(file);
  }
}

function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new Error('이미지 크기를 읽을 수 없습니다.');
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 원본 비율을 유지한 채 최대 변 1200px, JPEG로 압축한다.
 * 목표 300KB 이하가 될 때까지 품질을 낮추되 최소 품질은 유지한다.
 */
export async function compressEmployeePhoto(
  file: File,
): Promise<CompressPhotoResult> {
  const originalBytes = file.size;
  let bitmap: ImageBitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    throw new Error(
      '이미지를 읽을 수 없습니다. JPEG·PNG·WebP 형식인지 확인해 주세요.',
    );
  }

  try {
    const { width, height } = fitWithinMaxEdge(
      bitmap.width,
      bitmap.height,
      PHOTO_COMPRESS_MAX_EDGE,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('이미지 압축을 지원하지 않는 환경입니다.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // JPEG는 알파 없음 — 흰 배경으로 채워 EXIF/투명도 제거
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = PHOTO_COMPRESS_INITIAL_QUALITY;
    let blob = await canvasToBlob(canvas, quality);

    while (
      blob.size > PHOTO_COMPRESS_TARGET_BYTES &&
      quality > PHOTO_COMPRESS_MIN_QUALITY + 0.001
    ) {
      quality = Math.max(
        PHOTO_COMPRESS_MIN_QUALITY,
        quality - PHOTO_COMPRESS_QUALITY_STEP,
      );
      blob = await canvasToBlob(canvas, quality);
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile';
    const compressedFile = new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    const compressedBytes = compressedFile.size;
    const reductionRatio =
      originalBytes > 0
        ? Math.max(0, (originalBytes - compressedBytes) / originalBytes)
        : 0;

    return {
      file: compressedFile,
      blob,
      originalBytes,
      compressedBytes,
      reductionRatio,
      width,
      height,
      quality,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    bitmap.close();
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)}KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : mb.toFixed(2)}MB`;
}

export function formatReductionPercent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio < 0) return '0%';
  return `${(ratio * 100).toFixed(1)}%`;
}
