import { NextRequest, NextResponse } from 'next/server';

const PAPPERS_URL = 'https://api.pappers.fr/v2/recherche';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Read Pappers API key from request header (sent by the client)
  const apiToken = request.headers.get('x-pappers-token');
  if (!apiToken) {
    return NextResponse.json({ error: 'Clé API Pappers manquante. Ajoutez votre clé gratuite dans les paramètres.' }, { status: 401 });
  }

  const p = new URLSearchParams();
  p.set('api_token', apiToken);
  p.set('precision', 'avancee');
  p.set('par_page', searchParams.get('per_page') || '25');
  p.set('page', searchParams.get('page') || '1');

  // APE code — Pappers uses code without dot (e.g. "6920Z")
  const code_naf = searchParams.get('code_naf');
  if (code_naf) p.set('code_naf', code_naf);

  // Text search
  const q = searchParams.get('q');
  if (q) p.set('q', q);

  // Geographic filters
  const dept = searchParams.get('departement');
  if (dept) p.set('departement', dept);
  const region = searchParams.get('region');
  if (region) p.set('region', region);

  // Status
  const etat = searchParams.get('etat_administratif');
  if (etat === 'A') p.set('statut_rcs', 'inscrit');
  else if (etat === 'C') p.set('statut_rcs', 'radie');

  // Financial filters (in euros)
  const caMin = searchParams.get('ca_min');
  const caMax = searchParams.get('ca_max');
  if (caMin) p.set('chiffre_affaires_min', caMin);
  if (caMax) p.set('chiffre_affaires_max', caMax);

  // Dirigeant age filters
  const ageMin = searchParams.get('age_dirigeant_min');
  const ageMax = searchParams.get('age_dirigeant_max');
  if (ageMin) p.set('age_dirigeant_min', ageMin);
  if (ageMax) p.set('age_dirigeant_max', ageMax);

  try {
    const res = await fetch(`${PAPPERS_URL}?${p.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Pappers: ${res.status} — ${body}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(mapPappersResponse(data));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Map Pappers response → our SearchResult format ──────────────────────────

function mapPappersResponse(data: Record<string, unknown>) {
  const resultats = (data.resultats as Record<string, unknown>[]) || [];
  return {
    results: resultats.map(mapCompany),
    total_results: (data.total as number) || 0,
    page: (data.page as number) || 1,
    per_page: (data.par_page as number) || 25,
    total_pages: Math.ceil(((data.total as number) || 0) / ((data.par_page as number) || 25)),
  };
}

function mapCompany(r: Record<string, unknown>) {
  const siege = (r.siege as Record<string, unknown>) || {};
  const representants = (r.representants as Record<string, unknown>[]) || [];
  const finances = (r.finances as Record<string, unknown>[]) || [];
  const fin = finances[0] as Record<string, unknown> | undefined;

  return {
    siren: r.siren,
    nom_complet: r.nom_entreprise || r.denomination || '',
    nom_raison_sociale: r.nom_entreprise || r.denomination || '',
    nature_juridique: r.forme_juridique_code || '',
    libelle_nature_juridique: r.forme_juridique || '',
    tranche_effectif_salarie: r.tranche_effectif || '',
    date_creation: r.date_creation_formate || r.date_creation || '',
    etat_administratif: r.statut_rcs === 'inscrit' ? 'A' : 'C',
    siege: {
      siret: siege.siret || '',
      activite_principale: siege.code_naf || '',
      libelle_activite_principale: siege.libelle_code_naf || '',
      adresse: [siege.adresse_ligne_1, siege.adresse_ligne_2].filter(Boolean).join(', '),
      code_postal: siege.code_postal || '',
      libelle_commune: siege.ville || '',
      commune: siege.ville || '',
      departement: siege.departement_code || '',
      region: siege.region_code || '',
    },
    dirigeants: representants.map((d: Record<string, unknown>) => ({
      nom: d.nom || '',
      prenoms: d.prenom || '',
      qualite: d.qualite || '',
      type: d.type || '',
      // age disponible si Pappers le retourne
      age: d.age,
    })),
    finances: fin ? {
      ca: fin.chiffre_affaires as number | undefined,
      resultat_net: fin.resultat as number | undefined,
      annee: fin.annee as number | undefined,
    } : undefined,
    nombre_etablissements: r.nombre_etablissements as number | undefined,
    nombre_etablissements_ouverts: r.nombre_etablissements_ouverts as number | undefined,
  };
}
