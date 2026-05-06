'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchFilters } from '@/lib/types';
import { fetchAllPages, computeScore } from '@/lib/fetch';
import { TRANCHE_LABEL } from '@/lib/constants';

interface Props {
  filters: SearchFilters;
  totalResults: number;
}

const Y = new Date().getFullYear();

function buildRows(companies: ReturnType<typeof Array.prototype.map>, maxCA: number) {
  return (companies as unknown as Record<string, unknown>[]).map(c => {
    const siege = c.siege as Record<string, unknown> | undefined;
    const dirs = c.dirigeants as Record<string, unknown>[] | undefined;
    const d0 = dirs?.[0] as Record<string, unknown> | undefined;
    const finances = c.finances as Record<string, unknown> | undefined;
    const dobStr = String(d0?.date_de_naissance || d0?.annee_de_naissance || '');
    const birthYear = dobStr.match(/(\d{4})/)?.[1] || '';
    const age = birthYear ? Y - parseInt(birthYear) : '';
    const score = computeScore(c as never, maxCA);
    return [
      // HubSpot standard fields
      c.nom_complet,                                                           // Company name
      siege?.adresse || '',                                                    // Street address
      siege?.libelle_commune || '',                                            // City
      siege?.code_postal || '',                                                // Zip code
      siege?.departement || '',                                                // State / Département
      'France',                                                                // Country
      TRANCHE_LABEL[(c.tranche_effectif_salarie as string) || ''] || '',      // Number of employees
      finances?.ca ?? '',                                                      // Annual revenue (€)
      // Custom / enrichissement
      c.siren,                                                                 // SIREN
      c.libelle_nature_juridique || c.nature_juridique || '',                  // Forme juridique
      finances?.annee ?? '',                                                   // Année CA
      d0 ? [d0.prenoms, d0.nom].filter(Boolean).join(' ') || d0.denomination || '' : '', // Dirigeant
      d0?.qualite || d0?.type_dirigeant || d0?.type || '',                    // Qualité
      birthYear,                                                               // Année naissance
      age,                                                                     // Âge estimé
      score > 0 ? score : '',                                                  // Score M&A
      c.date_creation || '',                                                   // Date création
      siege?.activite_principale || '',                                        // Code APE
      c.nombre_etablissements || '',                                           // Nb établissements
    ];
  });
}

const HEADERS = [
  'Company name', 'Street address', 'City', 'Zip code', 'State', 'Country',
  'Number of employees', 'Annual revenue (€)',
  'SIREN', 'Forme juridique', 'Année CA',
  'Dirigeant principal', 'Qualité', 'Année naissance', 'Âge estimé',
  'Score M&A', 'Date création', 'Code APE', 'Nb établissements',
];

function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function download(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportButton({ filters, totalResults }: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Standard export — N pages, HubSpot format
  const exportPages = async (maxPages: number) => {
    setLoading(true);
    setOpen(false);
    setProgress(10);
    try {
      const companies = await fetchAllPages(filters, maxPages, p => setProgress(p));
      setProgress(90);
      const maxCA = Math.max(0, ...companies.map(c => c.finances?.ca ?? 0));
      const rows = buildRows(companies as never, maxCA);
      download(toCSV(HEADERS, rows), `cabinets-ec-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  // Top N Score M&A — fetch large pool, sort by score, take top N
  const exportTopN = async (n: number) => {
    setLoading(true);
    setOpen(false);
    setProgress(10);
    try {
      const poolPages = Math.ceil(Math.min(n * 4, Math.min(totalResults, 2000)) / 25);
      const companies = await fetchAllPages(filters, poolPages, p => setProgress(Math.round(p * 0.8)));
      setProgress(85);
      const maxCA = Math.max(0, ...companies.map(c => c.finances?.ca ?? 0));
      const sorted = [...companies].sort((a, b) => computeScore(b, maxCA) - computeScore(a, maxCA));
      const top = sorted.slice(0, n);
      const rows = buildRows(top as never, maxCA);
      download(toCSV(HEADERS, rows), `top${n}-score-ma-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading || totalResults === 0}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>{progress}%</span>
          </>
        ) : (
          <>
            <span>↓</span>
            <span>Exporter CSV</span>
          </>
        )}
      </button>

      {open && !loading && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden">
          <p className="px-4 py-2.5 text-xs text-slate-500 border-b border-slate-100 font-medium">
            {totalResults.toLocaleString('fr-FR')} résultats · Format HubSpot
          </p>

          {/* Top N Score M&A */}
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">★ Top Score M&A</p>
            {[50, 100, 200].map(n => (
              <button key={n} onClick={() => exportTopN(n)}
                className="w-full text-left px-2 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition flex items-center justify-between group">
                <span className="font-medium">Top {n} — Score M&A</span>
                <span className="text-[11px] text-slate-400 group-hover:text-amber-500">Meilleurs scores · HubSpot</span>
              </button>
            ))}
          </div>

          {/* Export standard */}
          <div className="px-4 py-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Export standard</p>
            {[
              { pages: 1,  label: '25 premiers résultats' },
              { pages: 4,  label: '100 résultats' },
              { pages: 20, label: '500 résultats' },
              { pages: Math.ceil(Math.min(totalResults, 5000) / 25), label: 'Tout exporter (max 5 000)' },
            ].map((opt, i) => (
              <button key={i} onClick={() => exportPages(opt.pages)}
                className="w-full text-left px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition flex items-center justify-between">
                <span>{opt.label}</span>
                <span className="text-[11px] text-slate-400">CSV · HubSpot</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
