'use client';

import { Company } from '@/lib/types';
import { TRANCHE_LABEL } from '@/lib/constants';
import { useState, useEffect } from 'react';

interface Props {
  company: Company;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onProspectChange: (siren: string, statut: string) => void;
}

const PROSPECT_STATUTS = [
  { code: 'new',      label: 'Nouveau',    color: 'bg-slate-100 text-slate-600',    active: 'bg-slate-700 text-white' },
  { code: 'contacted',label: 'Contacté',   color: 'bg-blue-50 text-blue-600',       active: 'bg-blue-600 text-white' },
  { code: 'qualified', label: 'Qualifié',  color: 'bg-amber-50 text-amber-600',     active: 'bg-amber-500 text-white' },
  { code: 'ongoing',  label: 'En cours',   color: 'bg-violet-50 text-violet-600',   active: 'bg-violet-600 text-white' },
  { code: 'closed',   label: 'Converti ✓', color: 'bg-emerald-50 text-emerald-600', active: 'bg-emerald-600 text-white' },
  { code: 'rejected', label: 'Abandonné',  color: 'bg-red-50 text-red-500',         active: 'bg-red-500 text-white' },
];

function InfoCard({ label, value, sub }: { label: string; value?: string | null; sub?: string }) {
  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg">
      <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-words leading-snug">{value || <span className="text-slate-300">—</span>}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ExternalLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition group">
      <div className="w-7 h-7 rounded-md bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition">
        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition">{label}</p>
        <p className="text-[11px] text-slate-400">{desc}</p>
      </div>
    </a>
  );
}

type RneDirigeant = { nom: string; prenom: string; qualite: string; dateNaissance: string; annee: number | null };

