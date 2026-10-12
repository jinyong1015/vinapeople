'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useWorkforce } from '@/components/providers/WorkforceProvider';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  POSITION_OPTIONS,
  PROCESS_OPTIONS,
  WORKPLACE_OPTIONS,
} from '@/lib/vina/codes';
import {
  computeAgeYears,
  computeTenure,
  parseCalendarDate,
} from '@/lib/vina/dates';
import { formatTenureLabel } from '@/lib/vina/format';
import type { GenderCode, Personnel } from '@/lib/vina/types';
import { DatasetVersionConflictError } from '@/lib/vina/types';
import { PencilLine, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface EmployeeEditModalProps {
  open: boolean;
  employee: Personnel | null;
  onClose: () => void;
  onSaved?: (employee: Personnel) => void;
}

interface FormState {
  name: string;
  workplace: string;
  employmentStatus: string;
  category: string;
  category1: string;
  department: string;
  category3: string;
  category4: string;
  position: string;
  process: string;
  gender: GenderCode;
  birthDate: string;
  joinDate: string;
  resignDate: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function toForm(employee: Personnel): FormState {
  return {
    name: employee.name,
    workplace: employee.workplace,
    employmentStatus: employee.employmentStatus,
    category: employee.category,
    category1: employee.category1,
    department: employee.department ?? '',
    category3: employee.category3,
    category4: employee.category4,
    position: employee.position,
    process: employee.process,
    gender: employee.gender,
    birthDate: employee.birthDate ?? '',
    joinDate: employee.joinDate ?? '',
    resignDate: employee.resignDate ?? '',
  };
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = '성명을 입력하세요.';
  if (!form.workplace.trim()) errors.workplace = '근무지를 선택하세요.';
  if (!form.employmentStatus.trim()) {
    errors.employmentStatus = '근무현황을 선택하세요.';
  }
  if (!form.position.trim()) errors.position = '직급을 선택하세요.';
  if (!form.process.trim()) errors.process = '공정을 선택하세요.';

  const birth = form.birthDate.trim();
  if (birth && !parseCalendarDate(birth)) {
    errors.birthDate = '올바른 생년월일(YYYY-MM-DD)을 입력하세요.';
  }
  const join = form.joinDate.trim();
  if (join && !parseCalendarDate(join)) {
    errors.joinDate = '올바른 입사일(YYYY-MM-DD)을 입력하세요.';
  }
  const resign = form.resignDate.trim();
  if (resign && !parseCalendarDate(resign)) {
    errors.resignDate = '올바른 퇴사일(YYYY-MM-DD)을 입력하세요.';
  }
  return errors;
}

function genderSources(gender: GenderCode): {
  genderSource: string;
  genderLabelSource: string;
} {
  if (gender === '남자') {
    return { genderSource: 'Nam', genderLabelSource: '남자' };
  }
  return { genderSource: 'Nữ', genderLabelSource: '여자' };
}

export function EmployeeEditModal({
  open,
  employee,
  onClose,
  onSaved,
}: EmployeeEditModalProps) {
  const { dataset, updateEmployee, reload } = useWorkforce();
  const { isAdmin, openSettings } = useAdmin();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (open && employee) {
      setForm(toForm(employee));
      setErrors({});
      setSaveError(null);
    }
  }, [open, employee]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dirty = useMemo(() => {
    if (!employee || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(toForm(employee));
  }, [employee, form]);

  const previewAge = useMemo(() => {
    if (!form || !dataset) return null;
    const birth = form.birthDate.trim();
    if (!birth) return null;
    return computeAgeYears(birth, dataset.asOfDate);
  }, [form, dataset]);

  const previewTenure = useMemo(() => {
    if (!form || !dataset) return null;
    const join = form.joinDate.trim();
    if (!join) return null;
    return computeTenure(join, dataset.asOfDate);
  }, [form, dataset]);

  if (!open || !employee || !form) return null;

  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const onSave = async () => {
    if (!isAdmin) {
      openSettings('admin');
      setSaveError('관리자 로그인이 필요합니다.');
      return;
    }

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstKey = Object.keys(nextErrors)[0] as keyof FormState;
      document.getElementById(`edit-${firstKey}`)?.focus();
      return;
    }
    if (!dataset) return;

    setSaving(true);
    setSaveError(null);
    try {
      const gate = await fetch('/api/admin/ping', { credentials: 'include' });
      if (!gate.ok) {
        setSaveError('관리자 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
        openSettings('admin');
        return;
      }

      const { genderSource, genderLabelSource } = genderSources(form.gender);
      const birthDate = form.birthDate.trim() || null;
      const joinDate = form.joinDate.trim() || null;
      const resignDate = form.resignDate.trim() || null;
      const tenure = joinDate ? computeTenure(joinDate, dataset.asOfDate) : null;
      const ageYears = birthDate
        ? computeAgeYears(birthDate, dataset.asOfDate)
        : null;

      const updated = await updateEmployee(employee.id, {
        name: form.name.trim(),
        workplace: form.workplace,
        employmentStatus: form.employmentStatus,
        category: form.category.trim(),
        category1: form.category1.trim(),
        department: form.department.trim(),
        category3: form.category3.trim(),
        category4: form.category4.trim(),
        position: form.position,
        process: form.process,
        gender: form.gender,
        genderSource,
        genderLabelSource,
        birthDate,
        joinDate,
        resignDate,
        ageYears,
        tenureYears: tenure?.years ?? null,
        tenureMonthsRemainder: tenure?.monthsRemainder ?? null,
        tenureTotalMonths: tenure?.totalMonths ?? null,
        tenureTotalDays: tenure?.totalDays ?? null,
      });
      onSaved?.(updated);
      onClose();
    } catch (err) {
      if (err instanceof DatasetVersionConflictError) {
        setSaveError(
          '다른 사용자 또는 탭에서 데이터가 변경되었습니다. 최신 정보를 다시 불러온 뒤 수정해 주세요.',
        );
      } else {
        setSaveError(
          err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const validation = validateForm(form);
  const canSave = dirty && Object.keys(validation).length === 0 && !saving;
  const ageTenurePreview = `${previewAge ?? '-'}세 · ${formatTenureLabel(
    previewTenure?.years ?? null,
    previewTenure?.monthsRemainder ?? null,
  )}`;
  const statusTone =
    form.employmentStatus === '근무중'
      ? 'ok'
      : form.employmentStatus === '휴직'
        ? 'warn'
        : 'neutral';

  return (
    <>
      <div
        className="edit-modal-backdrop"
        role="presentation"
        onClick={requestClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-edit-title"
          className="edit-modal card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="edit-modal-header">
            <div className="edit-modal-title-row">
              <span className="edit-modal-icon" aria-hidden>
                <PencilLine size={18} />
              </span>
              <div className="min-w-0">
                <h2 id="employee-edit-title" className="edit-modal-title">
                  인원정보 수정
                </h2>
                <p className="edit-modal-sub">
                  {employee.name}
                  <span className="edit-modal-sub-sep" aria-hidden>
                    ·
                  </span>
                  {employee.employeeNo}
                  {dataset ? (
                    <>
                      <span className="edit-modal-sub-sep" aria-hidden>
                        ·
                      </span>
                      <span className="edit-modal-version">
                        버전 {dataset.versionId.slice(0, 8)}…
                      </span>
                    </>
                  ) : null}
                </p>
                <div className="edit-modal-chips" aria-label="현재 값 요약">
                  <span className="edit-modal-chip">{employee.workplace || '-'}</span>
                  <span className="edit-modal-chip">{employee.process || '-'}</span>
                  <span
                    className="edit-modal-chip"
                    data-tone={statusTone}
                  >
                    {form.employmentStatus || '-'}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="edit-modal-close"
              aria-label="닫기"
              onClick={requestClose}
            >
              <X size={18} />
            </button>
          </div>

          <div className="edit-modal-body">
            <p className="edit-modal-hint">
              웹 수정 내용은 다음 Excel 반영 시 새 파일의 값으로 교체될 수 있습니다.
            </p>

            <section className="edit-modal-section">
              <div className="edit-modal-section-head">
                <h3 className="edit-modal-section-title">식별 · 미리보기</h3>
                <span className="edit-modal-section-tag">읽기 전용</span>
              </div>
              <div className="edit-modal-grid">
                <ReadOnlyField label="사번" value={employee.employeeNo} />
                <ReadOnlyField
                  label="원본 NO"
                  value={employee.sourceNo?.toString() ?? '-'}
                />
                <ReadOnlyField label="내부 ID" value={employee.id} />
                <ReadOnlyField
                  label="만 나이 / 근속"
                  value={ageTenurePreview}
                  emphasize
                />
              </div>
            </section>

            <section className="edit-modal-section">
              <div className="edit-modal-section-head">
                <h3 className="edit-modal-section-title">기본 정보</h3>
              </div>
              <div className="edit-modal-grid">
                <TextField
                  id="edit-name"
                  label="성명"
                  value={form.name}
                  error={errors.name}
                  onChange={(v) => setField('name', v)}
                />
                <SelectField
                  id="edit-gender"
                  label="성별"
                  value={form.gender}
                  options={['남자', '여자'] as GenderCode[]}
                  onChange={(v) => setField('gender', v as GenderCode)}
                />
              </div>
            </section>

            <section className="edit-modal-section">
              <div className="edit-modal-section-head">
                <h3 className="edit-modal-section-title">근무 정보</h3>
              </div>
              <div className="edit-modal-grid">
                <SelectField
                  id="edit-workplace"
                  label="근무지"
                  value={form.workplace}
                  options={WORKPLACE_OPTIONS}
                  error={errors.workplace}
                  onChange={(v) => setField('workplace', v)}
                />
                <SelectField
                  id="edit-employmentStatus"
                  label="근무현황"
                  value={form.employmentStatus}
                  options={EMPLOYMENT_STATUS_OPTIONS}
                  error={errors.employmentStatus}
                  onChange={(v) => setField('employmentStatus', v)}
                />
                <SelectField
                  id="edit-position"
                  label="직급"
                  value={form.position}
                  options={POSITION_OPTIONS}
                  error={errors.position}
                  onChange={(v) => setField('position', v)}
                />
                <SelectField
                  id="edit-process"
                  label="공정"
                  value={form.process}
                  options={PROCESS_OPTIONS}
                  error={errors.process}
                  onChange={(v) => setField('process', v)}
                />
              </div>
            </section>

            <section className="edit-modal-section">
              <div className="edit-modal-section-head">
                <h3 className="edit-modal-section-title">구분</h3>
              </div>
              <div className="edit-modal-grid">
                <TextField
                  id="edit-category"
                  label="구분"
                  value={form.category}
                  onChange={(v) => setField('category', v)}
                />
                <TextField
                  id="edit-category1"
                  label="구분1"
                  value={form.category1}
                  onChange={(v) => setField('category1', v)}
                />
                <TextField
                  id="edit-department"
                  label="부서"
                  value={form.department}
                  onChange={(v) => setField('department', v)}
                />
                <TextField
                  id="edit-category3"
                  label="구분3"
                  value={form.category3}
                  onChange={(v) => setField('category3', v)}
                />
                <TextField
                  id="edit-category4"
                  label="구분4"
                  value={form.category4}
                  onChange={(v) => setField('category4', v)}
                />
              </div>
            </section>

            <section className="edit-modal-section">
              <div className="edit-modal-section-head">
                <h3 className="edit-modal-section-title">일정</h3>
              </div>
              <div className="edit-modal-grid">
                <TextField
                  id="edit-birthDate"
                  label="생년월일"
                  type="date"
                  value={form.birthDate}
                  error={errors.birthDate}
                  onChange={(v) => setField('birthDate', v)}
                />
                <TextField
                  id="edit-joinDate"
                  label="입사일"
                  type="date"
                  value={form.joinDate}
                  error={errors.joinDate}
                  onChange={(v) => setField('joinDate', v)}
                />
                <TextField
                  id="edit-resignDate"
                  label="퇴사일"
                  type="date"
                  value={form.resignDate}
                  error={errors.resignDate}
                  onChange={(v) => setField('resignDate', v)}
                />
              </div>
            </section>

            {saveError ? (
              <p className="edit-modal-error" role="alert">
                {saveError}{' '}
                {saveError.includes('변경되었습니다') ? (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => void reload()}
                  >
                    최신 정보 다시 불러오기
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="edit-modal-footer">
            <p className="edit-modal-footer-note">
              {dirty ? '변경 사항이 있습니다.' : '변경된 내용이 없습니다.'}
            </p>
            <div className="edit-modal-actions">
              <button
                type="button"
                className="btn"
                onClick={requestClose}
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSave}
                onClick={() => void onSave()}
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="수정을 취소하시겠습니까?"
        description="입력한 변경 내용은 저장되지 않습니다."
        confirmLabel="취소하기"
        tone="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

function ReadOnlyField({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`edit-modal-field is-readonly ${emphasize ? 'is-emphasize' : ''}`.trim()}
    >
      <span className="edit-modal-label">{label}</span>
      <div className="edit-modal-readonly" title={value}>
        {value}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label
      className={`edit-modal-field ${error ? 'has-error' : ''}`.trim()}
      htmlFor={id}
    >
      <span className="edit-modal-label">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <span className="edit-modal-field-error">{error}</span> : null}
    </label>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly T[];
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <label
      className={`edit-modal-field ${error ? 'has-error' : ''}`.trim()}
      htmlFor={id}
    >
      <span className="edit-modal-label">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? <span className="edit-modal-field-error">{error}</span> : null}
    </label>
  );
}
