import { UserRound } from 'lucide-react';

export interface EmployeePhotoFrameProps {
  /** 향후 Supabase Storage URL 또는 로컬 경로 */
  photoPath?: string | null;
  name: string;
  /** profile: 상세 헤더 / compact: 목록·사무직 카드용 / card: 단독 사진 카드 */
  variant?: 'profile' | 'card' | 'compact';
  className?: string;
}

/**
 * 인원 프로필 사진.
 * - 있으면 object-fit: contain 으로 원본 비율 유지·전체 표시
 * - 없으면 placeholder (임의의 인물 사진 생성 금지)
 */
export function EmployeePhotoFrame({
  photoPath,
  name,
  variant = 'card',
  className = '',
}: EmployeePhotoFrameProps) {
  if (variant === 'compact') {
    return (
      <div
        className={`employee-photo-compact detail-photo-frame ${className}`.trim()}
      >
        {photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPath}
            alt={`${name} 사진`}
            className="detail-photo-img"
          />
        ) : (
          <div className="detail-photo-empty">
            <UserRound size={36} strokeWidth={1.5} aria-hidden />
            <span>미등록</span>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'profile') {
    return (
      <div className={`detail-photo-profile ${className}`.trim()}>
        {photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPath}
            alt={`${name} 사진`}
            className="detail-photo-profile-img"
          />
        ) : (
          <div className="detail-photo-profile-empty">
            <UserRound size={44} strokeWidth={1.5} aria-hidden />
            <span>사진 미등록</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className={`detail-photo ${className}`.trim()}>
      <div className="detail-photo-head">
        <h2 className="detail-photo-title">프로필 사진</h2>
        <p className="detail-photo-desc">원본 비율 유지 · 미등록 시 대체 표시</p>
      </div>
      <div className="detail-photo-body">
        <div className="detail-photo-frame">
          {photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPath}
              alt={`${name} 사진`}
              className="detail-photo-img"
            />
          ) : (
            <div className="detail-photo-empty">
              <UserRound size={40} strokeWidth={1.5} aria-hidden />
              <span>사진 미등록</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