export default function CompanyDrawer({ company, isFavorite, onToggleFavorite, onClose, onProspectChange }: Props) {
  const [notes, setNotes] = useState('');
  const [statut, setStatut] = useState('new');
  const [rneData, setRneData] = useState<RneDirigeant[] | null>(null);
  const [rneLoading, setRneLoading] = useState(false);
  const [rneError, setRneError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(localStorage.getItem(`notes_${company.siren}`) || '');
    setStatut(localStorage.getItem(`statut_${company.siren}`) || 'new');
    // Load cached RNE data
    try {
      const cached = localStorage.getItem(`rne_${company.siren}`);
      if (cached) setRneData(JSON.parse(cached));
    } catch { /* ignore */ }
    setRneError(null);
  }, [company.siren]);

  const enrichFromRne = async () => {
    setRneLoading(true);
    setRneError(null);
    try {
      const res = await fetch(`/api/enrich?siren=${company.siren}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setRneData(data.dirigeants || []);
      localStorage.setItem(`rne_${company.siren}`, JSON.stringify(data.dirigeants || []));
    } catch (e) {
      setRneError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setRneLoading(false);
    }
  };

  // Merge: for each original dirigeant, find a matching RNE entry by name
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const findRneMatch = (nom: string, prenom: string): RneDirigeant | null => {
    if (!rneData) return null;
    const target = normalize(nom + prenom);
    return rneData.find(r => {
      const rKey = normalize(r.nom + r.prenom);
      return rKey && target && (rKey.includes(normalize(nom)) || normalize(nom).includes(normalize(r.nom)));
    }) || null;
  };

  const saveNotes = (val: string) => {
    setNotes(val);
    localStorage.setItem(`notes_${company.siren}`, val);
  };

  const saveStatut = (val: string) => {
    setStatut(val);
    localStorage.setItem(`statut_${company.siren}`, val);
    onProspectChange(company.siren, val === 'new' ? '' : val);
  };

  const siege = company.siege;
  const slug = company.nom_complet.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const currentStatut = PROSPECT_STATUTS.find(s => s.code === statut);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] z-40" onClick={onClose} />

      <aside className="fixed right-0 top-0 h-full w-[580px] bg-white shadow-2xl shadow-slate-900/10 z-50 flex flex-col border-l border-slate-200">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  company.etat_administratif === 'A'
                    ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                    : 'bg-red-50 text-red-500 ring-1 ring-red-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${company.etat_administratif === 'A' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  {company.etat_administratif === 'A' ? 'Actif' : 'Inactif'}
                </span>
                <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                  {company.siren}
                </span>
                {currentStatut && statut !== 'new' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${currentStatut.color}`}>
                    {currentStatut.label}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{company.nom_complet}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{company.libelle_nature_juridique || company.nature_juridique}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={onToggleFavorite}
                className={`p-2 rounded-lg text-lg transition ${
                  isFavorite ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:text-amber-400 hover:bg-slate-50'
                }`}
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                ★
              </button>
              <button onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Prospect pipeline */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Pipeline de prospection</p>
            <div className="flex flex-wrap gap-1.5">
              {PROSPECT_STATUTS.map(s => (
                <button key={s.code} onClick={() => saveStatut(s.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    statut === s.code ? s.active : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">

            {/* Infos principales */}
            <div>
              <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Informations</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <InfoCard
                    label="Siège social"
                    value={siege?.adresse}
                    sub={[siege?.code_postal, siege?.libelle_commune].filter(Boolean).join(' ')}
                  />
                </div>
                <InfoCard label="Département" value={siege?.departement || null} />
                <InfoCard label="Tranche effectifs" value={TRANCHE_LABEL[company.tranche_effectif_salarie || ''] || company.tranche_effectif_salarie} />
                <InfoCard label="Date de création"
                  value={company.date_creation ? new Date(company.date_creation).toLocaleDateString('fr-FR') : null}
                />
                <InfoCard label="Code APE" value={siege?.activite_principale} sub={siege?.libelle_activite_principale} />
                <InfoCard label="Établissements actifs"
                  value={company.nombre_etablissements_ouverts != null ? String(company.nombre_etablissements_ouverts) : null}
                />
                <InfoCard label="Total établissements"
                  value={company.nombre_etablissements != null ? String(company.nombre_etablissements) : null}
                />
              </div>
            </div>

            {/* Dirigeants */}
            {company.dirigeants && company.dirigeants.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                    Dirigeants <span className="text-slate-300 font-normal">({company.dirigeants.length})</span>
                  </p>
                  <button
                    onClick={enrichFromRne}
                    disabled={rneLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition ${
                      rneData
                        ? 'border-emerald-200 text-emerald-600 bg-emerald-50'
                        : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 bg-white'
                    } disabled:opacity-50`}
                  >
                    {rneLoading ? (
                      <><span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />Chargement…</>
                    ) : rneData ? (
                      <>✓ Enrichi via INPI RNE</>
                    ) : (
                      <>↗ Enrichir via INPI RNE</>
                    )}
                  </button>
                </div>

                {rneError && (
                  <p className="text-[11px] text-red-500 mb-2 p-2 bg-red-50 rounded-lg">{rneError}</p>
                )}

                <div className="space-y-2">
                  {company.dirigeants.map((d, i) => {
                    const name = d.denomination || [d.prenoms, d.nom].filter(Boolean).join(' ');
                    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

                    // Birth year: from original data OR from RNE enrichment
                    const originalBirthYear = (d.date_de_naissance || d.annee_de_naissance || '').match(/(\d{4})/)?.[1];
                    const rneMatch = !originalBirthYear ? findRneMatch(d.nom || '', d.prenoms || '') : null;
                    const birthYear = originalBirthYear || (rneMatch?.annee ? String(rneMatch.annee) : null);
                    const isRneEnriched = !originalBirthYear && !!rneMatch;

                    const age = birthYear ? new Date().getFullYear() - parseInt(birthYear) : null;
                    const ageColor = age
                      ? age >= 65 ? 'text-red-500' : age >= 60 ? 'text-amber-500' : age >= 50 ? 'text-amber-400' : 'text-slate-400'
                      : '';
                    return (
                      <div key={i} className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${isRneEnriched ? 'border-emerald-200' : 'border-slate-200'}`}>
                        <div className="w-9 h-9 flex-shrink-0 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold">
                          {initials || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{name || '—'}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-slate-400">{d.qualite || d.type_dirigeant || d.type}</span>
                            {age && (
                              <span className={`text-[11px] font-bold ${ageColor}`}>
                                · {age} ans{age >= 65 ? ' 🎯' : age >= 60 ? ' ★' : ''}
                              </span>
                            )}
                          </div>
                          {birthYear && (
                            <p className="text-[11px] mt-0.5 flex items-center gap-1">
                              <span className="text-slate-400">né·e en {birthYear}</span>
                              {isRneEnriched && <span className="text-emerald-600 font-medium">· via INPI RNE</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* RNE-only dirigeants (found in RNE but not in original list) */}
                  {rneData && rneData.filter(r => {
                    return !company.dirigeants.some(d =>
                      normalize(d.nom || '').includes(normalize(r.nom)) || normalize(r.nom).includes(normalize(d.nom || ''))
                    );
                  }).map((r, i) => {
                    const age = r.annee ? new Date().getFullYear() - r.annee : null;
                    const ageColor = age
                      ? age >= 65 ? 'text-red-500' : age >= 60 ? 'text-amber-500' : age >= 50 ? 'text-amber-400' : 'text-slate-400'
                      : '';
                    return (
                      <div key={`rne-${i}`} className="flex items-center gap-3 p-3 bg-white border border-emerald-200 rounded-lg">
                        <div className="w-9 h-9 flex-shrink-0 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">
                          {(r.nom[0] || '') + (r.prenom[0] || '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{[r.prenom, r.nom].filter(Boolean).join(' ')}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400">{r.qualite}</span>
                            {age && <span className={`text-[11px] font-bold ${ageColor}`}>· {age} ans</span>}
                          </div>
                          {r.annee && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              né·e en {r.annee} <span className="text-emerald-600 font-medium">· via INPI RNE</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Finances */}
            {company.finances && (company.finances.ca || company.finances.resultat_net) && (
              <div>
                <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Données financières
                  {company.finances.annee && <span className="ml-1 text-slate-300 font-normal">({company.finances.annee})</span>}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {company.finances.ca && (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Chiffre d&apos;affaires</p>
                      <p className="text-base font-bold text-slate-900">
                        {(company.finances.ca / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k€
                      </p>
                    </div>
                  )}
                  {company.finances.resultat_net && (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Résultat net</p>
                      <p className={`text-base font-bold ${company.finances.resultat_net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {(company.finances.resultat_net / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k€
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Pour les bilans complets, consultez Pappers ci-dessous.
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Notes internes</p>
              <textarea
                value={notes}
                onChange={e => saveNotes(e.target.value)}
                placeholder="Contact rencontré, CA estimé, intérêt stratégique, prochaine étape..."
                rows={4}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
              />
              <p className="text-[10.5px] text-slate-400 mt-1">Sauvegardé automatiquement.</p>
            </div>

            {/* Liens externes */}
            <div>
              <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Sources & données</p>
              <div className="grid grid-cols-2 gap-2">
                <ExternalLink href={`https://www.pappers.fr/entreprise/${slug}-${company.siren}`} label="Pappers" desc="Bilans, CA, actionnaires" />
                <ExternalLink href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${company.siren}`} label="Annuaire officiel" desc="data.gouv.fr" />
                <ExternalLink href={`https://www.infogreffe.fr/entreprise-societe/${company.siren}`} label="Infogreffe" desc="Registre du commerce" />
                <ExternalLink href={`https://www.societe.com/societe/${slug}-${company.siren}.html`} label="Societe.com" desc="Informations générales" />
              </div>
            </div>

          </div>
        </div>
      </aside>
    </>
  );
}
