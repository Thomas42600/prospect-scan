'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FiltersPanel from '@/components/FiltersPanel';
import ResultsTable from '@/components/ResultsTable';
import CompanyDrawer from '@/components/CompanyDrawer';
import ExportButton from '@/components/ExportButton';
import Pagination from '@/components/Pagination';
import { SearchFilters, SearchResult, Company } from '@/lib/types';
import { fetchData } from '@/lib/fetch';

const DEFAULT_FILTERS: SearchFilters = {
  page: 1,
  per_page: 25,
  etat_administratif: 'A',
  activite_principale: '69.20Z',
  use_ape: true,
  keywords: ['expert comptable'],
  ca_min: undefined,
  ca_max: undefined,
  date_naissance_min: undefined,
  date_naissance_max: undefined,
};

export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [prospects, setProspects] = useState<Record<string, string>>({});
  const [sortMode, setSortMode] = useState<'default' | 'age' | 'ca' | 'score'>('default');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const fav = localStorage.getItem('ma_favorites');
      if (fav) setFavorites(new Set(JSON.parse(fav)));
      const pro = localStorage.getItem('ma_prospects');
      if (pro) setProspects(JSON.parse(pro));
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async (f: SearchFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchData(f);
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const delay = filters.q ? 500 : 0;
    debounceRef.current = setTimeout(() => load(filters), delay);
    return () => clearTimeout(debounceRef.current);
  }, [filters, load]);


  const handleFilterChange = (partial: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...partial, page: 1 }));
  };

  const toggleFavorite = (siren: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(siren)) next.delete(siren);
      else next.add(siren);
      localStorage.setItem('ma_favorites', JSON.stringify([...next]));
      return next;
    });
  };

  const handleProspectChange = (siren: string, statut: string) => {
    setProspects(prev => {
      const next = { ...prev };
      if (statut) next[siren] = statut;
      else delete next[siren];
      localStorage.setItem('ma_prospects', JSON.stringify(next));
      return next;
    });
  };

  // Number of parallel API calls (for display in sidebar)
  const callCount = (filters.use_ape !== false ? 1 : 0) + (filters.keywords?.length ?? 0);
  const multiMode = callCount > 1;

  // Client-side filters applied after API results
  const displayedCompanies = useMemo(() => {
    let companies = results?.results || [];

    // Siège uniquement — exclure les entreprises dont le siège n'est pas dans le département/région sélectionné
    if (filters.siege_only) {
      if (filters.departement) {
        companies = companies.filter(c => c.siege?.departement === filters.departement);
      } else if (filters.region) {
        companies = companies.filter(c => c.siege?.region === filters.region);
      }
    }

    return companies;
  }, [results, filters.siege_only, filters.departement, filters.region]);

  // ── Sorting ──────────────────────────────────────────────────────────────────
  const sortedCompanies = useMemo(() => {
    if (sortMode === 'default') {
      return [...displayedCompanies].sort((a, b) => {
        const scoreA = (a.finances?.ca != null && a.finances.ca > 0 ? 1 : 0) + ((() => {
          const d = a.dirigeants?.[0];
          return d && (d.date_de_naissance || d.annee_de_naissance) ? 1 : 0;
        })());
        const scoreB = (b.finances?.ca != null && b.finances.ca > 0 ? 1 : 0) + ((() => {
          const d = b.dirigeants?.[0];
          return d && (d.date_de_naissance || d.annee_de_naissance) ? 1 : 0;
        })());
        return scoreB - scoreA;
      });
    }

    const Y = new Date().getFullYear();

    const getAge = (c: Company): number | null => {
      const d = c.dirigeants?.[0];
      if (!d) return null;
      const yr = (d.date_de_naissance || d.annee_de_naissance || '').match(/(\d{4})/)?.[1];
      return yr ? Y - parseInt(yr) : null;
    };

    const getCA = (c: Company): number | null => (c.finances?.ca != null && c.finances.ca > 0) ? c.finances.ca : null;

    if (sortMode === 'age') {
      return [...displayedCompanies].sort((a, b) => {
        const aa = getAge(a), ab = getAge(b);
        if (aa === null && ab === null) return 0;
        if (aa === null) return 1;
        if (ab === null) return -1;
        return ab - aa;
      });
    }

    if (sortMode === 'ca') {
      return [...displayedCompanies].sort((a, b) => {
        const ca = getCA(a), cb = getCA(b);
        if (ca === null && cb === null) return 0;
        if (ca === null) return 1;
        if (cb === null) return -1;
        return cb - ca;
      });
    }

    if (sortMode === 'score') {
      // Score M&A : 65% âge + 35% CA (log-normalisé)
      // Cabinets sans données = score 0, placés en fin de liste
      const maxCA = Math.max(0, ...displayedCompanies.map(c => getCA(c) ?? 0));

      const ageScore = (c: Company): number => {
        const age = getAge(c);
        if (!age) return 0;
        // 40 ans → 0, 80 ans → 100, croissance linéaire
        return Math.max(0, Math.min(100, (age - 40) / 40 * 100));
      };

      const caScore = (c: Company): number => {
        const ca = getCA(c);
        if (!ca || maxCA === 0) return 0;
        return Math.min(100, (Math.log(ca + 1) / Math.log(maxCA + 1)) * 100);
      };

      const score = (c: Company) => ageScore(c) * 0.65 + caScore(c) * 0.35;

      return [...displayedCompanies].sort((a, b) => score(b) - score(a));
    }

    return displayedCompanies;
  }, [displayedCompanies, sortMode]);

  const activeFilterCount = [
    (filters.keywords?.length ?? 0) > 0 || filters.q,
    filters.region,
    filters.departement,
    filters.siege_only ? true : null,
    filters.tranche_effectif,
    filters.nature_juridique,
    filters.etat_administratif !== 'A' ? true : null,
    filters.activite_principale !== '69.20Z' ? true : null,
    filters.use_ape === false ? true : null,
    filters.ca_min != null || filters.ca_max != null || (filters.ca_tranches_selected?.length ?? 0) > 0 ? true : null,
    filters.date_naissance_min || filters.date_naissance_max || (filters.age_presets_selected?.length ?? 0) > 0 ? true : null,
  ].filter(Boolean).length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <FiltersPanel
        filters={filters}
        onChange={handleFilterChange}
        totalResults={results?.total_results}
        callCount={callCount}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex-shrink-0">
          <div className="flex items-center justify-between gap-6">

            {/* Left — title + status */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-sm font-bold text-slate-900 tracking-tight">ProspectScan</h1>
                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-medium">Expertise Comptable</span>
                  {multiMode && (
                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 ring-1 ring-amber-200 px-2 py-0.5 rounded-md">
                      ⚡ {filters.keywords?.length} mots-clés
                    </span>
                  )}
                  {filters.siege_only && (
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 ring-1 ring-blue-200 px-2 py-0.5 rounded-md">Siège uniquement</span>
                  )}
                  {((filters.ca_tranches_selected?.length ?? 0) > 0 || filters.ca_min != null || filters.ca_max != null) && (
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-200 px-2 py-0.5 rounded-md">Filtre CA</span>
                  )}
                  {((filters.age_presets_selected?.length ?? 0) > 0 || filters.date_naissance_min || filters.date_naissance_max) && (
                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 ring-1 ring-amber-200 px-2 py-0.5 rounded-md">Filtre âge</span>
                  )}
                </div>
                <div className="mt-1">
                  {loading ? (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                      {multiMode ? 'Recherches parallèles en cours…' : 'Chargement…'}
                    </span>
                  ) : results ? (
                    <span className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">{results.total_results.toLocaleString('fr-FR')}</span>
                      {' '}{multiMode ? 'résultats estimés' : 'entreprises'}
                      {activeFilterCount > 0 && (
                        <span className="ml-2 text-blue-500">· {activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}</span>
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right — counters + export */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {favorites.size > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 ring-1 ring-amber-200 px-2.5 py-1.5 rounded-lg font-semibold">
                  ★ {favorites.size} favori{favorites.size > 1 ? 's' : ''}
                </span>
              )}
              {Object.keys(prospects).length > 0 && (
                <span className="text-xs text-violet-600 bg-violet-50 ring-1 ring-violet-200 px-2.5 py-1.5 rounded-lg font-semibold">
                  {Object.keys(prospects).length} prospect{Object.keys(prospects).length > 1 ? 's' : ''}
                </span>
              )}
              <ExportButton filters={filters} totalResults={results?.total_results || 0} />
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2 flex-shrink-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>{error}</span>
            <button onClick={() => load(filters)} className="ml-auto text-red-500 hover:text-red-700 font-semibold text-xs underline">
              Réessayer
            </button>
          </div>
        )}

        {/* Sort toolbar */}
        {!loading && (sortedCompanies.length > 0) && (
          <div className="px-5 py-2 border-b border-slate-100 bg-white flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Trier :</span>
            {([
              { mode: 'default', label: 'Par défaut',          icon: '↕' },
              { mode: 'age',     label: 'Âge dirigeant ↓',     icon: '👤' },
              { mode: 'ca',      label: 'CA ↓',                icon: '€'  },
              { mode: 'score',   label: 'Score M&A',           icon: '★'  },
            ] as const).map(s => (
              <button key={s.mode}
                onClick={() => setSortMode(s.mode)}
                className={`px-2.5 py-1 text-[11px] rounded-lg border transition font-medium flex items-center gap-1 ${
                  sortMode === s.mode
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
            {sortMode === 'score' && (
              <span className="ml-2 text-[10.5px] text-slate-400">
                Score = 65% âge + 35% CA · dirigeants les plus âgés avec le CA le plus élevé en premier
              </span>
            )}
            {sortMode === 'age' && (
              <span className="ml-2 text-[10.5px] text-slate-400">
                Dirigeants les plus âgés en premier · âge inconnu en fin de liste
              </span>
            )}
            {sortMode === 'ca' && (
              <span className="ml-2 text-[10.5px] text-slate-400">
                CA le plus élevé en premier · CA non déclaré en fin de liste
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <ResultsTable
            companies={sortedCompanies}
            loading={loading}
            favorites={favorites}
            prospects={prospects}
            onSelect={setSelectedCompany}
            onToggleFavorite={toggleFavorite}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />
        </div>

        {/* Pagination — masquée en mode multi-mots-clés (pagination approximative) */}
        {results && results.total_pages > 1 && (
          <Pagination
            currentPage={results.page}
            totalPages={results.total_pages}
            totalResults={results.total_results}
            perPage={multiMode ? results.results.length : results.per_page}
            onPageChange={page => setFilters(f => ({ ...f, page }))}
            approximated={multiMode}
          />
        )}
      </div>

      {selectedCompany && (
        <CompanyDrawer
          company={selectedCompany}
          isFavorite={favorites.has(selectedCompany.siren)}
          onToggleFavorite={() => toggleFavorite(selectedCompany.siren)}
          onClose={() => setSelectedCompany(null)}
          onProspectChange={handleProspectChange}
        />
      )}
    </div>
  );
}
