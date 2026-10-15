import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_URL');
}

/** 브라우저·서버 공용 anon 클라이언트 (읽기 전용 경로용) */
export function createAnonClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Route Handler 전용 service_role (쓰기·RPC) */
export function createServiceClient(): SupabaseClient {
  return createClient(
    getSupabaseUrl(),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export { isSupabaseDataSource } from '../dataSource';
