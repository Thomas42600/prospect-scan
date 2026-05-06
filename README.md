# M&A Scanner — Cabinets d'Expertise Comptable

Application de prospection pour fusions-acquisitions.  
Données en temps réel depuis l'API officielle INSEE/INPI (gratuite, sans clé).

## Installation en 3 étapes

### 1. Installer Node.js (une seule fois)

Ouvre le Terminal et colle cette commande :

```bash
# Installer Homebrew si pas encore fait
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Puis installer Node.js
brew install node
```

Ou télécharge directement sur https://nodejs.org (version LTS)

### 2. Installer les dépendances

```bash
cd ~/prospect-ma
npm install
```

### 3. Lancer l'application

```bash
npm run dev
```

Ouvre ensuite http://localhost:3000 dans ton navigateur.

---

## Fonctionnalités

| Feature | Description |
|---------|-------------|
| **Filtres** | Région, Département, Effectifs, Forme juridique, Statut |
| **Code APE** | 69.20Z (comptable) par défaut, modifiable |
| **Tableau** | Nom, SIREN, Ville, Forme, Effectifs, Dirigeant |
| **Favoris** | Marque les cabinets d'intérêt (★) |
| **Fiche prospect** | Statut M&A (Contacté / Qualifié / En cours…), notes libres |
| **Export CSV** | 25 à 5 000 résultats, avec en-têtes, encodage FR |
| **Liens** | Pappers, Annuaire officiel, Infogreffe, Societe.com |

## Données disponibles (API gratuite)

- SIREN, dénomination sociale
- Adresse du siège
- Forme juridique
- Dirigeants (nom, prénom, qualité)
- Tranche d'effectifs
- Date de création
- Code APE / NAF
- Nombre d'établissements

## Données financières (étape 2)

Pour le CA exact, l'EBITDA et les bilans :  
→ Cliquer sur une entreprise → bouton **Pappers**  
→ API Pappers gratuite (10 000 appels/mois) sur pappers.fr/api

## Source

API Recherche d'Entreprises — data.gouv.fr  
Aucune clé requise · Données mise à jour en continu
