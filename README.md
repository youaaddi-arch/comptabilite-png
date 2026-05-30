# Compta PNG — Comptabilité Groupe Paris Nord

Plateforme de comptabilité **type Pennylane / Yooz**, conçue pour le **Groupe Paris Nord**
et ses **40 entités** (DEFIS, PNBS, DBS, PNFF, AFPEC, PBA, Poly Langues, ORCEA, ELFE,
Qualifforma, ILEF…).

Prototype **fonctionnel**, sans build ni installation : application web autonome
(HTML / CSS / JavaScript) avec Tailwind et Chart.js chargés via CDN. Les données sont
persistées dans le navigateur (`localStorage`).

## ✨ Fonctionnalités

| Module | Description |
|--------|-------------|
| **Tableau de bord** | KPI quotidiens : trésorerie groupe, encaissements / décaissements du jour, taux de rapprochement, factures à traiter, CA, TVA. Graphiques flux 7 jours, répartition financeurs, CA par société. |
| **Factures (OCR)** | Capture de factures fournisseurs → **océrisation** simulée → **reconnaissance automatique de la société** du groupe (par SIRET de chaque établissement / SIREN / raison sociale / adresse) → **affectation au plan comptable** → **écriture en brouillon** → comptabilisation. |
| **Banque & rapprochement** | Écritures bancaires quotidiennes, distinction **encaissement / décaissement par société**, **rapprochement bancaire** automatique et manuel (lettrage facture ↔ décaissement, dossier ↔ encaissement). |
| **TVA** | Calcul de la **TVA collectée et déductible** par société, statut d'assujettissement, solde à décaisser / crédit de TVA, exonération formation professionnelle (art. 261-4-4° CGI). |
| **Financements / ERP** | Dossiers de financement avec numéros **OPCO**, **CPF** (Caisse des Dépôts), **France Travail (POEI)**, Région, entreprise. Suivi facturation / encaissement. |
| **Sociétés** | Référentiel officiel des **40 entités** du groupe. **Une société = un SIREN** ; le siège et les établissements partagent le même SIREN (SIRET = SIREN + NIC). |
| **Plan comptable** | Plan Comptable Général (PCG) utilisé pour l'affectation automatique. |

## 🏢 Modèle sociétés : 1 SIREN = 1 société

Chaque société est une **entité juridique unique identifiée par son SIREN**. Le **siège**
et les **établissements secondaires** appartiennent à la même société et partagent ce
SIREN ; seul le **SIRET** (= SIREN + 5 chiffres NIC) diffère d'un établissement à l'autre.

Exemple : **DBS** (SIREN `815091764`) regroupe Paris `…044` (siège), Lyon `…085`,
Lille `…077`, Marseille `…069`, Toulouse `…051`. La reconnaissance OCR accepte le SIRET
de **n'importe quel établissement** pour retrouver la bonne société.

## 🚀 Lancer l'application

L'application est statique. Le plus simple, **depuis la racine du dépôt** :

```bash
python3 -m http.server 8000
```

Puis ouvrir **http://localhost:8000** dans le navigateur.

> ⚠️ Ne collez pas le commentaire `# puis http://localhost:8000` dans le terminal : tapez
> uniquement `python3 -m http.server 8000`.

> Une connexion internet est nécessaire **côté navigateur** (chargement de Tailwind et
> Chart.js depuis leurs CDN). Aucune installation côté serveur.

Déploiement : n'importe quel hébergement statique (Vercel, Netlify, GitHub Pages…),
il suffit de servir le dossier tel quel.

## 🧪 Démonstration rapide

1. **Factures → « Déposer / scanner une facture »** : l'OCR extrait les champs, reconnaît
   la société (avec un score de confiance) et propose l'écriture en brouillon. Validez ou
   comptabilisez.
2. **Banque → « Rapprochement automatique »** : les écritures sont lettrées avec les
   factures (décaissements) et les dossiers de financement (encaissements). Le taux de
   rapprochement et la trésorerie se mettent à jour.
3. **TVA / Tableau de bord** : les indicateurs se recalculent en temps réel.

## 🗂️ Architecture

```
index.html               Mise en page (sidebar, header, conteneurs)
assets/css/app.css       Styles complémentaires
assets/js/
  data.js                Référentiel des 40 sociétés, plan comptable, fournisseurs, financeurs
  seed.js                Jeu de données de démonstration (mai 2026)
  utils.js               Formatage FR, moteur de reconnaissance OCR, calcul TVA
  store.js               État, persistance localStorage, actions, calcul des KPI
  views.js               Rendu HTML de chaque module
  app.js                 Routeur (hash), navigation, interactions
```

## 🔌 Brancher les vraies intégrations (étapes suivantes)

- **OCR réel** : remplacer `store.scanNouvelleFacture()` par un appel à un service d'OCR
  (Mindee, Google Document AI, AWS Textract, Klippa…).
- **Banque** : remplacer le jeu d'écritures par une synchro **agrégation bancaire**
  (Bridge, Powens/Budget Insight, GoCardless, ou import CAMT.053 / OFX).
- **ERP** : connecter l'API de l'ERP de facturation (numéros OPCO / dossiers CPF / POEI
  France Travail) en alimentant `store.dossiers`.
- **Export comptable** : générer un FEC / écritures vers le logiciel de production
  (Pennylane API, Cegid, ACD, etc.).

## ⚠️ Notes

- Les montants, dossiers stagiaires et écritures bancaires sont **fictifs** (démonstration).
- Les informations sociétés (SIREN/SIRET/représentant/TVA) proviennent du référentiel
  officiel fourni par le groupe (40 entités) ; complétez les entités « en cours »
  (PNBS Toulouse, PNBS Montpellier, Activ Permis, Bodi Formation).
- Le calcul de TVA est simplifié à des fins de prototypage et ne se substitue pas à une
  déclaration officielle.
