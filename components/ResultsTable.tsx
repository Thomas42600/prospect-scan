'use client';

import { Company } from '@/lib/types';
import { TRANCHE_LABEL } from '@/lib/constants';
import { computeScore } from '@/lib/fetch';

type SortMode = 'default' | 'age' | 'ca' | 'score';

interface Props {
  companies: Company[];
  loading: boolean;
  favorites: Set<string>;
  prospects: Record<string, string>;
  onSelect: (c: Company) => void;
  onToggleFavorite: (siren: string) => void;
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
  enrichedAges?: Record<string, number | null>;
  enrichingCount?: number;
}

const STATUT_COLORS: Record<string, string> = {
  contacted: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',
  qualified:  'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  ongoing:    'bg-violet-50 text-violet-600 ring-1 ring-violet-200',
  closed:     'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200',
  rejected:   'bg-red-50 text-red-500 ring-1 ring-red-200',
};
const STATUT_LABELS: Record<string, string> = {
  contacted: 'Contacté',
  qualified:  'Qualifié',
  ongoing:    'En cours',
  closed:     'Converti',
  rejected:   'Abandonné',
};

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[40, 65, 50, 30, 28, 35, 45].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 bg-slate-100 rounded-full animate-pulse" style={{ width: `${w}%` }} />
          {i === 1 && <div className="h-2.5 bg-slate-100 rounded-full animate-pulse mt-1.5 w-20" />}
        </td>
      ))}
    </tr>
  );
}

function formatCA(ca: number): string {
  if (ca >= 1_000_000) return `${(ca / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M€`;
  return `${Math.round(ca / 1000).toLocaleString('fr-FR')} k€`;
}

function SortableHeader({ label, mode, current, onClick }: { label: string; mode: SortMode; current?: SortMode; onClick?: (m: SortMode) => void }) {
  const active = current === mode;
  return (
    <button
      onClick={() => onClick?.(active ? 'default' : mode)}
      className={`flex items-center gap-1 group transition ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
        {label}
      </span>
      {onClick && (
        <span className={`text-[10px] ${active ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
          {active ? '↓' : '↕'}
        </span>
      )}
    </button>
  );
}

export default function ResultsTable({ companies, loading, favorites, prospects, onSelect, onToggleFavorite, sortMode, onSortChange, enrichedAges = {}, enrichingCount = 0 }: Props) {
  const maxCA = Math.max(0, ...companies.map(c => c.finances?.ca ?? 0));

  if (!loading && companies.length === 0 && enrichingCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-slate-500">Aucun résultat</p>
        <p className="text-xs text-slate-400 mt-1">Modifiez vos filtres pour élargir la recherche</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 text-left">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">Entreprise</span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">Localisation</span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">Forme</span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">Effectifs</span>
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader label="CA" mode="ca" current={sortMode} onClick={onSortChange} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader label="Dirigeant · Âge" mode="age" current={sortMode} onClick={onSortChange} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader label="Score M&A" mode="score" current={sortMode} onClick={onSortChange} />
              </th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          {enrichingCount > 0 && (
            <thead>
              <tr>
                <td colSpan={9} className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100">
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 border border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                    Enrichissement INPI RNE en cours… ({enrichingCount} restants)
                  </span>
                </td>
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              : companies.map(company => {
                  const dirigeant = company.dirigeants?.[0];
                  const isFav = favorites.has(company.siren);
                  const prospectStatut = prospects[company.siren];
                  const score = computeScore(company, maxCA);

                  const birthYearStr = (dirigeant?.date_de_naissance || dirigeant?.annee_de_naissance || '').match(/(\d{4})/)?.[1];
                  const enrichedYear = !birthYearStr ? (enrichedAges[company.siren] ?? null) : null;
                  const effectiveBirthYear = birthYearStr || (enrichedYear ? String(enrichedYear) : null);
                  const age = effectiveBirthYear ? new Date().getFullYear() - parseInt(effectiveBirthYear) : null;
                  const isRneAge = !birthYearStr && !!enrichedYear;

                  return (
                    <tr
                      key={company.siren}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                      onClick={() => onSelect(company)}
                    >
                      {/* Favori */}
                      <td className="px-4 py-3.5" onClick={e => { e.stopPropagation(); onToggleFavorite(company.siren); }}>
                        <button className={`transition text-base leading-none ${isFav ? 'text-amber-400' : 'text-slate-200 hover:text-amber-300'}`}>
                          ★
                        </button>
                      </td>

                      {/* Entreprise */}
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{company.nom_complet}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] text-slate-400 font-mono">{company.siren}</span>
                          {company.etat_administratif === 'A'
                            ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Actif</span>
                            : <span className="inline-flex items-center gap-1 text-[11px] text-red-500 font-medium"><span className="w-1.5 h-1.5 bg-red-400 rounded-full" />Fermé</span>
                          }
                          {prospectStatut && (
                            <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-semibold ${STATUT_COLORS[prospectStatut] || ''}`}>
                              {STATUT_LABELS[prospectStatut]}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Localisation */}
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-slate-700 font-medium">{company.siege?.libelle_commune || '—'}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {[company.siege?.code_postal, company.siege?.departement ? `Dép. ${company.siege.departement}` : null].filter(Boolean).join(' · ')}
                        </p>
                      </td>

                      {/* Forme */}
                      <td className="px-4 py-3.5">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-600 font-medium whitespace-nowrap">
                          {company.libelle_nature_juridique || company.nature_juridique || '—'}
                        </span>
                      </td>

                      {/* Effectifs */}
                      <td className="px-4 py-3.5 text-[12px] text-slate-500 whitespace-nowrap">
                        {TRANCHE_LABEL[company.tranche_effectif_salarie || ''] || company.tranche_effectif_salarie || <span className="text-slate-300">—</span>}
                      </td>

                      {/* CA */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {company.finances?.ca != null ? (
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{formatCA(company.finances.ca)}</span>
                            {company.finances.annee && (
                              <span className="text-[11px] text-slate-400 ml-1.5">{company.finances.annee}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Dirigeant + Âge */}
                      <td className="px-4 py-3.5">
                        {dirigeant ? (
                          <div>
                            <p className="text-sm text-slate-700 font-medium leading-tight">
                              {[dirigeant.prenoms, dirigeant.nom].filter(Boolean).join(' ') || dirigeant.denomination || '—'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-400">{dirigeant.qualite || dirigeant.type_dirigeant || dirigeant.type}</span>
                              {age && (
                                <span className={`text-[11px] font-semibold ${
                                  age >= 65 ? 'text-red-500' : age >= 60 ? 'text-amber-500' : age >= 50 ? 'text-amber-400' : 'text-slate-400'
                                }`}>
                                  · {age} ans{isRneAge && <span className="ml-1 text-[10px] text-emerald-500 font-normal">RNE</span>}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Score M&A */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {score > 0 ? (
                          <span className={`inline-flex items-center justify-center w-9 h-6 rounded-md text-[11px] font-bold ${
                            score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                            score >= 40 ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Chevron */}
                      <td className="px-3 py-3.5">
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
