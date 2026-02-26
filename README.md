# korea-vc-funds

## Neon 시딩

아래 스크립트는 `data/funds.json`을 기반으로 다음을 수행합니다.

1. 필드 구조 분석
2. `vc_funds` 컬럼 매핑 + 누락 컬럼 `ALTER TABLE`
3. 전체 `INSERT ... ON CONFLICT (asct_id) DO NOTHING`
4. `SELECT COUNT(*)` 실행 SQL 생성

```bash
python scripts/seed_neon_funds.py
```

실제 DB에 반영하려면 아래 조건이 필요합니다.

- `POSTGRES_URL` 환경변수 설정
- `psql` 클라이언트 설치
