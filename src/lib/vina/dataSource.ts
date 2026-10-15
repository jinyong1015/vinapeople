/** 클라이언트·서버 공용 데이터 소스 판별 */
export function isSupabaseDataSource(): boolean {
  return process.env.NEXT_PUBLIC_VINA_DATA_SOURCE === 'supabase';
}
