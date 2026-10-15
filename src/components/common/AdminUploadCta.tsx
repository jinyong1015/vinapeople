'use client';

import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

/** 관리자에게만 데이터 업로드 링크를 노출합니다. */
export function AdminUploadCta({
  className = 'btn btn-primary',
  label = '데이터 업로드',
}: {
  className?: string;
  label?: string;
}) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return null;
  return (
    <Link href="/manage/import" className={className}>
      {label}
    </Link>
  );
}
