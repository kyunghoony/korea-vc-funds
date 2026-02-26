#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
from pathlib import Path

FUNDS_PATH = Path('data/funds.json')


def sql_value(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        escaped = [str(x).replace('"', '\\"') for x in v]
        return "ARRAY[" + ",".join("'" + x.replace("'", "''") + "'" for x in escaped) + "]"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def main():
    funds = json.loads(FUNDS_PATH.read_text(encoding='utf-8'))

    print('[1] funds.json 필드 구조 분석')
    print(f'- 총 건수: {len(funds)}')
    print(f"- 필드: {', '.join(funds[0].keys())}")

    ddl = """
CREATE TABLE IF NOT EXISTS vc_funds (
  id SERIAL PRIMARY KEY,
  asct_id TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  fund_name TEXT NOT NULL,
  registered_date DATE,
  maturity_date DATE,
  settlement_month TEXT,
  fund_manager TEXT,
  fund_manager_name TEXT,
  support_type TEXT,
  account_type TEXT,
  purpose_type TEXT,
  sector_type TEXT,
  hurdle_rate NUMERIC(5,2),
  total_amount BIGINT,
  amount_억 INTEGER,
  sector_tags TEXT[] DEFAULT '{}',
  all_tags TEXT[] DEFAULT '{}',
  is_govt_matched BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  lifecycle TEXT,
  has_sector BOOLEAN DEFAULT FALSE,
  tag_source TEXT DEFAULT 'auto',
  tag_confidence NUMERIC(3,2) DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vc_funds ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE vc_funds ADD COLUMN IF NOT EXISTS registered_date DATE;
ALTER TABLE vc_funds ADD COLUMN IF NOT EXISTS maturity_date DATE;
ALTER TABLE vc_funds ADD COLUMN IF NOT EXISTS all_tags TEXT[] DEFAULT '{}';
ALTER TABLE vc_funds ADD COLUMN IF NOT EXISTS fund_manager_name TEXT;
""".strip()

    print('\n[2] DB 테이블 컬럼 매핑')
    print('- company -> company_name')
    print('- registered -> registered_date')
    print('- maturity -> maturity_date')
    print('- tags -> all_tags')

    values_sql = []
    for f in funds:
      manager_name = (f.get('fund_manager') or '').split('(')[0].strip() or None
      values_sql.append('(' + ', '.join([
          sql_value(f.get('asct_id')),
          sql_value(f.get('company')),
          sql_value(f.get('fund_name')),
          sql_value(f.get('registered')),
          sql_value(f.get('maturity')),
          sql_value(f.get('settlement_month')),
          sql_value(f.get('fund_manager')),
          sql_value(manager_name),
          sql_value(f.get('support_type')),
          sql_value(f.get('account_type')),
          sql_value(f.get('purpose_type')),
          sql_value(f.get('sector_type')),
          sql_value(None if f.get('hurdle_rate') in ('', '-') else f.get('hurdle_rate')),
          sql_value(f.get('total_amount')),
          sql_value(f.get('amount_억')),
          sql_value(f.get('sector_tags') or []),
          sql_value(f.get('tags') or []),
          sql_value(f.get('is_govt_matched')),
          sql_value(f.get('is_active')),
          sql_value(f.get('lifecycle')),
          sql_value(f.get('has_sector')),
      ]) + ')')

    insert = """
INSERT INTO vc_funds (
  asct_id, company_name, fund_name, registered_date, maturity_date, settlement_month,
  fund_manager, fund_manager_name, support_type, account_type, purpose_type, sector_type,
  hurdle_rate, total_amount, amount_억, sector_tags, all_tags,
  is_govt_matched, is_active, lifecycle, has_sector
)
VALUES
""".strip() + '\n' + ',\n'.join(values_sql) + '\nON CONFLICT (asct_id) DO NOTHING;'

    count_sql = 'SELECT COUNT(*) FROM vc_funds;'

    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as fp:
        fp.write(ddl + '\n\n' + insert + '\n\n' + count_sql + '\n')
        sql_file = fp.name

    print('\n[3] 전체 INSERT (ON CONFLICT DO NOTHING) SQL 생성 완료')
    print(f'- SQL 파일: {sql_file}')

    postgres_url = os.getenv('POSTGRES_URL')
    if not postgres_url:
        print('\n[중단] POSTGRES_URL 미설정으로 실제 DB 실행은 생략되었습니다.')
        return

    psql = subprocess.run(['which', 'psql'], capture_output=True, text=True)
    if psql.returncode != 0:
        print('\n[중단] psql 미설치로 실제 DB 실행은 생략되었습니다.')
        return

    print('\n[실행] psql로 DDL/INSERT/COUNT 실행')
    subprocess.run(['psql', postgres_url, '-f', sql_file], check=True)

    print('\n[5] GET /api/funds 호출')
    print('- 로컬 서버 실행 후 아래 명령으로 확인하세요:')
    print('  curl "http://localhost:5173/api/funds?limit=3"')


if __name__ == '__main__':
    main()
