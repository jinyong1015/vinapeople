import type { ActiveDataset, Personnel } from '../types';
import { createServiceClient, createAnonClient } from './server';
import { rowToPersonnel, type VinaEmployeeRow } from './mappers';

const EMPLOYEE_SELECT = `
  id, employee_no, source_no, name, workplace, employment_status,
  category, category1, position, process, department, category3, category4,
  gender_source, gender_label_source, gender,
  birth_date, join_date, resign_date,
  age_years, tenure_years, tenure_months_remainder, tenure_total_months, tenure_total_days,
  source_tenure_years, source_tenure_months, source_tenure_days,
  photo_path, as_of_date, updated_at, updated_by, last_upload_id
`;

export async function fetchAllEmployeeRows(
  useService = false,
): Promise<VinaEmployeeRow[]> {
  const client = useService ? createServiceClient() : createAnonClient();
  const pageSize = 1000;
  let from = 0;
  const all: VinaEmployeeRow[] = [];

  for (;;) {
    const { data, error } = await client
      .from('vina_employees')
      .select(EMPLOYEE_SELECT)
      .order('employee_no', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`인원 조회 실패: ${error.message}`);
    const batch = (data ?? []) as VinaEmployeeRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export async function buildActiveDatasetFromSupabase(): Promise<ActiveDataset | null> {
  const rows = await fetchAllEmployeeRows(true);
  if (rows.length === 0) {
    const client = createServiceClient();
    const { data: latest } = await client
      .from('vina_employee_uploads')
      .select('id, file_name, as_of_date, uploaded_at, status')
      .eq('status', 'applied')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) return null;

    return {
      versionId: latest.id as string,
      asOfDate: String(latest.as_of_date).slice(0, 10),
      appliedAt: latest.uploaded_at as string,
      fileName: (latest.file_name as string) || 'supabase',
      personnel: [],
      meta: {
        sheetName: null,
        tableName: null,
        headerRow: null,
        dataStartRow: null,
        dataEndRow: null,
        documentDate: null,
        calcBaseDate: null,
        fileNameDateHint: null,
      },
      updatedAt: latest.uploaded_at as string,
    };
  }

  const personnel = rows.map(rowToPersonnel);
  const client = createServiceClient();
  const { data: latest } = await client
    .from('vina_employee_uploads')
    .select('id, file_name, as_of_date, uploaded_at')
    .eq('status', 'applied')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const asOfDate =
    (latest?.as_of_date
      ? String(latest.as_of_date).slice(0, 10)
      : null) ??
    rows.find((r) => r.as_of_date)?.as_of_date?.slice(0, 10) ??
    new Date().toISOString().slice(0, 10);

  const updatedAt = personnel.reduce(
    (max, p) => (p.updatedAt > max ? p.updatedAt : max),
    personnel[0]?.updatedAt ?? new Date().toISOString(),
  );

  return {
    versionId: (latest?.id as string) || `supabase-${asOfDate}`,
    asOfDate,
    appliedAt: (latest?.uploaded_at as string) || updatedAt,
    fileName: (latest?.file_name as string) || 'supabase',
    personnel,
    meta: {
      sheetName: null,
      tableName: null,
      headerRow: null,
      dataStartRow: null,
      dataEndRow: null,
      documentDate: null,
      calcBaseDate: asOfDate,
      fileNameDateHint: null,
    },
    updatedAt,
  };
}

export async function fetchEmployeeById(id: string): Promise<Personnel | null> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('vina_employees')
    .select(EMPLOYEE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`인원 조회 실패: ${error.message}`);
  if (!data) return null;
  return rowToPersonnel(data as VinaEmployeeRow);
}
