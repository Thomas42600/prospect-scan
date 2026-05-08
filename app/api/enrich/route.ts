import { NextRequest, NextResponse } from 'next/server';

const RNE_BASE = 'https://registre-national-des-entreprises.inpi.fr/api';

// Token cache (persists across requests within the same serverless instance)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const res = await fetch(`${RNE_BASE}/sso/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.INPI_EMAIL,
      password: process.env.INPI_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`INPI auth ${res.status}`);
  const data = await res.json();
  const token = data.token || data.access_token || data.jwt;
  if (!token) throw new Error('Token non trouvé dans la réponse INPI');

  // Cache for 50 minutes (tokens typically expire after 1h)
  cachedToken = { value: token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

// Recursively extract all objects that have a dateDeNaissancePartielle or dateDeNaissance field
function extractPersonnes(obj: unknown, depth = 0): Array<Record<string, unknown>> {
  if (!obj || typeof obj !== 'object' || depth > 15) return [];
  const results: Array<Record<string, unknown>> = [];

  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...extractPersonnes(item, depth + 1));
    return results;
  }

  const record = obj as Record<string, unknown>;

  const dob = record.dateDeNaissancePartielle || record.dateDeNaissance;
  if (dob && typeof dob === 'string') {
    results.push(record);
  }

  for (const val of Object.values(record)) {
    if (val && typeof val === 'object') {
      results.push(...extractPersonnes(val, depth + 1));
    }
  }

  return results;
}

function resolveString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.join(' ');
  return String(val);
}

export async function GET(request: NextRequest) {
  const siren = request.nextUrl.searchParams.get('siren');
  if (!siren) return NextResponse.json({ error: 'SIREN requis' }, { status: 400 });

  if (!process.env.INPI_EMAIL || !process.env.INPI_PASSWORD) {
    return NextResponse.json(
      { error: 'Identifiants INPI non configurés (INPI_EMAIL / INPI_PASSWORD)' },
      { status: 503 }
    );
  }

  try {
    const token = await getToken();

    const res = await fetch(`${RNE_BASE}/companies/${siren}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      next: { revalidate: 86400 }, // cache 24h
    });

    if (!res.ok) throw new Error(`RNE API ${res.status}`);
    const data = await res.json();

    // Extract all person objects with a birth date anywhere in the response
    const personnes = extractPersonnes(data);

    const dirigeants = personnes.map(p => {
      const dob = resolveString(p.dateDeNaissancePartielle || p.dateDeNaissance);
      const nom = resolveString(p.nom || p.nomUsage || p.nomNaissance || '');
      const prenom = resolveString(p.prenoms || p.prenom || p.prénoms || '');
      const qualite = resolveString(p.qualite || p.role || p.typeDePoste || p.fonction || '');
      const yearMatch = dob.match(/^(\d{4})/);
      const annee = yearMatch ? parseInt(yearMatch[1]) : null;

      return { nom, prenom, qualite, dateNaissance: dob, annee };
    }).filter(d => d.annee && d.annee > 1900 && d.annee < new Date().getFullYear() - 15);

    // Deduplicate by nom+prenom
    const seen = new Set<string>();
    const unique = dirigeants.filter(d => {
      const key = `${d.nom}|${d.prenom}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ dirigeants: unique, siren });
  } catch (err) {
    console.error('RNE enrich error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
