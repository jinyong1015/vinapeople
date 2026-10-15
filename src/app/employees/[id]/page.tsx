'use client';

import { EmployeePhotoManager } from '@/components/admin/EmployeePhotoManager';
import { EmptyState } from '@/components/common/EmptyState';
import { Panel } from '@/components/common/Panel';
import { DetailBackNav } from '@/components/detail/DetailBackNav';
import { DetailHero } from '@/components/detail/DetailHero';
import { EmployeeAttendanceSection } from '@/components/detail/EmployeeAttendanceSection';
import { EmployeePhotoFrame } from '@/components/detail/EmployeePhotoFrame';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useWorkforce } from '@/components/providers/WorkforceProvider';
import { findPersonnelByParam } from '@/lib/vina/findPersonnel';
import { formatTenureLabel } from '@/lib/vina/format';
import { displayDepartment } from '@/lib/vina/officeOrg';
import type { Personnel } from '@/lib/vina/types';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function safeInternalPath(from: string | null): string {
  if (!from) return '/employees';
  const decoded = (() => {
    try {
      return decodeURIComponent(from);
    } catch {
      return from;
    }
  })();
  if (decoded.startsWith('http:') || decoded.startsWith('https:') || decoded.startsWith('//')) {
    return '/employees';
  }
  if (decoded.startsWith('/')) return decoded;
  return `/${decoded}`;
}

function EmployeeDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const from = searchParams.get('from');

  const { personnel, loading, dataset, dataSource, syncEmployee } = useWorkforce();
  const { isAdmin } = useAdmin();
  const [localPerson, setLocalPerson] = useState<Personnel | null>(null);

  const personFromList = useMemo(
    () => findPersonnelByParam(personnel, rawId),
    [personnel, rawId],
  );

  const person = useMemo(() => {
    if (!personFromList) return null;
    if (localPerson && localPerson.id === personFromList.id) {
      return {
        ...personFromList,
        ...localPerson,
        photoPath: localPerson.photoPath,
      };
    }
    return personFromList;
  }, [personFromList, localPerson]);

  useEffect(() => {
    setLocalPerson(null);
  }, [personFromList?.id]);

  const backHref = safeInternalPath(from);
  const backLabel = backHref.startsWith('/office')
    ? '사무직 인원'
    : backHref.startsWith('/analysis')
      ? '분석 화면'
      : backHref.startsWith('/attendance')
        ? '근태 현황'
        : backHref.startsWith('/history')
          ? '변경 이력'
          : '인원 관리';

  if (!loading && !person) {
    return (
      <div className="employee-detail-page space-y-6">
        <DetailBackNav href="/employees" label="인원 관리" />
        <EmptyState
          title="현재 데이터에서 해당 인원을 찾을 수 없습니다."
          description="목록에서 다시 선택하거나, Excel 반영 후 데이터가 교체되었는지 확인하세요."
          actions={
            <Link href="/employees" className="btn btn-primary">
              인원 목록으로
            </Link>
          }
        />
      </div>
    );
  }

  if (!person) {
    return <p className="text-muted text-sm">불러오는 중…</p>;
  }

  const ageLabel =
    person.ageYears === null || person.ageYears === undefined
      ? '-'
      : `${person.ageYears}세`;
  const tenureLabel = formatTenureLabel(
    person.tenureYears,
    person.tenureMonthsRemainder,
  );
  const heroMeta = [person.employeeNo, person.workplace, person.process]
    .filter(Boolean)
    .join(' · ');
  const isResigned = Boolean(person.resignDate) || person.employmentStatus === '퇴사';
  const statusLabel = isResigned ? '퇴사' : person.employmentStatus;

  return (
    <div className="employee-detail-page space-y-5">
      <DetailBackNav
        href={backHref}
        label={backLabel}
        metas={[
          ...(dataset
            ? [{ label: '기준일', value: dataset.asOfDate }]
            : []),
          { label: '사번', value: person.employeeNo },
        ]}
      />

      {dataSource === 'supabase' ? (
        <EmployeePhotoManager
          employee={person}
          isAdmin={isAdmin}
          status={statusLabel}
          meta={heroMeta}
          onUpdated={(updated) => {
            setLocalPerson(updated);
            syncEmployee(updated);
          }}
        />
      ) : (
        <DetailHero
          name={person.name}
          status={statusLabel}
          meta={heroMeta}
          photo={
            <EmployeePhotoFrame
              photoPath={person.photoPath}
              name={person.name}
              variant="profile"
            />
          }
        />
      )}

      <div className="detail-info-grid detail-info-grid-split">
        <Panel title="기본정보">
          <dl className="detail-field-list">
            <FieldRow label="사번" value={person.employeeNo || '-'} />
            <FieldRow label="성명" value={person.name || '-'} />
            <FieldRow label="성별" value={person.gender || '-'} />
            <FieldRow label="생년월일" value={person.birthDate ?? '-'} />
            <FieldRow label="만 나이" value={ageLabel} />
          </dl>
        </Panel>

        <Panel title="재직정보">
          <dl className="detail-field-list">
            <FieldRow label="근무지" value={person.workplace || '-'} />
            <FieldRow label="근무현황" value={person.employmentStatus || '-'} />
            <FieldRow label="직급" value={person.position || '-'} />
            <FieldRow label="공정" value={person.process || '-'} />
            <FieldRow
              label="부서"
              value={displayDepartment(person) || '-'}
            />
            <FieldRow label="입사일" value={person.joinDate ?? '-'} />
            <FieldRow label="퇴사일" value={person.resignDate ?? '-'} />
            <FieldRow label="계산 근속" value={tenureLabel} />
            <FieldRow
              label="수정일시"
              value={
                person.updatedAt
                  ? new Date(person.updatedAt).toLocaleString('ko-KR')
                  : '-'
              }
            />
            <FieldRow label="수정자" value={person.updatedBy || '-'} />
          </dl>
        </Panel>
      </div>

      <EmployeeAttendanceSection
        employeeNo={person.employeeNo}
        enabled={dataSource === 'supabase'}
      />
    </div>
  );
}

export default function EmployeeDetailPage() {
  return (
    <Suspense fallback={<p className="text-muted text-sm">불러오는 중…</p>}>
      <EmployeeDetailContent />
    </Suspense>
  );
}
