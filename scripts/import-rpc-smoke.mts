/**
 * Supabase RPC 스모크 (service_role 필요)
 *
 * 7) apply 중 강제 실패 → employees/history 부분 반영 없음
 * 8) rollback 시 이후 수동 변경 필드 보존
 * (+ apply 성공, history, 재적용 거부)
 *
 * SUPABASE_SERVICE_ROLE_KEY 가 없으면 skip 종료(0).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.log(
    'SKIP import-rpc-smoke: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요',
  );
  process.exit(0);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', '-', name, '-', detail);
}

const stamp = Date.now();
const smokeNo = `SMOKE-${stamp}`;
const smokeFailA = `SMOKE-FAIL-A-${stamp}`;
const smokeFailB = `SMOKE-FAIL-B-${stamp}`;

function empPayload(employeeNo: string, process = '성형') {
  return {
    employee_no: employeeNo,
    name: 'Smoke User',
    workplace: '1공장',
    employment_status: '근무중',
    category: '',
    category1: '',
    position: '사원',
    process,
    department: '',
    category3: '',
    category4: '',
    gender_source: 'Nam',
    gender_label_source: '남자',
    gender: '남자',
    birth_date: '1990-01-01',
    join_date: '2020-01-01',
    resign_date: null,
  };
}

async function cleanup() {
  await supabase
    .from('vina_employees')
    .delete()
    .in('employee_no', [smokeNo, smokeFailA, smokeFailB]);
  await supabase
    .from('vina_employee_uploads')
    .delete()
    .like('file_name', `rpc-smoke-%${stamp}%`);
}

try {
  await cleanup();

  // --- 7) forced failure mid-apply: no partial writes ---
  {
    const { data: failUpload, error: failUpErr } = await supabase
      .from('vina_employee_uploads')
      .insert({
        file_name: `rpc-smoke-fail-${stamp}.xlsx`,
        as_of_date: '2026-10-15',
        uploaded_by: 'smoke',
        status: 'draft',
        total_count: 2,
        new_count: 2,
        payload: {},
      })
      .select('id')
      .single();
    if (failUpErr || !failUpload) {
      throw new Error(failUpErr?.message || 'fail upload insert failed');
    }

    const { error: failApplyErr } = await supabase.rpc(
      'vina_apply_employee_upload',
      {
        p_upload_id: failUpload.id,
        p_payload: {
          asOfDate: '2026-10-15',
          uploadedBy: 'smoke',
          inserts: [
            empPayload(smokeFailA),
            // employee_no 누락 → RPC 예외 → 전체 롤백
            { ...empPayload(smokeFailB), employee_no: '' },
          ],
          updates: [],
          newCount: 2,
          changedCount: 0,
          unchangedCount: 0,
          errorCount: 0,
          missingCount: 0,
          totalCount: 2,
        },
      },
    );
    check('apply failure raises', Boolean(failApplyErr), failApplyErr?.message ?? 'no error');

    const { count: failCount } = await supabase
      .from('vina_employees')
      .select('*', { count: 'exact', head: true })
      .in('employee_no', [smokeFailA, smokeFailB]);
    check(
      'apply failure → no partial employees',
      (failCount ?? 0) === 0,
      `count=${failCount}`,
    );

    const { data: failStatus } = await supabase
      .from('vina_employee_uploads')
      .select('status')
      .eq('id', failUpload.id)
      .single();
    check(
      'failed apply leaves draft (tx rolled back)',
      failStatus?.status === 'draft',
      `status=${failStatus?.status}`,
    );
  }

  // --- happy path apply + history ---
  const { data: upload, error: upErr } = await supabase
    .from('vina_employee_uploads')
    .insert({
      file_name: `rpc-smoke-ok-${stamp}.xlsx`,
      as_of_date: '2026-10-15',
      uploaded_by: 'smoke',
      status: 'draft',
      total_count: 1,
      new_count: 1,
      payload: {},
    })
    .select('id')
    .single();
  if (upErr || !upload) throw new Error(upErr?.message || 'upload insert failed');

  const applyPayload = {
    asOfDate: '2026-10-15',
    uploadedBy: 'smoke',
    inserts: [empPayload(smokeNo)],
    updates: [],
    newCount: 1,
    changedCount: 0,
    unchangedCount: 0,
    errorCount: 0,
    missingCount: 0,
    totalCount: 1,
  };

  const { error: applyErr } = await supabase.rpc('vina_apply_employee_upload', {
    p_upload_id: upload.id,
    p_payload: applyPayload,
  });
  check('apply insert ok', !applyErr, applyErr?.message ?? 'ok');

  const { count } = await supabase
    .from('vina_employees')
    .select('*', { count: 'exact', head: true })
    .eq('employee_no', smokeNo);
  check('employee exists', (count ?? 0) === 1, `count=${count}`);

  const { data: emp } = await supabase
    .from('vina_employees')
    .select('id, process')
    .eq('employee_no', smokeNo)
    .single();

  const { data: hist } = await supabase
    .from('vina_employee_history')
    .select('field_name')
    .eq('employee_id', emp!.id)
    .eq('upload_id', upload.id);
  check(
    'history _created',
    (hist ?? []).some((h) => h.field_name === '_created'),
    `rows=${hist?.length ?? 0}`,
  );

  const { error: reapplyErr } = await supabase.rpc('vina_apply_employee_upload', {
    p_upload_id: upload.id,
    p_payload: applyPayload,
  });
  check('re-apply blocked', Boolean(reapplyErr), reapplyErr?.message ?? 'no error');

  // --- 8) manual change then rollback preserves later field ---
  await supabase
    .from('vina_employees')
    .update({ process: '검사', updated_by: 'manual-smoke' })
    .eq('id', emp!.id);
  await supabase.from('vina_employee_history').insert({
    employee_id: emp!.id,
    employee_no: smokeNo,
    field_name: 'process',
    old_value: '성형',
    new_value: '검사',
    change_source: 'manual',
    changed_by: 'manual-smoke',
  });

  const { data: rb, error: rbErr } = await supabase.rpc(
    'vina_rollback_employee_upload',
    { p_upload_id: upload.id, p_actor: 'smoke' },
  );
  check('rollback rpc ok', !rbErr, rbErr?.message ?? JSON.stringify(rb));

  const { data: after } = await supabase
    .from('vina_employees')
    .select('process')
    .eq('employee_no', smokeNo)
    .maybeSingle();

  if (after) {
    check(
      'manual process preserved after rollback',
      after.process === '검사',
      `process=${after.process}`,
    );
  } else {
    check(
      'manual process preserved after rollback',
      false,
      'employee deleted unexpectedly',
    );
  }

  await cleanup();
} catch (err) {
  check('rpc smoke run', false, err instanceof Error ? err.message : String(err));
  await cleanup().catch(() => undefined);
}

const failed = results.filter((r) => !r.ok);
console.log('\n---');
console.log(`import-rpc-smoke: ${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
