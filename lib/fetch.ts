import { SearchFilters, SearchResult, Company } from './types';

// ─── Build URLSearchParams for the government API ────────────────────────────

function buildParams(f: SearchFilters, page: number, keyword: string | null, withApe: boolean): URLSearchParams {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('per_page', '25');

  if (withApe && f.activite_principale) {
    p.set('activite_principale', f.activite_principale);
  }
  if (keyword) p.set('q', keyword);

  if (f.departement) p.set('departement', f.departement);
  if (f.region) p.set('region', f.region);
  if (f.etat_administratif) p.set('etat_administratif', f.etat_administratif);
  if (f.nature_juridique) p.set('nature_juridique', f.nature_juridique);
  if (f.tranche_effectif) p.set('tranche_effectif_salarie', f.tranche_effectif);

  // Native financial filters — free, no API key
  if (f.ca_min != null) p.set('ca_min', String(f.ca_min));
  if (f.ca_max != null) p.set('ca_max', String(f.ca_max));

  // Native dirigeant birth date filters — free, no API key
  if (f.date_naissance_min) p.set('date_naissance_personne_min', f.date_naissance_min);
  if (f.date_naissance_max) p.set('date_naissance_personne_max', f.date_naissance_max);

  return p;
}

async function apiFetch(f: SearchFilters, page: number, keyword: string | null, withApe: boolean): Promise<SearchResult> {
  const res = await fetch(`/api/search?${buildParams(f, page, keyword, withApe).toString()}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── Merge + deduplicate by SIREN ────────────────────────────────────────────

function mergeResponses(responses: SearchResult[], page: number): SearchResult {
  const seen = new Set<string>();
  const merged: Company[] = [];
  for (const r of responses) {
    for (const c of r.results || []) {
      if (!seen.has(c.siren)) {
        seen.add(c.siren);
        merged.push(c);
      }
    }
  }
  return {
    results: merged,
    total_results: responses.reduce((s, r) => s + (r.total_results || 0), 0),
    page,
    per_page: merged.length,
    total_pages: Math.max(...responses.map(r => r.total_pages || 0)),
  };
}

// ─── Main fetch — UNION of APE branch + keyword branches ─────────────────────
//
// APE branch    : one call with activite_principale, no q  → catches all EC by code
// Keyword branch: one call per keyword, no APE restriction → catches EC with wrong code
//
// "Unknown data" inclusion:
//   When CA filter active  → also fetch without CA  and keep only companies with no CA data
//   When age filter active → also fetch without age and keep only companies with no age data
//   When both active       → 4 combinations cover (CA ok | CA ?) × (age ok | age ?)

function buildCallConfigs(f: SearchFilters): [string | null, boolean][] {
  const configs: [string | null, boolean][] = [];
  if (f.use_ape !== false) configs.push([null, true]);
  const kws = f.keywords && f.keywords.length > 0 ? f.keywords : [];
  if (kws.length > 0) kws.forEach(kw => configs.push([kw, false]));
  else if (f.q) configs.push([f.q, false]);
  if (configs.length === 0) configs.push([null, true]);
  return configs;
}

function hasNoKnownAge(c: Company): boolean {
  if (!c.dirigeants || c.dirigeants.length === 0) return true;
  return c.dirigeants.every(d => !d.date_de_naissance && !d.annee_de_naissance);
}

function hasNoKnownCa(c: Company): boolean {
  return c.finances?.ca == null;
}

export async function fetchData(f: SearchFilters): Promise<SearchResult> {
  const configs = buildCallConfigs(f);
  const hasCa  = f.ca_min != null || f.ca_max != null;
  const hasAge = !!(f.date_naissance_min || f.date_naissance_max);

  // Build extra fetch sets: each has a filter variant + a client-side guard
  type ExtraSet = { filters: SearchFilters; keep: (c: Company) => boolean };
  const extraSets: ExtraSet[] = [];

  const fNoCa  = { ...f, ca_min: undefined, ca_max: undefined };
  const fNoAge = { ...f, date_naissance_min: undefined, date_naissance_max: undefined };
  const fNone  = { ...fNoCa, date_naissance_min: undefined, date_naissance_max: undefined };

  if (hasCa && !hasAge) {
    extraSets.push({ filters: fNoCa, keep: hasNoKnownCa });
  } else if (!hasCa && hasAge) {
    extraSets.push({ filters: fNoAge, keep: hasNoKnownAge });
  } else if (hasCa && hasAge) {
    // (CA ?) AND (age ok)
    extraSets.push({ filters: fNoCa,  keep: c => hasNoKnownCa(c) });
    // (CA ok) AND (age ?)
    extraSets.push({ filters: fNoAge, keep: c => hasNoKnownAge(c) });
    // (CA ?) AND (age ?)
    extraSets.push({ filters: fNone,  keep: c => hasNoKnownCa(c) && hasNoKnownAge(c) });
  }

  // Run all call sets in parallel
  const [mainResponses, ...extraResponses] = await Promise.all([
    Promise.all(configs.map(([kw, ape]) => apiFetch(f, f.page, kw, ape))),
    ...extraSets.map(({ filters }) =>
      Promise.all(configs.map(([kw, ape]) => apiFetch(filters, f.page, kw, ape)))
    ),
  ]);

  // Merge with deduplication — main results first, then unknowns
  const seen = new Set<string>();
  const merged: Company[] = [];

  for (const r of mainResponses) {
    for (const c of r.results || []) {
      if (!seen.has(c.siren)) { seen.add(c.siren); merged.push(c); }
    }
  }
  extraSets.forEach(({ keep }, i) => {
    for (const r of extraResponses[i]) {
      for (const c of r.results || []) {
        if (!seen.has(c.siren) && keep(c)) { seen.add(c.siren); merged.push(c); }
      }
    }
  });

  const total = mainResponses.reduce((s, r) => s + (r.total_results || 0), 0);
  return {
    results: merged,
    total_results: total,
    page: f.page,
    per_page: merged.length,
    total_pages: Math.max(...mainResponses.map(r => r.total_pages || 0)),
  };
}

// ─── Export: fetch N pages with union logic ───────────────────────────────────

export async function fetchAllPages(
  f: SearchFilters,
  maxPages: number,
  onProgress?: (pct: number) => void,
): Promise<Company[]> {
  const seen = new Set<string>();
  const companies: Company[] = [];

  for (let page = 1; page <= maxPages; page++) {
    onProgress?.(Math.round((page / maxPages) * 90));
    const result = await fetchData({ ...f, page });
    let added = false;
    for (const c of result.results || []) {
      if (!seen.has(c.siren)) {
        seen.add(c.siren);
        companies.push(c);
        added = true;
      }
    }
    if (!added && page > 1) break;
  }

  return companies;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse birth year from INPI format ("1965-12" or "1965") → age */
export function parseAge(dob?: string): number | null {
  if (!dob) return null;
  const m = dob.match(/^(\d{4})/);
  if (!m) return null;
  const year = parseInt(m[1]);
  if (year < 1900 || year > new Date().getFullYear() - 10) return null;
  return new Date().getFullYear() - year;
}

/** Build ISO date string "YYYY-01-01" from an age (for API parameter) */
export function ageToDate(age: number): string {
  return `${new Date().getFullYear() - age}-01-01`;
}

/** Compute M&A score (0–100) for a company given the max CA in the dataset */
export function computeScore(c: Company, maxCA: number): number {
  const d = c.dirigeants?.[0];
  const yrStr = (d?.date_de_naissance || d?.annee_de_naissance || '').match(/(\d{4})/)?.[1];
  const age = yrStr ? new Date().getFullYear() - parseInt(yrStr) : null;

  const ageScore = age ? Math.max(0, Math.min(100, (age - 40) / 40 * 100)) : 0;
  const ca = c.finances?.ca ?? null;
  const caScore = (ca && maxCA > 0) ? Math.min(100, (Math.log(ca + 1) / Math.log(maxCA + 1)) * 100) : 0;

  return Math.round(ageScore * 0.65 + caScore * 0.35);
}

/** Count of parallel API calls for a given filter config */
export function countCalls(f: SearchFilters): number {
  return (f.use_ape !== false ? 1 : 0) + (f.keywords?.length ?? 0) + (f.q && !f.keywords?.length ? 1 : 0);
}
