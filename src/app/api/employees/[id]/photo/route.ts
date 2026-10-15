import { requireAdmin } from '@/lib/vina/auth';
import {
  buildPhotoStoragePath,
  PHOTO_BUCKET,
  storagePathFromStored,
  validatePhotoFile,
} from '@/lib/vina/photos';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { rowToPersonnel, type VinaEmployeeRow } from '@/lib/vina/supabase/mappers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

const EMPLOYEE_SELECT = `
  id, employee_no, source_no, name, workplace, employment_status,
  category, category1, position, process, department, category3, category4,
  gender_source, gender_label_source, gender,
  birth_date, join_date, resign_date,
  age_years, tenure_years, tenure_months_remainder, tenure_total_months, tenure_total_days,
  source_tenure_years, source_tenure_months, source_tenure_days,
  photo_path, as_of_date, updated_at, updated_by, last_upload_id
`;

async function loadEmployee(id: string) {
  const client = createServiceClient();
  const { data, error } = await client
    .from('vina_employees')
    .select(EMPLOYEE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as VinaEmployeeRow | null;
}

async function insertPhotoHistory(input: {
  employeeId: string;
  employeeNo: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}) {
  const client = createServiceClient();
  const { error } = await client.from('vina_employee_history').insert({
    employee_id: input.employeeId,
    employee_no: input.employeeNo,
    field_name: 'photo_path',
    old_value: input.oldValue,
    new_value: input.newValue,
    changed_at: input.changedAt,
    change_source: 'manual',
    changed_by: 'admin',
  });
  if (error) {
    console.warn('[photo] history insert failed:', error.message);
  }
}

/** 사진 등록·변경 확정 → Storage 저장 + DB photo_path 갱신 (관리자) */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스에서만 사진을 관리할 수 있습니다.' },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  try {
    const employee = await loadEmployee(id);
    if (!employee) {
      return NextResponse.json({ message: '인원을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!employee.employee_no?.trim()) {
      return NextResponse.json(
        { message: '사번이 없는 직원에는 사진을 등록할 수 없습니다.' },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: '사진 파일이 필요합니다.' },
        { status: 400 },
      );
    }

    const validated = validatePhotoFile({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (!validated.ok) {
      return NextResponse.json({ message: validated.message }, { status: 400 });
    }

    const storagePath = buildPhotoStoragePath(
      employee.employee_no,
      validated.mime,
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    const client = createServiceClient();

    const { error: uploadError } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, buffer, {
        contentType: validated.mime,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      return NextResponse.json(
        { message: `사진 업로드에 실패했습니다: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const previousPath = storagePathFromStored(employee.photo_path);
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await client
      .from('vina_employees')
      .update({
        photo_path: storagePath,
        updated_at: now,
        updated_by: 'admin',
      })
      .eq('id', id)
      .select(EMPLOYEE_SELECT)
      .maybeSingle();

    if (updateError || !updated) {
      await client.storage.from(PHOTO_BUCKET).remove([storagePath]);
      return NextResponse.json(
        {
          message: `사진 정보 저장에 실패했습니다: ${
            updateError?.message ?? '대상 인원을 갱신하지 못했습니다.'
          }`,
        },
        { status: 500 },
      );
    }

    await insertPhotoHistory({
      employeeId: id,
      employeeNo: employee.employee_no,
      oldValue: previousPath,
      newValue: storagePath,
      changedAt: now,
    });

    if (previousPath && previousPath !== storagePath) {
      const { error: removeError } = await client.storage
        .from(PHOTO_BUCKET)
        .remove([previousPath]);
      if (removeError) {
        console.warn(
          '[photo] orphan cleanup failed:',
          previousPath,
          removeError.message,
        );
      }
    }

    return NextResponse.json({
      employee: rowToPersonnel(updated as VinaEmployeeRow),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '사진 업로드에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/** 사진 삭제 확정 → DB photo_path 제거 + Storage 삭제 (관리자) */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스에서만 사진을 관리할 수 있습니다.' },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  try {
    const employee = await loadEmployee(id);
    if (!employee) {
      return NextResponse.json({ message: '인원을 찾을 수 없습니다.' }, { status: 404 });
    }

    const previousPath = storagePathFromStored(employee.photo_path);
    if (!previousPath && !employee.photo_path) {
      return NextResponse.json(
        { message: '삭제할 사진이 없습니다.' },
        { status: 400 },
      );
    }

    const client = createServiceClient();
    const now = new Date().toISOString();

    // DB를 먼저 비워 목록·상세가 즉시 미등록 상태가 되게 함
    const { data: updated, error: updateError } = await client
      .from('vina_employees')
      .update({
        photo_path: null,
        updated_at: now,
        updated_by: 'admin',
      })
      .eq('id', id)
      .select(EMPLOYEE_SELECT)
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json(
        {
          message: `사진 연결 정보 삭제에 실패했습니다: ${
            updateError?.message ?? '대상 인원을 갱신하지 못했습니다.'
          }`,
        },
        { status: 500 },
      );
    }

    if (previousPath) {
      const { error: removeError } = await client.storage
        .from(PHOTO_BUCKET)
        .remove([previousPath]);
      if (removeError) {
        console.warn(
          '[photo] storage delete after DB clear failed:',
          previousPath,
          removeError.message,
        );
      }
    }

    await insertPhotoHistory({
      employeeId: id,
      employeeNo: employee.employee_no,
      oldValue: previousPath,
      newValue: null,
      changedAt: now,
    });

    return NextResponse.json({
      employee: rowToPersonnel(updated as VinaEmployeeRow),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '사진 삭제에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
