export interface SearchFilters {
  q?: string;
  keywords?: string[];          // multi-select presets — OR logic, parallel calls
  use_ape?: boolean;            // include APE search (independently of keywords)
  departement?: string;
  region?: string;
  tranche_effectif?: string;
  nature_juridique?: string;
  activite_principale?: string;
  etat_administratif?: string;
  page: number;
  per_page: number;
  // Filtres financiers natifs (gratuits, API gouvernementale)
  ca_min?: number;                      // CA minimum en €
  ca_max?: number;                      // CA maximum en €
  // Filtres âge dirigeant — via date de naissance (format ISO: "YYYY-MM-DD")
  date_naissance_min?: string;          // ex: "1955-01-01"
  date_naissance_max?: string;          // ex: "1975-12-31"
  // Multi-select tranches (labels) — union calculée en min/max effectif
  ca_tranches_selected?: string[];
  age_presets_selected?: string[];
  // Filtre siège uniquement (client-side)
  siege_only?: boolean;
}

export interface Siege {
  siret: string;
  activite_principale: string;
  libelle_activite_principale: string;
  adresse: string;
  code_postal: string;
  libelle_commune: string;
  commune: string;
  departement: string;
  region: string;
  tranche_effectif_salarie?: string;
  date_creation?: string;
  etat_administratif?: string;
  latitude?: number;
  longitude?: number;
}

export interface Dirigeant {
  nom: string;
  prenoms?: string;
  qualite?: string;
  type?: string;
  type_dirigeant?: string;
  denomination?: string;
  siren?: string;
  date_de_naissance?: string;    // format "YYYY-MM" (jour masqué, INPI)
  annee_de_naissance?: string;   // format "YYYY"
}

export interface Finances {
  ca?: number;
  resultat_net?: number;
  annee?: number;
}

export interface Company {
  siren: string;
  nom_complet: string;
  nom_raison_sociale: string;
  nature_juridique: string;
  libelle_nature_juridique?: string;
  tranche_effectif_salarie?: string;
  libelle_tranche_effectif?: string;
  date_creation?: string;
  etat_administratif?: string;
  activite_principale?: string;
  siege: Siege;
  dirigeants: Dirigeant[];
  finances?: Finances;
  nombre_etablissements?: number;
  nombre_etablissements_ouverts?: number;
  matching_etablissements?: Siege[];
}

export interface SearchResult {
  results: Company[];
  total_results: number;
  page: number;
  per_page: number;
  total_pages: number;
}
