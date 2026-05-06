'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchFilters } from '@/lib/types';
import { fetchAllPages } from '@/lib/fetch';
import { TRANCHE_LABEL } from '@/lib/constants';

interface Props {
  filters: SearchFilters;
  totalResults: number;
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

  const exportData = async (maxPages: number) => {
    setLoading(true);
    setOpen(false);
    setProgress(10);

    try {
      const companies = await fetchAllPages(filters, maxPages);
      setProgress(90);

      const headers = [
        'SIREN', 'Nom', 'Forme juridique', 'Adresse', 'Code postal', 'Ville',
        'Département', 'Région', 'Tranche effectifs', 'Date création',
        'CA (€)', 'Année CA', 'Résultat net (€)',
        'Dirigeant principal', 'Qualité dirigeant', 'Année naissance', 'Âge estimé',
        'Nb dirigeants', 'Statut', 'Code APE', 'Nb établissements',
      ];

      const currentYear = new Date().getFullYear();

      const rows = (companies as unknown as Record<string, unknown>[]).map(c => {
        const siege = c.siege as Record<string, unknown> | undefined;
        const dirs = c.dirigeants as Record<string, unknown>[] | undefined;
        const d0 = dirs?.[0] as Record<string, unknown> | undefined;
        const finances = c.finances as Record<string, unknown> | undefined;
        const dobStr = String(d0?.date_de_naissance || d0?.annee_de_naissance || '');
        const birthYearMatch = dobStr.match(/(\d{4})/);
        const birthYear = birthYearMatch ? birthYearMatch[1] : '';
        const age = birthYear ? currentYear - parseInt(birthYear) : '';
        return [
          c.siren,
          c.nom_complet,
          c.libelle_nature_juridique || c.nature_juridique || '',
          siege?.adresse || '',
          siege?.code_postal || '',
          siege?.libelle_commune || '',
          siege?.departement || '',
          siege?.region || '',
          TRANCHE_LABEL[(c.tranche_effectif_salarie as string) || ''] || c.tranche_effectif_salarie || '',
          c.date_creation || '',
          finances?.ca ?? '',
          finances?.annee ?? '',
          finances?.resultat_net ?? '',
          d0 ? [d0.prenoms, d0.nom].filter(Boolean).join(' ') || d0.denomination || '' : '',
          d0?.qualite || d0?.type_dirigeant || d0?.type || '',
          birthYear,
          age,
          dirs?.length ?? '',
          c.etat_administratif === 'A' ? 'Actif' : 'Fermé',
          siege?.activite_principale || '',
          c.nombre_etablissements || '',
        ];
      });

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cabinets-ec-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const kwCount = filters.keywords?.length ?? 0;
  const note = kwCount > 1 ? ` (${kwCount} mots-clés)` : '';

  const options = [
    { pages: 1, label: `25 premiers résultats${note}` },
    { pages: 4, label: `100 résultats${note}` },
    { pages: 20, label: `500 résultats${note}` },
    { pages: 40, label: `1 000 résultats${note}` },
    { pages: Math.ceil(Math.min(totalResults, 5000) / 25), label: `Tout exporter (max 5 000)${note}` },
  ];

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
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden">
          <p className="px-4 py-2.5 text-xs text-slate-500 border-b border-slate-100 font-medium">
            {totalResults.toLocaleString('fr-FR')} résultats
            {kwCount > 1 && (
              <span className="ml-1 text-amber-600"> · {kwCount} mots-clés combinés</span>
            )}
          </p>
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => exportData(opt.pages)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition border-b border-slate-50 last:border-0"
            >
              {opt.label}
              <span className="block text-xs text-slate-400">
                ≈ {Math.min(opt.pages * 25 * Math.max(1, kwCount), totalResults).toLocaleString('fr-FR')} lignes · CSV Excel-compatible
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
