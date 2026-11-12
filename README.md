# 🗓️ 우리 캘린더

친구·가족·연인과 함께 쓰는 **공유 캘린더**이자, 혼자 쓰는 개인 캘린더.

- 월간 달력에서 일정 추가 / 수정 / 삭제 (종일, 여러 날 일정 지원)
- 캘린더를 여러 개 만들고 색상으로 구분, 체크박스로 보이기/숨기기
- **초대 코드**로 캘린더 공유 · 멤버 권한(주인 / 편집 가능 / 보기만)
- 다른 사람이 일정을 바꾸면 **실시간 반영** (Supabase Realtime)
- 모바일 화면 대응, 다크 모드

기술 스택: React + TypeScript + Vite, Supabase (Postgres · Auth · Realtime), date-fns

## 바로 실행해 보기 (로컬 모드)

```bash
npm install
npm run dev
```

Supabase 설정이 없으면 **로컬 모드**로 동작합니다. 일정은 이 브라우저에만 저장되고, 로그인·공유 기능은 꺼져 있습니다.

## Supabase 연결하기 (공유 기능 켜기)

1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성
2. 대시보드 **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 실행
3. `.env.example` 을 `.env.local` 로 복사하고 URL과 publishable(anon) 키 입력
4. `npm run dev` 재시작 → 회원가입하면 '내 캘린더'가 자동으로 생겨요

> 개발 중 가입 확인 메일이 번거로우면 Authentication → Sign In / Providers → Email 에서
> "Confirm email" 을 끄면 됩니다.

## 데이터 구조

| 테이블 | 설명 |
|---|---|
| `profiles` | 사용자 이름 (가입 시 자동 생성) |
| `calendars` | 캘린더 (개인용은 `is_personal`, 공유용은 `invite_code`) |
| `calendar_members` | 누가 어떤 캘린더에 어떤 권한(owner/editor/viewer)으로 있는지 |
| `events` | 일정 |

모든 권한은 Postgres RLS(Row Level Security)로 서버에서 강제됩니다.

## 앞으로 할 일

- [ ] PWA (홈 화면에 설치)
- [ ] 주간 / 일간 보기
- [ ] 반복 일정, 알림
- [ ] 위젯 — Android: Capacitor + 네이티브 위젯 / iPhone: `.ics` 구독 링크 + 기본 캘린더 위젯
