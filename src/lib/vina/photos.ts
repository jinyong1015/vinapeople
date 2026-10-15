export const PHOTO_BUCKET = 'vina-employee-photos';
/** Storage·압축 후 업로드 허용 상한 */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** 원본 선택 허용 상한 (압축 전) */
export const PHOTO_ORIGINAL_MAX_BYTES = 20 * 1024 * 1024;

export const ALLOWED_PHOTO_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedPhotoMime = (typeof ALLOWED_PHOTO_MIME)[number];

const EXT_BY_MIME: Record<AllowedPhotoMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const EXT_TO_MIME: Record<string, AllowedPhotoMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function sanitizeEmployeeNoForPath(employeeNo: string): string {
  const trimmed = employeeNo.trim();
  if (!trimmed) throw new Error('사번이 없습니다.');
  // Storage 경로에 안전한 문자만 허용
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safe || safe === '.' || safe === '..') {
    throw new Error('사번을 경로로 사용할 수 없습니다.');
  }
  return safe;
}

export function buildPhotoStoragePath(
  employeeNo: string,
  mime: AllowedPhotoMime,
): string {
  const folder = sanitizeEmployeeNoForPath(employeeNo);
  const ext = EXT_BY_MIME[mime];
  const stamp = Date.now();
  return `${folder}/profile-${stamp}.${ext}`;
}

export function toPhotoPublicUrl(
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath) return null;
  const trimmed = storagePath.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return trimmed;
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${trimmed}`;
}

/** DB에 저장된 값이 URL이면 Storage object path 로 역추출 */
export function storagePathFromStored(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) return trimmed.slice(idx + marker.length);
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return null;
  }
  return trimmed;
}

export function validatePhotoFile(
  file: {
    type: string;
    size: number;
    name: string;
  },
  options?: { maxBytes?: number },
): { ok: true; mime: AllowedPhotoMime } | { ok: false; message: string } {
  const maxBytes = options?.maxBytes ?? PHOTO_MAX_BYTES;
  if (!file || file.size <= 0) {
    return { ok: false, message: '사진 파일이 비어 있습니다.' };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `파일 크기는 ${Math.round(maxBytes / (1024 * 1024))}MB 이하여야 합니다.`,
    };
  }

  const mime = file.type as AllowedPhotoMime;
  if (!ALLOWED_PHOTO_MIME.includes(mime)) {
    return {
      ok: false,
      message: 'JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.',
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeFromExt = EXT_TO_MIME[ext];
  if (!mimeFromExt) {
    return {
      ok: false,
      message: '허용되지 않은 파일 확장자입니다. (.jpg, .jpeg, .png, .webp)',
    };
  }
  if (mimeFromExt !== mime) {
    return {
      ok: false,
      message: '파일 확장자와 파일 형식이 일치하지 않습니다.',
    };
  }

  return { ok: true, mime };
}

/** 사용자가 고른 원본 파일 검증 (압축 전, 더 큰 용량 허용) */
export function validateOriginalPhotoFile(file: {
  type: string;
  size: number;
  name: string;
}): { ok: true; mime: AllowedPhotoMime } | { ok: false; message: string } {
  return validatePhotoFile(file, { maxBytes: PHOTO_ORIGINAL_MAX_BYTES });
}
