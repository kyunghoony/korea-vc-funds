import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

type FundSeedRow = {
  asct_id: string;
  company: string;
  fund_name: string;
  registered: string | null;
  maturity: string | null;
  settlement_month: string | null;
  fund_manager: string | null;
  support_type: string | null;
  account_type: string | null;
  purpose_type: string | null;
  sector_type: string | null;
  hurdle_rate: string | number | null;
  total_amount: number | null;
  amount_억: number | null;
  tags: string[];
  sector_tags: string[];
  is_govt_matched: boolean;
  is_active: boolean;
  lifecycle: string | null;
  has_sector: boolean;
};

type NeonSQL = ((strings: TemplateStringsArray, ...values: any[]) => Promise<Record<string, any>[]>) &
  ((query: string, params?: any[]) => Promise<Record<string, any>[]>);

const BATCH_SIZE = 100;

const fundsDataPath =
  typeof __dirname !== "undefined"
    ? join(__dirname, "..", "data", "funds.json")
    : join(process.cwd(), "data", "funds.json");

const fundsData = JSON.parse(readFileSync(fundsDataPath, "utf-8")) as FundSeedRow[];

const REQUIRED_COLUMNS: Array<{ name: string; type: string }> = [
  { name: "asct_id", type: "TEXT" },
  { name: "company", type: "TEXT" },
  { name: "fund_name", type: "TEXT" },
  { name: "registered", type: "DATE" },
  { name: "maturity", type: "DATE" },
  { name: "settlement_month", type: "TEXT" },
  { name: "fund_manager", type: "TEXT" },
  { name: "support_type", type: "TEXT" },
  { name: "account_type", type: "TEXT" },
  { name: "purpose_type", type: "TEXT" },
  { name: "sector_type", type: "TEXT" },
  { name: "hurdle_rate", type: "NUMERIC(5,2)" },
  { name: "total_amount", type: "BIGINT" },
  { name: "amount_억", type: "INTEGER" },
  { name: "tags", type: "TEXT[]" },
  { name: "sector_tags", type: "TEXT[]" },
  { name: "is_govt_matched", type: "BOOLEAN DEFAULT FALSE" },
  { name: "is_active", type: "BOOLEAN DEFAULT FALSE" },
  { name: "lifecycle", type: "TEXT" },
  { name: "has_sector", type: "BOOLEAN DEFAULT FALSE" },
];

function getSQL(): NeonSQL {
  return neon(process.env.POSTGRES_URL!) as unknown as NeonSQL;
}

async function ensureSeedColumns(sql: NeonSQL) {
  const existing = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vc_funds'
  `;

  const existingColumns = new Set(existing.map((row) => row.column_name as string));

  for (const column of REQUIRED_COLUMNS) {
    if (!existingColumns.has(column.name)) {
      await sql(`ALTER TABLE vc_funds ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}`);
    }
  }

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vc_funds_asct_id_unique'
      ) THEN
        ALTER TABLE vc_funds
        ADD CONSTRAINT vc_funds_asct_id_unique UNIQUE (asct_id);
      END IF;
    END
    $$;
  `;
}

function normalizeRow(row: FundSeedRow) {
  return {
    asct_id: row.asct_id,
    company: row.company,
    fund_name: row.fund_name,
    registered: row.registered || null,
    maturity: row.maturity || null,
    settlement_month: row.settlement_month || null,
    fund_manager: row.fund_manager || null,
    support_type: row.support_type || null,
    account_type: row.account_type || null,
    purpose_type: row.purpose_type || null,
    sector_type: row.sector_type || null,
    hurdle_rate: row.hurdle_rate === "" || row.hurdle_rate == null ? null : Number(row.hurdle_rate),
    total_amount: row.total_amount ?? null,
    amount_억: row.amount_억 ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sector_tags: Array.isArray(row.sector_tags) ? row.sector_tags : [],
    is_govt_matched: Boolean(row.is_govt_matched),
    is_active: Boolean(row.is_active),
    lifecycle: row.lifecycle || null,
    has_sector: Boolean(row.has_sector),
  };
}

async function insertBatch(sql: NeonSQL, rows: FundSeedRow[]) {
  if (rows.length === 0) return 0;

  const columns = [
    "asct_id",
    "company",
    "fund_name",
    "registered",
    "maturity",
    "settlement_month",
    "fund_manager",
    "support_type",
    "account_type",
    "purpose_type",
    "sector_type",
    "hurdle_rate",
    "total_amount",
    "amount_억",
    "tags",
    "sector_tags",
    "is_govt_matched",
    "is_active",
    "lifecycle",
    "has_sector",
  ];

  const params: any[] = [];
  const valueTuples = rows.map((rawRow, rowIndex) => {
    const row = normalizeRow(rawRow);
    const rowValues = columns.map((column) => (row as any)[column]);
    params.push(...rowValues);

    const offset = rowIndex * columns.length;
    const placeholders = columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`);
    return `(${placeholders.join(", ")})`;
  });

  const query = `
    INSERT INTO vc_funds (${columns.map((column) => `"${column}"`).join(", ")})
    VALUES ${valueTuples.join(", ")}
    ON CONFLICT (asct_id) DO NOTHING
    RETURNING asct_id
  `;

  const insertedRows = await sql(query, params);
  return insertedRows.length;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: "POSTGRES_URL is not configured" });
  }

  try {
    const sql = getSQL();
    const rows = fundsData;

    await ensureSeedColumns(sql);

    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      inserted += await insertBatch(sql, batch);
    }

    return res.status(200).json({ inserted, total: rows.length });
  } catch (error) {
    console.error("[seed] Error:", error);
    return res.status(500).json({ error: "Failed to seed funds" });
  }
}
