'use client';

import { EmployeePhotoFrame } from '@/components/detail/EmployeePhotoFrame';
import {
  deptAccent,
  formatOrgJoinDate,
  type OfficeOrgPerson,
} from '@/lib/vina/officeOrg';
import Link from 'next/link';
import type { CSSProperties } from 'react';

export interface OrgChartCardProps {
  department: string;
  person: OfficeOrgPerson | null;
  /** 법인장 루트처럼 인원 없이도 카드 표시 */
  placeholderTitle?: string;
}

export function OrgChartCard({
  department,
  person,
  placeholderTitle = '법인장',
}: OrgChartCardProps) {
  const accent = deptAccent(department);
  const style = { '--org-accent': accent } as CSSProperties;

  const displayName = person ? person.name : placeholderTitle;

  const inner = (
    <>
      <div className="org-card-head">{department}</div>
      <div className="org-card-body">
        <EmployeePhotoFrame
          variant="compact"
          photoPath={person?.photoPath}
          name={displayName}
        />
        <div className="org-card-copy">
          <p className="org-card-name">{displayName}</p>
          <div className="org-card-join">
            <span className="org-card-join-label">입사</span>
            <span className="org-card-join-value">
              {formatOrgJoinDate(person?.joinDate ?? null)}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  if (person) {
    return (
      <Link
        href={person.href}
        className="org-card"
        style={style}
        title={`${displayName} 상세 보기`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="org-card is-placeholder" style={style}>
      {inner}
    </div>
  );
}
