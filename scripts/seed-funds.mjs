import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  console.error('POSTGRES_URL 환경변수가 필요합니다.');
  process.exit(1);
}

const sql = neon(postgresUrl);
const raw = await readFile(new URL('../data/funds.json', import.meta.url), 'utf-8');
const funds = JSON.parse(raw);

function managerName(v) {
  return (v || '').split('(')[0].trim() || null;
}

for (const fund of funds) {
  await sql`
    INSERT INTO vc_funds (
      asct_id, company_name, fund_name, registered_date, maturity_date, settlement_month,
      fund_manager, fund_manager_name, support_type, account_type, purpose_type, sector_type,
      hurdle_rate, total_amount, amount_억, sector_tags, all_tags,
      is_govt_matched, is_active, lifecycle, has_sector
    ) VALUES (
      ${fund.asct_id}, ${fund.company}, ${fund.fund_name}, ${fund.registered || null}, ${fund.maturity || null}, ${fund.settlement_month || null},
      ${fund.fund_manager || null}, ${managerName(fund.fund_manager)}, ${fund.support_type || null}, ${fund.account_type || null}, ${fund.purpose_type || null}, ${fund.sector_type || null},
      ${fund.hurdle_rate && fund.hurdle_rate !== '-' ? Number(fund.hurdle_rate) : null}, ${fund.total_amount || null}, ${fund['amount_억'] || null}, ${fund.sector_tags || []}, ${fund.tags || []},
      ${Boolean(fund.is_govt_matched)}, ${Boolean(fund.is_active)}, ${fund.lifecycle || null}, ${Boolean(fund.has_sector)}
    )
    ON CONFLICT (asct_id)
    DO UPDATE SET
      company_name = EXCLUDED.company_name,
      fund_name = EXCLUDED.fund_name,
      registered_date = EXCLUDED.registered_date,
      maturity_date = EXCLUDED.maturity_date,
      settlement_month = EXCLUDED.settlement_month,
      fund_manager = EXCLUDED.fund_manager,
      fund_manager_name = EXCLUDED.fund_manager_name,
      support_type = EXCLUDED.support_type,
      account_type = EXCLUDED.account_type,
      purpose_type = EXCLUDED.purpose_type,
      sector_type = EXCLUDED.sector_type,
      hurdle_rate = EXCLUDED.hurdle_rate,
      total_amount = EXCLUDED.total_amount,
      amount_억 = EXCLUDED.amount_억,
      sector_tags = EXCLUDED.sector_tags,
      all_tags = EXCLUDED.all_tags,
      is_govt_matched = EXCLUDED.is_govt_matched,
      is_active = EXCLUDED.is_active,
      lifecycle = EXCLUDED.lifecycle,
      has_sector = EXCLUDED.has_sector,
      updated_at = NOW();
  `;
}

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM vc_funds`;
console.log(`Seeding complete: ${funds.length} rows processed, vc_funds count=${count}`);
