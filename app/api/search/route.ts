import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://recherche-entreprises.api.gouv.fr/search';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const params = new URLSearchParams();
  params.set('per_page', searchParams.get('per_page') || '25');
  params.set('page', searchParams.get('page') || '1');

  // APE filter (optional — skipped in keyword-only mode)
  const ape = searchParams.get('activite_principale');
  if (ape) params.set('activite_principale', ape);

  // Keyword / free text
  const q = searchParams.get('q');
  if (q) params.set('q', q);

  // Geographic filters
  const forwarded = ['departement', 'region', 'etat_administratif', 'nature_juridique', 'tranche_effectif_salarie'];
  for (const key of forwarded) {
    const val = searchParams.get(key);
    if (val) params.set(key, val);
  }

  // Financial filters — native, free, no API key needed
  const caMin = searchParams.get('ca_min');
  const caMax = searchParams.get('ca_max');
  if (caMin) params.set('ca_min', caMin);
  if (caMax) params.set('ca_max', caMax);

  // Dirigeant birth date filters — server-side, free
  const dobMin = searchParams.get('date_naissance_personne_min');
  const dobMax = searchParams.get('date_naissance_personne_max');
  if (dobMin) params.set('date_naissance_personne_min', dobMin);
  if (dobMax) params.set('date_naissance_personne_max', dobMax);

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();

    // Normalize finances: API returns {"2024": {ca, resultat_net}} → {ca, resultat_net, annee}
    type RawFinances = Record<string, { ca?: number; resultat_net?: number }>;
    const normalized = {
      ...data,
      results: (data.results || []).map((company: Record<string, unknown>) => {
        const raw = company.finances as RawFinances | null | undefined;
        let finances = null;
        if (raw && typeof raw === 'object') {
          const years = Object.keys(raw).sort().reverse();
          if (years.length > 0) {
            const year = years[0];
            finances = { ...raw[year], annee: parseInt(year) };
          }
        }
        return { ...company, finances };
      }),
    };

    return NextResponse.json(normalized, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json(
      { results: [], total_results: 0, page: 1, per_page: 25, total_pages: 0 },
      { status: 500 }
    );
  }
}
