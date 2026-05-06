'use client';

import { useState } from 'react';
import { SearchFilters } from '@/lib/types';
import {
  REGIONS, DEPARTEMENTS, TRANCHES_EFFECTIFS, FORMES_JURIDIQUES,
  APE_OPTIONS, KEYWORD_PRESETS, CA_TRANCHES, AGE_PRESETS,
} from '@/lib/constants';

interface Props {
  filters: SearchFilters;
  onChange: (f: Partial<SearchFilters>) => void;
  totalResults?: number;
  callCount?: number;
}

const inp = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-slate-400';

function Section({ label, children, badge }: { label: string; children: React.ReactNode; badge?: string }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
        {badge && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100" />;
}

function UserGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200 w-full max-w-lg max-h-[80vh] flex flex-col pointer-events-auto">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-900">Mode d&apos;emploi</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">ProspectScan — Expertise Comptable</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>
              Les informations utilisées dans l&apos;application proviennent de sources officielles : l&apos;INSEE, l&apos;INPI et data.gouv, accessibles via des API.
            </p>
            <p>
              La majorité des cabinets d&apos;expertise comptable est répertoriée sous le code APE/NAF 6920Z, qui constitue la base principale de la recherche. Pour capter les cabinets utilisant d&apos;autres codes NAF, un mot-clé « expert-comptable » est appliqué en complément et reste activé en permanence.
            </p>
            <p>
              En combinant ces critères avec le statut actif et le filtre siège uniquement, l&apos;application permet de couvrir plus de 90 % des cabinets d&apos;expertise comptable. Les cas non couverts correspondent principalement à des micro-cabinets libéraux ou à des structures mal catégorisées, notamment en raison d&apos;un code NAF inexact.
            </p>
            <p>
              Il est déconseillé d&apos;effectuer une recherche à l&apos;échelle nationale ; il est préférable de raisonner par région ou par département. Les requêtes sont limitées à 10 000 résultats, alors que le nombre total de cabinets d&apos;expertise comptable en France est estimé à environ 25 000.
            </p>
            <p>
              Les critères chiffre d&apos;affaires et âge du dirigeant peuvent être utilisés simultanément. Afin de ne pas exclure d&apos;entreprises pertinentes, celles pour lesquelles ces informations ne sont pas disponibles restent incluses dans les résultats.
            </p>
            <p>
              Concernant l&apos;âge du dirigeant, il est possible qu&apos;un résultat affiche un dirigeant dont l&apos;âge est inférieur au filtre sélectionné. Cela est normal : certaines entreprises comptent plusieurs dirigeants et la liste affiche uniquement le premier. En consultant la fiche de l&apos;entreprise, vous pourrez constater qu&apos;au moins un des dirigeants correspond bien à vos critères.
            </p>
            <p>
              Le score M&A repose sur une pondération entre l&apos;âge du dirigeant et le chiffre d&apos;affaires, selon la formule suivante : score = 65 % âge + 35 % chiffre d&apos;affaires. Les résultats sont ensuite classés en priorité selon les dirigeants les plus âgés et les entreprises générant le chiffre d&apos;affaires le plus élevé.
            </p>
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">
                Pour toute question :{' '}
                <a href="mailto:thomas.defendi@grenoble-em.com" className="text-blue-500 hover:text-blue-600 transition">
                  thomas.defendi@grenoble-em.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FiltersPanel({ filters, onChange, totalResults, callCount }: Props) {
  const [showGuide, setShowGuide] = useState(false);
  const filteredDepts = filters.region
    ? DEPARTEMENTS.filter(d => d.region === filters.region)
    : DEPARTEMENTS;

  const kws = filters.keywords || [];

  const toggleKeyword = (value: string) => {
    const next = kws.includes(value) ? kws.filter(k => k !== value) : [...kws, value];
    onChange({ keywords: next.length > 0 ? next : undefined, q: undefined });
  };

  const activeCount = [
    kws.length > 0 || filters.q,
    filters.use_ape === false ? true : null,
    filters.region,
    filters.departement,
    filters.siege_only ? true : null,
    filters.tranche_effectif,
    filters.nature_juridique,
    filters.etat_administratif !== 'A' ? true : null,
    filters.activite_principale !== '69.20Z' ? true : null,
    filters.ca_min != null || filters.ca_max != null || (filters.ca_tranches_selected?.length ?? 0) > 0 ? true : null,
    filters.date_naissance_min || filters.date_naissance_max || (filters.age_presets_selected?.length ?? 0) > 0 ? true : null,
  ].filter(Boolean).length;

  const reset = () => onChange({
    q: undefined, keywords: ['expert comptable'],
    use_ape: true, region: undefined, departement: undefined,
    tranche_effectif: undefined, nature_juridique: undefined,
    etat_administratif: 'A', activite_principale: '69.20Z',
    ca_min: undefined, ca_max: undefined, ca_tranches_selected: undefined,
    date_naissance_min: undefined, date_naissance_max: undefined, age_presets_selected: undefined,
    siege_only: undefined,
  });

  const selectedCaTranches = filters.ca_tranches_selected || [];
  const selectedAgePresets = filters.age_presets_selected || [];
  const hasCaFilter = filters.ca_min != null || filters.ca_max != null || selectedCaTranches.length > 0;
  const hasAgeFilter = !!(filters.date_naissance_min || filters.date_naissance_max) || selectedAgePresets.length > 0;

  const toggleCaTranche = (label: string) => {
    const next = selectedCaTranches.includes(label)
      ? selectedCaTranches.filter(l => l !== label)
      : [...selectedCaTranches, label];
    if (next.length === 0) {
      onChange({ ca_tranches_selected: undefined, ca_min: undefined, ca_max: undefined });
      return;
    }
    const sel = CA_TRANCHES.filter(t => next.includes(t.label));
    const hasNoMin = sel.some(t => t.min == null);
    const hasNoMax = sel.some(t => t.max == null);
    onChange({
      ca_tranches_selected: next,
      ca_min: hasNoMin ? undefined : Math.min(...sel.map(t => t.min!)),
      ca_max: hasNoMax ? undefined : Math.max(...sel.map(t => t.max!)),
    });
  };

  const toggleAgePreset = (label: string) => {
    const next = selectedAgePresets.includes(label)
      ? selectedAgePresets.filter(l => l !== label)
      : [...selectedAgePresets, label];
    if (next.length === 0) {
      onChange({ age_presets_selected: undefined, date_naissance_min: undefined, date_naissance_max: undefined });
      return;
    }
    const sel = AGE_PRESETS.filter(a => next.includes(a.label));
    const hasNoDobMin = sel.some(a => a.dobMin == null);
    const hasNoDobMax = sel.some(a => a.dobMax == null);
    onChange({
      age_presets_selected: next,
      date_naissance_min: hasNoDobMin ? undefined : [...sel.map(a => a.dobMin!)].sort()[0],
      date_naissance_max: hasNoDobMax ? undefined : [...sel.map(a => a.dobMax!)].sort().reverse()[0],
    });
  };

  return (
    <aside className="w-[268px] min-w-[268px] bg-white border-r border-slate-200 flex flex-col overflow-hidden">

      {/* Brand */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-[10px] tracking-tight">M&A</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 leading-tight">ProspectScan</p>
            <p className="text-[11px] text-slate-400 leading-tight">Expertise comptable</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {activeCount > 0 && (
            <button onClick={reset}
              className="flex-1 flex items-center justify-between text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 transition">
              <span>Réinitialiser filtres</span>
              <span className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{activeCount}</span>
            </button>
          )}
          {callCount != null && callCount > 1 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              {callCount}×
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Ciblage */}
        <Section label="Ciblage EC">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { val: true,  label: 'APE 69.20Z', sub: '~95% des EC' },
              { val: false, label: 'Sans APE',   sub: 'mots-clés only' },
            ].map(opt => (
              <button key={String(opt.val)}
                onClick={() => onChange({ use_ape: opt.val })}
                className={`py-2 px-2.5 text-left text-xs rounded-lg border transition ${
                  (filters.use_ape ?? true) === opt.val
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="block font-semibold leading-tight">{opt.label}</span>
                <span className="block text-[10px] leading-tight mt-0.5 opacity-70">{opt.sub}</span>
              </button>
            ))}
          </div>

          <div>
            <p className="text-[11px] text-slate-400 mb-1.5">Mots-clés <span className="text-blue-500">· union</span></p>
            <div className="flex flex-wrap gap-1 mb-2">
              {KEYWORD_PRESETS.map(kw => {
                const active = kws.includes(kw.value);
                return (
                  <button key={kw.value} onClick={() => toggleKeyword(kw.value)}
                    className={`px-2 py-0.5 text-[11px] rounded-md border transition font-medium ${
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 bg-white'
                    }`}
                  >
                    {active ? '✓ ' : ''}{kw.label}
                  </button>
                );
              })}
            </div>
            <input type="text" placeholder="Recherche libre..."
              value={filters.q || ''}
              onChange={e => onChange({ q: e.target.value || undefined, keywords: undefined })}
              className={inp}
            />
          </div>

          <a href="https://annuaire.experts-comptables.fr" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 transition">
            <span>↗</span><span>Annuaire OEC officiel</span>
          </a>
        </Section>

        <Divider />

        {/* Géographie */}
        <Section label="Géographie">
          <select value={filters.region || ''}
            onChange={e => onChange({ region: e.target.value || undefined, departement: undefined })}
            className={inp}>
            <option value="">Toutes les régions</option>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
          </select>
          <select value={filters.departement || ''}
            onChange={e => onChange({ departement: e.target.value || undefined })}
            className={inp}>
            <option value="">Tous les départements</option>
            {filteredDepts.map(d => <option key={d.code} value={d.code}>{d.code} — {d.nom}</option>)}
          </select>
          {(filters.region || filters.departement) && (
            <button
              onClick={() => onChange({ siege_only: !filters.siege_only })}
              className={`w-full py-1.5 px-3 text-xs rounded-lg border transition font-medium text-left flex items-center gap-2 ${
                filters.siege_only
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${filters.siege_only ? 'bg-white border-white' : 'border-slate-300'}`}>
                {filters.siege_only && <span className="text-blue-600 text-[10px] font-bold">✓</span>}
              </span>
              Siège social uniquement
            </button>
          )}
        </Section>

        <Divider />

        {/* CA */}
        <Section label="Chiffre d'affaires" badge="Gratuit">
          <div className="flex flex-wrap gap-1">
            {CA_TRANCHES.map(t => {
              const active = selectedCaTranches.includes(t.label);
              return (
                <button key={t.label} onClick={() => toggleCaTranche(t.label)}
                  className={`px-2 py-1 text-[11px] rounded-md border transition font-medium ${
                    active
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  {active ? '✓ ' : ''}{t.label}
                </button>
              );
            })}
          </div>

          {selectedCaTranches.length > 1 && (
            <p className="text-[11px] text-emerald-600 font-medium">
              Union · {selectedCaTranches.length} tranches sélectionnées
            </p>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <p className="text-[10px] text-slate-400 mb-1">Min manuel (€)</p>
              <input type="number" placeholder="500 000"
                value={selectedCaTranches.length > 0 ? '' : (filters.ca_min ?? '')}
                onChange={e => onChange({ ca_tranches_selected: undefined, ca_min: e.target.value ? Number(e.target.value) : undefined })}
                disabled={selectedCaTranches.length > 0}
                className={`${inp} disabled:opacity-40 disabled:cursor-not-allowed`}
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1">Max manuel (€)</p>
              <input type="number" placeholder="5 000 000"
                value={selectedCaTranches.length > 0 ? '' : (filters.ca_max ?? '')}
                onChange={e => onChange({ ca_tranches_selected: undefined, ca_max: e.target.value ? Number(e.target.value) : undefined })}
                disabled={selectedCaTranches.length > 0}
                className={`${inp} disabled:opacity-40 disabled:cursor-not-allowed`}
              />
            </div>
          </div>

          {hasCaFilter && (
            <button onClick={() => onChange({ ca_tranches_selected: undefined, ca_min: undefined, ca_max: undefined })}
              className="text-[11px] text-slate-400 hover:text-slate-600 transition flex items-center gap-1">
              <span>✕</span> Effacer
            </button>
          )}
          <p className="text-[10.5px] text-slate-400 leading-relaxed">
            Cabinets sans CA déclaré inclus automatiquement.
          </p>
        </Section>

        <Divider />

        {/* Âge dirigeant */}
        <Section label="Âge du dirigeant" badge="Gratuit">
          <div className="flex flex-wrap gap-1">
            {AGE_PRESETS.map(a => {
              const active = selectedAgePresets.includes(a.label);
              return (
                <button key={a.label} onClick={() => toggleAgePreset(a.label)}
                  className={`px-2 py-1 text-[11px] rounded-md border transition font-medium ${
                    active
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-600'
                  }`}
                >
                  {active ? '✓ ' : ''}{a.label}
                </button>
              );
            })}
          </div>

          {selectedAgePresets.length > 1 && (
            <p className="text-[11px] text-amber-600 font-medium">
              Union · {selectedAgePresets.length} tranches sélectionnées
            </p>
          )}

          {hasAgeFilter && (
            <button onClick={() => onChange({ age_presets_selected: undefined, date_naissance_min: undefined, date_naissance_max: undefined })}
              className="text-[11px] text-slate-400 hover:text-slate-600 transition flex items-center gap-1">
              <span>✕</span> Effacer
            </button>
          )}
          <p className="text-[10.5px] text-slate-400 leading-relaxed">
            Dirigeants sans date de naissance inclus automatiquement.
          </p>
        </Section>

        <Divider />

        {/* Structure */}
        <Section label="Structure">
          <select value={filters.activite_principale || '69.20Z'}
            onChange={e => onChange({ activite_principale: e.target.value })}
            className={inp}>
            {APE_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
          <select value={filters.tranche_effectif || ''}
            onChange={e => onChange({ tranche_effectif: e.target.value || undefined })}
            className={inp}>
            <option value="">Tous les effectifs</option>
            {TRANCHES_EFFECTIFS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
          <select value={filters.nature_juridique || ''}
            onChange={e => onChange({ nature_juridique: e.target.value || undefined })}
            className={inp}>
            <option value="">Toutes les formes juridiques</option>
            {FORMES_JURIDIQUES.map(f => <option key={f.code} value={f.code}>{f.label}</option>)}
          </select>
        </Section>

        <Divider />

        {/* Statut */}
        <Section label="Statut">
          <div className="grid grid-cols-3 gap-1.5">
            {[{ code: 'A', label: 'Actifs' }, { code: 'C', label: 'Fermés' }, { code: '', label: 'Tous' }].map(s => (
              <button key={s.code}
                onClick={() => onChange({ etat_administratif: s.code || undefined })}
                className={`py-1.5 text-xs rounded-lg border transition font-medium ${
                  (filters.etat_administratif || '') === s.code
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >{s.label}</button>
            ))}
          </div>
        </Section>

        <Divider />

        {/* Logic note */}
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 space-y-1.5">
          <p className="text-[10.5px] font-semibold text-slate-500">Logique de recherche</p>
          <p className="text-[10.5px] text-slate-400 leading-relaxed">
            APE + mots-clés en <span className="font-semibold text-slate-500">union</span>. CA et âge filtres server-side natifs — gratuits.
          </p>
          <a href="https://annuaire.experts-comptables.fr" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10.5px] text-blue-500 hover:text-blue-600 transition">
            ↗ Annuaire OEC officiel
          </a>
        </div>

      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 space-y-2">
        <button
          onClick={() => setShowGuide(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Mode d&apos;emploi
        </button>
        <p className="text-[10.5px] text-slate-400">INSEE · INPI · data.gouv.fr</p>
        {totalResults !== undefined && (
          <p className="text-sm font-semibold text-slate-800">
            {totalResults.toLocaleString('fr-FR')}
            <span className="text-xs font-normal text-slate-400 ml-1">résultats</span>
          </p>
        )}
      </div>

      {showGuide && <UserGuideModal onClose={() => setShowGuide(false)} />}
    </aside>
  );
}
