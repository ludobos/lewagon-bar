/**
 * Backfill transaction_items from SumUp receipts API
 * Run: SUMUP_API_KEY=xxx POSTGRES_URL=xxx node scripts/backfill-items.js
 */
const { neon } = require('@neondatabase/serverless');

const SUMUP_API = 'https://api.sumup.com';
const TOKEN = process.env.SUMUP_API_KEY || 'sup_sk_NVJPSfbvn84iSGQQwHpbog5noxDrPRCKk';
const DB_URL = process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_dnKD8ysQpT9k@ep-dry-night-agzqmz2i-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DB_URL);

const CATEGORIES = {
  'Expresso': 'Boissons chaudes', 'Café allongé': 'Boissons chaudes', 'Cafe Emporte': 'Boissons chaudes',
  'Café noisette': 'Boissons chaudes', 'Cappuccino': 'Boissons chaudes', 'Grand café': 'Boissons chaudes',
  'Grand crème': 'Boissons chaudes', 'Petit crème': 'Boissons chaudes', 'Déca': 'Boissons chaudes',
  'Déca allongé': 'Boissons chaudes', 'Déca grand': 'Boissons chaudes', 'Déca grand crème': 'Boissons chaudes',
  'Déca petit crème': 'Boissons chaudes', 'Chocolat petit': 'Boissons chaudes', 'Chocolat grand': 'Boissons chaudes',
  'Thé nature': 'Boissons chaudes', 'Thé parfumé': 'Boissons chaudes', 'Viennois': 'Boissons chaudes',
  'Vin chaud - grog': 'Boissons chaudes', 'Lait sirop': 'Boissons chaudes',
  'Veltins demi': 'Bières pressions', 'Veltins pinte': 'Bières pressions',
  'Nantaise IPA demi': 'Bières pressions', 'Nantaise IPA pinte': 'Bières pressions',
  'Nantaise ambrée demi': 'Bières pressions', 'Nantaise ambrée pinte': 'Bières pressions',
  'Picon bière demi': 'Bières pressions', 'Picon bière pinte': 'Bières pressions',
  'Monaco demi': 'Bières pressions', 'Monaco pinte': 'Bières pressions',
  'Bière sans alcool': 'Bières pressions', 'Despe': 'Bières pressions',
  'Galo Vetlins': 'Bières pressions', 'Galopin Nantaise': 'Bières pressions',
  'Panache': 'Bières pressions',
  'Muscadet': 'Vins', 'Bouteille Muscadet': 'Vins', 'Côte du Rhône': 'Vins',
  'Chenin': 'Vins', 'Btl Chenin': 'Vins', 'Colombelle': 'Vins',
  'Sauvignon': 'Vins', 'Rosé corse': 'Vins', 'Côte Marmandais': 'Vins',
  'Coca-cola': 'Sodas', 'Coca zéro': 'Sodas', 'Coca cherry': 'Sodas',
  'Orangina': 'Sodas', 'Perrier': 'Sodas', 'Fuze tea': 'Sodas',
  'Jus de fruit': 'Sodas', 'Jus tomates': 'Sodas', 'Limonade': 'Sodas',
  'Diabolo': 'Sodas', 'Diabolos': 'Sodas', "Sirop à l'eau": 'Sodas',
  'Orange pressée': 'Sodas', 'Citron pressé': 'Sodas', 'Schweppes': 'Sodas',
  'Ginger Beer': 'Sodas', 'Vittel': 'Sodas', 'Vittel sirop': 'Sodas',
  'Sirop enfant': 'Sodas', 'Sup Tranche/Sirop': 'Sodas',
  'Croque monsieur': 'Snack', 'Croque madame': 'Snack', 'Planche Mixte': 'Snack',
  'Petite Mixte': 'Snack', 'Assiette Charcuterie': 'Snack', 'Assiette Fromage': 'Snack',
  'Jambon Beurre': 'Snack', 'Sandwich': 'Snack', 'Sandwich Jambon / Fromage / Cornichons': 'Snack',
  'Sandwich Jambon fromage': 'Snack',
  'Ricard': 'Apéritifs', 'Kir': 'Apéritifs', 'Martini': 'Apéritifs',
  'Mojito': 'Cocktails', 'Spritz': 'Cocktails', 'Mule': 'Cocktails',
  'Planteur': 'Cocktails', 'Ti punch': 'Cocktails',
  'Whisky': 'Digestifs', 'Cognac': 'Digestifs', 'Cognac aux amandes': 'Digestifs',
  'Armagnac': 'Digestifs', 'Calva': 'Digestifs', 'Menthe pastille': 'Digestifs',
  'Shooter Menthe Pastille': 'Digestifs', 'Shooter Botran 4cl': 'Digestifs',
};

async function getMerchantCode() {
  const res = await fetch(`${SUMUP_API}/v0.1/me`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await res.json();
  return data.merchant_profile?.merchant_code;
}

async function fetchReceipt(txCode, mc) {
  const res = await fetch(`${SUMUP_API}/v1.0/receipts/${txCode}?mid=${mc}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.transaction_data?.products || [];
}

async function main() {
  const mc = await getMerchantCode();
  console.log('Merchant code:', mc);

  // Get all transactions that don't have items yet
  const txs = await sql(
    "SELECT raw_data->>'transaction_code' as tc, date::text FROM transactions WHERE status = 'successful' AND raw_data->>'transaction_code' IS NOT NULL AND raw_data->>'transaction_code' NOT IN (SELECT DISTINCT transaction_code FROM transaction_items) ORDER BY date ASC"
  );

  console.log(`${txs.length} transactions to backfill`);
  let total = 0;
  let errors = 0;
  let empty = 0;

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    try {
      const products = await fetchReceipt(tx.tc, mc);
      if (products.length === 0) {
        empty++;
        continue;
      }

      for (const p of products) {
        await sql(
          'INSERT INTO transaction_items (transaction_code, date, name, category, qty, price_unit, price_total, vat_rate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [
            tx.tc, tx.date, p.name,
            CATEGORIES[p.name] || 'Non attribué',
            p.quantity || 1,
            parseFloat(p.price_with_vat || p.price || 0),
            parseFloat(p.total_with_vat || p.total_price || 0),
            parseFloat(p.vat_rate || 0),
          ]
        );
        total++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`${i + 1}/${txs.length} — ${total} items, ${empty} empty, ${errors} errors`);
      }

      // Small delay to avoid rate limiting
      if (i % 10 === 9) await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      errors++;
    }
  }

  console.log(`\nDone! ${total} items inserted, ${empty} empty receipts, ${errors} errors`);

  // Verify
  const counts = await sql('SELECT COUNT(*) as items, COUNT(DISTINCT transaction_code) as txs, COUNT(DISTINCT name) as articles FROM transaction_items');
  console.log('Total in DB:', JSON.stringify(counts[0]));
}

main().catch(e => console.error(e));
