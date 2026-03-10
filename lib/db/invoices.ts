import { sql } from '@vercel/postgres'

export async function getInvoices(limit = 50) {
  const { rows } = await sql`
    SELECT * FROM invoices
    ORDER BY date_facture DESC
    LIMIT ${limit}
  `
  return rows
}

export async function getInvoicesByMonth(year: number, month: number) {
  const { rows } = await sql`
    SELECT * FROM invoices
    WHERE EXTRACT(YEAR FROM date_facture) = ${year}
      AND EXTRACT(MONTH FROM date_facture) = ${month}
    ORDER BY date_facture ASC
  `
  return rows
}

export async function getMonthlyExpenses() {
  const { rows } = await sql`
    SELECT * FROM monthly_expenses LIMIT 12
  `
  return rows
}

export async function insertInvoice(inv: {
  gmail_id?: string
  drive_file_id?: string
  drive_url?: string
  filename?: string
  fournisseur?: string
  date_facture?: string
  montant_ht?: number
  montant_ttc?: number
  tva?: number
  categorie?: string
  description?: string
  extraction_ok?: boolean
}) {
  const { rows } = await sql`
    INSERT INTO invoices (
      gmail_id, drive_file_id, drive_url, filename,
      fournisseur, date_facture, montant_ht, montant_ttc,
      tva, categorie, description, extraction_ok
    ) VALUES (
      ${inv.gmail_id || null},
      ${inv.drive_file_id || null},
      ${inv.drive_url || null},
      ${inv.filename || null},
      ${inv.fournisseur || null},
      ${inv.date_facture || null},
      ${inv.montant_ht || null},
      ${inv.montant_ttc || null},
      ${inv.tva || null},
      ${inv.categorie || 'autres'},
      ${inv.description || null},
      ${inv.extraction_ok !== false}
    )
    ON CONFLICT (gmail_id) DO NOTHING
    RETURNING id
  `
  return rows[0]
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`
}
