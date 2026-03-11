import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateDebut = searchParams.get('date_debut')
  const dateFin = searchParams.get('date_fin')
  const baselineDebut = searchParams.get('baseline_debut')
  const baselineFin = searchParams.get('baseline_fin')
  const maitreOuvrage = searchParams.get('maitre_ouvrage') || 'Nantes Métropole'

  if (!dateDebut || !dateFin || !baselineDebut || !baselineFin) {
    return NextResponse.json({ error: 'Paramètres requis' }, { status: 400 })
  }

  // Fetch impact data from our own API
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const impactRes = await fetch(
    `${baseUrl}/api/reports/impact-travaux?date_debut=${dateDebut}&date_fin=${dateFin}&baseline_debut=${baselineDebut}&baseline_fin=${baselineFin}`,
    { headers: { cookie: req.headers.get('cookie') || '' } }
  )
  if (!impactRes.ok) return NextResponse.json({ error: 'Erreur calcul impact' }, { status: 500 })

  const data = await impactRes.json()
  const dateGeneration = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Générer HTML pour le PDF
  const semainesHtml = (data.par_semaine || []).map((s: any) => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #ddd">${s.semaine}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;text-align:right">${s.baseline.toLocaleString('fr-FR')} €</td>
      <td style="padding:6px 12px;border:1px solid #ddd;text-align:right">${s.travaux.toLocaleString('fr-FR')} €</td>
      <td style="padding:6px 12px;border:1px solid #ddd;text-align:right;color:${s.baseline > s.travaux ? '#c00' : '#080'}">${s.baseline > 0 ? '-' + Math.round((1 - s.travaux / s.baseline) * 100) + '%' : '—'}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Rapport d'impact commercial</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333">

<div style="text-align:center;margin-bottom:40px">
  <h2 style="margin:0">SARL BOSCU</h2>
  <p style="margin:4px 0;color:#666">Le Wagon — Bar à Papote et à Grignote</p>
  <p style="margin:4px 0;color:#666">22 quai de la Fosse, 44000 Nantes</p>
  <p style="margin:4px 0;color:#666">bar.lewagon@gmail.com</p>
</div>

<hr style="border:none;border-top:2px solid #333;margin:20px 0">

<h3>Rapport d'impact commercial — Trouble de jouissance lié aux travaux</h3>

<table style="width:100%;margin:16px 0;border-collapse:collapse">
  <tr><td style="padding:4px 0;width:200px;color:#666">Maître d'ouvrage :</td><td><strong>${maitreOuvrage}</strong></td></tr>
  <tr><td style="padding:4px 0;color:#666">Période de travaux :</td><td><strong>${dateDebut} au ${dateFin}</strong> (${data.periode_travaux.jours} jours d'activité)</td></tr>
  <tr><td style="padding:4px 0;color:#666">Période de référence :</td><td>${baselineDebut} au ${baselineFin} (${data.periode_baseline.jours} jours)</td></tr>
  <tr><td style="padding:4px 0;color:#666">Date du rapport :</td><td>${dateGeneration}</td></tr>
</table>

<h4 style="margin-top:30px">Synthèse</h4>

<table style="width:100%;border-collapse:collapse;margin:12px 0">
  <tr style="background:#f5f5f5">
    <td style="padding:8px 12px;border:1px solid #ddd">CA moyen/jour (référence)</td>
    <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold">${data.moyenne_baseline.toLocaleString('fr-FR')} €</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;border:1px solid #ddd">CA moyen/jour (travaux)</td>
    <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold">${data.moyenne_travaux.toLocaleString('fr-FR')} €</td>
  </tr>
  <tr style="background:#fff0f0">
    <td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold">Perte de chiffre d'affaires</td>
    <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#c00">${data.perte_pourcent}% (${data.perte_euros.toLocaleString('fr-FR')} €)</td>
  </tr>
  <tr style="background:${data.seuil_atteint ? '#f0fff0' : '#fffbeb'}">
    <td style="padding:8px 12px;border:1px solid #ddd">Seuil d'indemnisation (37%)</td>
    <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold;color:${data.seuil_atteint ? '#080' : '#b45309'}">${data.seuil_atteint ? 'ATTEINT' : 'NON ATTEINT'}</td>
  </tr>
</table>

<h4 style="margin-top:30px">Détail par semaine</h4>

<table style="width:100%;border-collapse:collapse;margin:12px 0">
  <thead>
    <tr style="background:#f5f5f5">
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:left">Période</th>
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:right">Référence</th>
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:right">Travaux</th>
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:right">Écart</th>
    </tr>
  </thead>
  <tbody>${semainesHtml}</tbody>
</table>

<h4 style="margin-top:30px">Base juridique</h4>
<p style="font-size:13px;line-height:1.6">
  En application du principe d'égalité devant les charges publiques et de la responsabilité sans faute de la puissance publique,
  le commerçant dont l'activité est anormalement impactée par des travaux publics est fondé à demander une indemnisation
  dès lors que la perte de chiffre d'affaires excède le seuil de tolérance reconnu par la jurisprudence administrative
  (environ 37-40% de perte par rapport à une période comparable).
</p>
<p style="font-size:13px;line-height:1.6">
  Le présent rapport constitue une pièce justificative à l'appui d'une demande d'indemnisation amiable
  adressée au maître d'ouvrage. En l'absence de réponse sous 2 mois, un recours devant le tribunal administratif est possible.
  La prescription est de 4 ans à compter du 1er janvier suivant le dommage.
</p>

<div style="margin-top:40px;padding-top:20px;border-top:1px solid #ccc">
  <p style="font-size:12px;color:#666">
    Rapport généré automatiquement le ${dateGeneration} — SARL BOSCU, Le Wagon Bar, 22 quai de la Fosse, 44000 Nantes
  </p>
</div>

</body></html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="rapport-impact-travaux-${dateDebut}.html"`,
    },
  })
}
