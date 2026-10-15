'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DetailHero } from '@/components/detail/DetailHero';
import { EmployeePhotoFrame } from '@/components/detail/EmployeePhotoFrame';
import { useToast } from '@/components/providers/ToastProvider';
import {
  compressEmployeePhoto,
  formatFileSize,
} from '@/lib/vina/compressImage';
import {
  ALLOWED_PHOTO_MIME,
  PHOTO_MAX_BYTES,
  validateOriginalPhotoFile,
  validatePhotoFile,
} from '@/lib/vina/photos';
import type { Personnel } from '@/lib/vina/types';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface EmployeePhotoManagerProps {
  employee: Personnel;
  isAdmin: boolean;
  status: string;
  meta?: string;
  onUpdated: (employee: Personnel) => void;
}

type PendingMode = 'upload' | 'replace' | null;

export function EmployeePhotoManager({
  employee,
  isAdmin,
  status,
  meta,
  onUpdated,
}: EmployeePhotoManagerProps) {
  const { pushToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasPhoto = Boolean(employee.photoPath);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearPending = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setPendingMode(null);
    setCompressing(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const openPicker = (mode: 'upload' | 'replace') => {
    setPendingMode(mode);
    inputRef.current?.click();
  };

  const onFilePicked = (file: File | null) => {
    if (!file) {
      clearPending();
      return;
    }

    const validated = validateOriginalPhotoFile({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (!validated.ok) {
      pushToast(validated.message, 'error');
      clearPending();
      return;
    }

    // 압축 완료 전 업로드 불가 — 선택 직후 압축 시작
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setCompressing(true);

    void (async () => {
      try {
        const result = await compressEmployeePhoto(file);
        const after = validatePhotoFile({
          type: result.file.type,
          size: result.file.size,
          name: result.file.name,
        });
        if (!after.ok) {
          URL.revokeObjectURL(result.previewUrl);
          throw new Error(
            after.message.includes('MB')
              ? `압축 후에도 파일이 너무 큽니다 (${formatFileSize(result.compressedBytes)}). 다른 사진을 선택해 주세요.`
              : after.message,
          );
        }
        if (result.compressedBytes > PHOTO_MAX_BYTES) {
          URL.revokeObjectURL(result.previewUrl);
          throw new Error(
            `압축 후에도 파일이 너무 큽니다 (${formatFileSize(result.compressedBytes)}). 다른 사진을 선택해 주세요.`,
          );
        }
        setPendingFile(result.file);
        setPreviewUrl(result.previewUrl);
      } catch (err) {
        pushToast(
          err instanceof Error ? err.message : '이미지 압축에 실패했습니다.',
          'error',
        );
        clearPending();
      } finally {
        setCompressing(false);
      }
    })();
  };

  const confirmUpload = async () => {
    if (!pendingFile || busy || compressing) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', pendingFile);
      const res = await fetch(
        `/api/employees/${encodeURIComponent(employee.id)}/photo`,
        { method: 'POST', credentials: 'include', body: form },
      );
      const body = (await res.json().catch(() => null)) as {
        employee?: Personnel;
        message?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.message || '사진 업로드에 실패했습니다.');
      }
      if (!body?.employee) {
        throw new Error('업로드 결과를 확인할 수 없습니다.');
      }
      onUpdated(body.employee);
      pushToast(
        pendingMode === 'replace'
          ? '사진을 변경했습니다.'
          : '사진을 등록했습니다.',
        'success',
      );
      clearPending();
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : '사진 업로드에 실패했습니다.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/employees/${encodeURIComponent(employee.id)}/photo`,
        { method: 'DELETE', credentials: 'include' },
      );
      const body = (await res.json().catch(() => null)) as {
        employee?: Personnel;
        message?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.message || '사진 삭제에 실패했습니다.');
      }
      if (!body?.employee) {
        throw new Error('삭제 결과를 확인할 수 없습니다.');
      }
      onUpdated(body.employee);
      setDeleteOpen(false);
      pushToast('사진을 삭제했습니다.', 'success');
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : '사진 삭제에 실패했습니다.',
        'error',
      );
    } finally {
      setDeleting(false);
    }
  };

  const displayPath = previewUrl || employee.photoPath;
  const readyToUpload = Boolean(pendingFile && previewUrl && !compressing);

  const actions =
    isAdmin ? (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_PHOTO_MIME.join(',')}
          className="hidden"
          disabled={busy || deleting || compressing}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onFilePicked(file);
          }}
        />
        {compressing ? (
          <button type="button" className="data-edit-btn" data-ready="true" disabled>
            압축 중…
          </button>
        ) : !readyToUpload ? (
          !hasPhoto ? (
            <button
              type="button"
              className="data-edit-btn"
              data-ready="true"
              disabled={busy}
              onClick={() => openPicker('upload')}
            >
              <span className="data-edit-btn-icon" aria-hidden>
                <ImagePlus size={14} />
              </span>
              사진 등록
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="data-edit-btn"
                data-ready="true"
                disabled={busy}
                onClick={() => openPicker('replace')}
              >
                <span className="data-edit-btn-icon" aria-hidden>
                  <Camera size={14} />
                </span>
                사진 변경
              </button>
              <button
                type="button"
                className="data-edit-btn"
                data-ready="true"
                data-tone="error"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <span className="data-edit-btn-icon" aria-hidden>
                  <Trash2 size={14} />
                </span>
                사진 삭제
              </button>
            </div>
          )
        ) : (
          <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="data-edit-btn"
                data-ready="true"
                disabled={busy || compressing}
                onClick={() => void confirmUpload()}
              >
                <span className="data-edit-btn-icon" aria-hidden>
                  <ImagePlus size={14} />
                </span>
                {busy
                  ? '업로드 중…'
                  : pendingMode === 'replace'
                    ? '변경 확정'
                    : '등록 확정'}
              </button>
              <button
                type="button"
                className="data-edit-btn"
                data-ready="true"
                disabled={busy || compressing}
                onClick={clearPending}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </>
    ) : null;

  return (
    <>
      <DetailHero
        name={employee.name}
        status={status}
        meta={meta}
        photo={
          <EmployeePhotoFrame
            photoPath={displayPath}
            name={employee.name}
            variant="profile"
          />
        }
        actions={actions}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="사진 삭제"
        description="등록된 사진을 정말 삭제하시겠습니까?"
        note="삭제한 사진은 복구할 수 없습니다."
        confirmLabel="예"
        cancelLabel="아니요"
        tone="danger"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
