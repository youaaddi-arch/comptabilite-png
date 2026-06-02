# Archivage automatique 24h/24 — Gmail → Google Drive

Ce script **Google Apps Script** tourne chez Google, **même votre ordinateur et le logiciel fermés**.
Toutes les minutes, il lit la boîte `facture@parisnordgroupe.fr`, identifie (via l'IA Gemini) la
**société destinataire** et le **fournisseur** de chaque pièce jointe, et range le fichier dans le
Drive partagé selon l'arborescence :

```
Factures ▸ Société ▸ Année (exercice) ▸ Fournisseur ▸ facture.pdf
```

Les emails déjà traités reçoivent le libellé **`PNG-Archive`** : ils ne sont jamais retraités.

> 🔐 **Aucun mot de passe.** L'autorisation se fait par votre compte Google.
> Les fichiers utiles : `archivage-gmail-drive.gs` (le code) et `appsscript.json` (les permissions).

---

## Installation (≈ 10 min, une seule fois)

### 1. Créer le projet
1. Connectez-vous à **[script.google.com](https://script.google.com)** avec **`facture@parisnordgroupe.fr`**
   (le compte doit aussi avoir accès au Drive partagé, au moins en *Contributeur*).
2. Cliquez **« Nouveau projet »**.
3. Renommez-le `Compta PNG - Archivage` (en haut à gauche).

### 2. Coller le code
1. Effacez le contenu du fichier `Code.gs` affiché.
2. Ouvrez `archivage-gmail-drive.gs` (ce dossier), **copiez tout**, **collez** dans `Code.gs`.
3. En haut du code, remplacez `COLLEZ_VOTRE_CLE_GEMINI_ICI` par votre **clé Gemini**
   (la même que dans le logiciel — sinon : <https://aistudio.google.com/apikey>).
4. Vérifiez `DRIVE_ID` : il doit valoir `0ACMCgnt8fT87Uk9PVA` (l'ID de votre Drive partagé).
5. **Enregistrez** (icône disquette ou `Ctrl/Cmd + S`).

### 3. Déclarer les permissions
1. À gauche, cliquez l'icône ⚙ **« Paramètres du projet »**.
2. Cochez **« Afficher le fichier manifeste `appsscript.json` dans l'éditeur »**.
3. Revenez à l'éditeur (`< >`), ouvrez **`appsscript.json`**, remplacez son contenu par celui
   du fichier `appsscript.json` fourni ici, puis **Enregistrez**.

### 4. Premier essai + autorisation
1. En haut, dans la liste des fonctions, choisissez **`archiverFactures`**.
2. Cliquez **« Exécuter »** ▶.
3. Google demande l'autorisation → **« Examiner les autorisations »** → choisissez le compte
   `facture@…` → « Autoriser » (si un écran « Google n'a pas validé cette appli » apparaît :
   *Paramètres avancés → Accéder à … (non sécurisé)* — c'est **votre propre** script, c'est normal).
4. Regardez le journal (menu **« Exécution »** / `Ctrl+Enter`) : il liste les fichiers archivés.

### 5. Activer le 24h/24 (toutes les minutes)
1. Choisissez la fonction **`installerDeclencheur`** dans la liste.
2. Cliquez **« Exécuter »** ▶.
3. C'est fini : le script s'exécutera **automatiquement toutes les minutes**, à vie.

> Pour vérifier/supprimer le déclencheur plus tard : icône ⏰ **« Déclencheurs »** à gauche.

---

## Réglages utiles (en haut du script, objet `CONFIG`)

| Réglage | Rôle | Défaut |
|---|---|---|
| `GEMINI_KEY` | Clé de l'IA qui lit les factures | *(à renseigner)* |
| `DRIVE_ID` | Drive partagé cible | `0ACMCgnt8fT87Uk9PVA` |
| `RACINE` | Dossier racine dans le Drive | `Factures` |
| `GMAIL_QUERY` | Quels emails traiter | `has:attachment newer_than:30d` |
| `LABEL` | Libellé des emails traités | `PNG-Archive` |

---

## Bon à savoir

- **Société non reconnue** → le fichier va dans `Factures ▸ _A_TRIER ▸ …` (rien n'est perdu, vous triez à la main).
- **Quota Gemini** : l'offre gratuite a une limite journalière. En cas de gros volume, le script
  réessaie puis logge l'erreur ; les emails non traités le seront à l'exécution suivante (ils ne
  sont labellisés qu'après traitement de leurs pièces).
- **Ce script archive dans le Drive.** Il ne remplit pas tout seul la liste des factures *dans le
  logiciel* (qui, lui, stocke les données dans le navigateur). Les deux sont complémentaires :
  ouvrez le logiciel et lancez « Synchroniser » pour la saisie comptable, le Drive étant déjà rangé.
