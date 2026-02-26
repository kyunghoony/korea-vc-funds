# Korea VC Funds

한국 벤처캐피탈 펀드 데이터베이스입니다. 2,400+ 펀드를 기반으로 검색, 필터링, VC/펀드 상세 조회, 딜 시그널 매칭 기능을 제공합니다.

## 주요 기능
- 한국 VC 펀드 2,400+ 데이터베이스 조회
- 멀티셀렉트 필터링 (투자 단계, 섹터, 지역, 규모)
- 실시간 검색
- 테이블/카드 뷰 토글
- 딜 시그널 기반 펀드 매칭
- VC 회사별 상세 정보 및 운용 펀드 조회

## 기술 스택
- React 18 + TypeScript + Vite
- Tailwind CSS (다크 테마 UI)
- Vercel Serverless Functions (`/api/*`)
- Neon Serverless Postgres (운영 데이터 소스)
- 내부 서비스 레이어 기반 도메인 로직 분리 (`services/funds/*`)

## 프로젝트 구조
```text
.
├── src/                    # 프론트엔드 (React)
│   ├── App.tsx
│   ├── index.tsx
│   └── styles.css
├── api/                    # Vercel Serverless API
│   ├── funds.ts
│   ├── fund-detail.ts
│   ├── fund-stats.ts
│   ├── fund-match.ts
│   ├── vcs.ts
│   ├── vc-detail.ts
│   └── vc-stats.ts
├── services/funds/         # 펀드/VC 조회 및 매칭 서비스 로직
├── data/                   # 샘플/로컬 데이터
└── sql/                    # DB 스키마
```

## 데이터
- 출처: 한국벤처캐피탈협회(KVCA) DIVA 시스템
- 규모: 2,400+ 벤치마크 펀드 레코드

## 로컬 실행
```bash
npm install
npm run dev
```

Vercel Functions까지 동일하게 로컬에서 확인하려면:
```bash
vercel dev
```

## 환경 변수
```bash
POSTGRES_URL=your_neon_postgres_url
```

## API
| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/funds` | GET | 펀드 목록/필터/정렬 조회 |
| `/api/fund-detail` | GET | 펀드 상세 조회 |
| `/api/fund-stats` | GET | 펀드 통계 |
| `/api/fund-match` | POST | 딜 시그널 기반 펀드 매칭 |
| `/api/vcs` | GET | VC 목록 |
| `/api/vc-detail` | GET | VC 상세 |
| `/api/vc-stats` | GET | VC 통계 |

## 라이선스
Private — Fast Ventures 내부 사용
