import { sql } from '@vercel/postgres'

export async function getDailyRevenue(days = 30) {
  const { rows } = await sql`
    SELECT date, ca::float, nb_transactions::int, tips::float
    FROM daily_revenue
    WHERE date >= NOW() - INTERVAL '${days} days'
    ORDER BY date ASC
  `
  return rows
}

export async function getRevenueStats() {
  const { rows } = await sql`
    SELECT
      COUNT(*) AS nb_jours,
      SUM(amount)::float AS ca_total,
      AVG(amount)::float AS ca_moyen,
      MAX(amount)::float AS ca_max,
      COUNT(CASE WHEN amount >= 1750 THEN 1 END) AS jours_objectif
    FROM (
      SELECT date, SUM(amount) AS amount
      FROM transactions
      WHERE status = 'successful'
      GROUP BY date
    ) t
  `
  return rows[0]
}

export async function insertTransaction(tx: {
  sumup_id?: string
  date: string
  amount: number
  tip?: number
  payment_type?: string
  status?: string
  note?: string
  raw_data?: object
}) {
  const { rows } = await sql`
    INSERT INTO transactions (sumup_id, date, amount, tip, payment_type, status, note, raw_data)
    VALUES (
      ${tx.sumup_id || null},
      ${tx.date},
      ${tx.amount},
      ${tx.tip || 0},
      ${tx.payment_type || null},
      ${tx.status || 'successful'},
      ${tx.note || null},
      ${tx.raw_data ? JSON.stringify(tx.raw_data) : null}
    )
    ON CONFLICT (sumup_id) DO NOTHING
    RETURNING id
  `
  return rows[0]
}

export async function getTransactionsByMonth(year: number, month: number) {
  const { rows } = await sql`
    SELECT * FROM transactions
    WHERE EXTRACT(YEAR FROM date) = ${year}
      AND EXTRACT(MONTH FROM date) = ${month}
      AND status = 'successful'
    ORDER BY date ASC
  `
  return rows
}

export async function deleteTransaction(id: string) {
  await sql`DELETE FROM transactions WHERE id = ${id}`
}
