import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found-page flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-muted max-w-md text-sm font-medium">
        요청하신 주소가 없거나 이동되었습니다. 인원현황 홈으로 돌아가 주세요.
      </p>
      <Link href="/" className="rounded-full border px-5 py-2 text-sm font-semibold">
        인원현황 홈
      </Link>
    </div>
  );
}
