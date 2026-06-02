/* =====================================================================
 * Compta PNG — Connexion Google (Gmail + Drive), 100% navigateur
 * ---------------------------------------------------------------------
 * Lit la boîte Gmail de collecte (ex. facture@parisnordgroupe.fr), prend
 * TOUTES les pièces jointes (PDF / images), les passe dans l'OCR existant
 * (PNG.ocr), crée la facture dans le logiciel, PUIS archive le fichier
 * d'origine dans le Drive partagé avec l'arborescence :
 *      Société (exercice)  ▸  Année  ▸  Fournisseur  ▸  facture
 *
 * Sécurité : AUCUN mot de passe n'est stocké. L'accès se fait par OAuth
 * Google (autorisation en 1 clic). Seul l'identifiant client OAuth (public)
 * est conservé sur le navigateur (localStorage). Jeton d'accès en mémoire.
 *
 * Pré-requis (à faire une fois côté Google Cloud) :
 *   1. console.cloud.google.com → créer un projet
 *   2. Activer « Gmail API » et « Google Drive API »
 *   3. Écran de consentement OAuth (externe) → ajouter votre adresse en
 *      « utilisateur de test »
 *   4. Identifiants → créer un « ID client OAuth » de type « Application Web »
 *      → Origines JavaScript autorisées : l'URL où vous ouvrez l'appli
 *        (ex. http://localhost:8000)
 *   5. Coller l'ID client dans l'appli (Collecte → Connexion Google)
 * ===================================================================== */
window.PNG = window.PNG || {};

PNG.google = (function () {
  const CFG_KEY = "compta-png-google-cfg";
  const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive",
  ].join(" ");

  // Drive partagé du Groupe (extrait du lien fourni) — modifiable dans l'UI
  const DRIVE_DEFAUT = "0ACMCgnt8fT87Uk9PVA";

  function getCfg() {
    const def = {
      clientId: "",
      driveId: DRIVE_DEFAUT,        // racine du Drive partagé
      racineNom: "Factures",        // sous-dossier racine créé dans le Drive partagé
      query: "has:attachment newer_than:60d",
      autoSync: false,             // synchro auto périodique (tant que l'onglet est ouvert)
      autoSyncMin: 5,              // intervalle en minutes
      processed: [],                // ids de messages Gmail déjà traités (anti-doublon)
    };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); }
    catch (e) { return def; }
  }
  function setCfg(c) {
    const cur = getCfg();
    try { localStorage.setItem(CFG_KEY, JSON.stringify(Object.assign(cur, c))); } catch (e) {}
  }
  function marquerTraite(id) {
    const c = getCfg();
    if (!c.processed.includes(id)) {
      c.processed.push(id);
      if (c.processed.length > 3000) c.processed = c.processed.slice(-3000);
      setCfg({ processed: c.processed });
    }
  }

  /* ----------------------- OAuth (Google Identity Services) ---------- */
  let _token = null;          // jeton d'accès en mémoire
  let _tokenClient = null;
  let _email = null;          // adresse connectée

  const gisPret = () => !!(window.google && google.accounts && google.accounts.oauth2);
  const isConnected = () => !!_token;
  const compteConnecte = () => _email;

  function connect() {
    return new Promise((resolve, reject) => {
      const cfg = getCfg();
      if (!cfg.clientId) return reject(new Error("Identifiant client OAuth manquant (à coller dans la configuration)."));
      if (!gisPret()) return reject(new Error("Bibliothèque Google non chargée — vérifiez votre connexion internet puis rechargez la page."));
      try {
        _tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: cfg.clientId,
          scope: SCOPES,
          callback: (resp) => {
            if (resp && resp.access_token) {
              _token = resp.access_token;
              // récupère l'adresse connectée (pour affichage)
              fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: authH() })
                .then((r) => r.ok ? r.json() : null)
                .then((p) => { if (p && p.emailAddress) _email = p.emailAddress; resolve({ token: _token, email: _email }); })
                .catch(() => resolve({ token: _token, email: null }));
            } else {
              reject(new Error((resp && resp.error) ? resp.error : "Autorisation refusée"));
            }
          },
          error_callback: (err) => reject(new Error((err && err.message) || "Connexion Google annulée")),
        });
        _tokenClient.requestAccessToken({ prompt: _token ? "" : "consent" });
      } catch (e) { reject(e); }
    });
  }
  function authH() { return { Authorization: "Bearer " + _token }; }

  // Relance une requête si le jeton a expiré (401)
  async function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers || {}, authH());
    let r = await fetch(url, opts);
    if (r.status === 401) {
      await connect();
      opts.headers = Object.assign({}, opts.headers || {}, authH());
      r = await fetch(url, opts);
    }
    return r;
  }

  /* ----------------------------- Gmail ------------------------------- */
  function b64urlToBytes(data) {
    const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  function header(headers, nom) {
    const h = (headers || []).find((x) => x.name.toLowerCase() === nom.toLowerCase());
    return h ? h.value : "";
  }
  // Parcourt récursivement les parts d'un message → liste des PJ exploitables
  function collecterPieces(payload, out) {
    out = out || [];
    if (!payload) return out;
    const mime = (payload.mimeType || "").toLowerCase();
    const filename = payload.filename || "";
    const dispo = header(payload.headers, "Content-Disposition").toLowerCase();
    const estPDF = mime === "application/pdf" || /\.pdf$/i.test(filename);
    const estImg = /^image\/(png|jpe?g|jpg|tiff?|webp|heic)$/.test(mime) || /\.(png|jpe?g|tiff?|webp|heic)$/i.test(filename);
    if (filename && payload.body && payload.body.attachmentId && (estPDF || estImg)) {
      // ignore les images "inline" (logos de signature) ; garde tous les PDF
      const inline = dispo.indexOf("inline") >= 0;
      const tropPetit = estImg && payload.body.size && payload.body.size < 15000;
      if (!(estImg && (inline || tropPetit))) {
        out.push({ filename, mimeType: mime || (estPDF ? "application/pdf" : "image/png"), attachmentId: payload.body.attachmentId });
      }
    }
    (payload.parts || []).forEach((p) => collecterPieces(p, out));
    return out;
  }

  async function listerMessages(query, max) {
    const out = [];
    let pageToken = "";
    do {
      const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50"
        + "&q=" + encodeURIComponent(query || "has:attachment")
        + (pageToken ? "&pageToken=" + pageToken : "");
      const r = await api(url);
      if (!r.ok) throw new Error("Gmail HTTP " + r.status + " — " + (await r.text()).slice(0, 200));
      const j = await r.json();
      (j.messages || []).forEach((m) => out.push(m));
      pageToken = j.nextPageToken || "";
    } while (pageToken && out.length < (max || 100));
    return out.slice(0, max || 100);
  }

  async function lireMessage(id) {
    const r = await api("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + id + "?format=full");
    if (!r.ok) throw new Error("Gmail message HTTP " + r.status);
    return r.json();
  }

  async function telechargerPiece(messageId, attachmentId) {
    const r = await api("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + messageId + "/attachments/" + attachmentId);
    if (!r.ok) throw new Error("Pièce jointe HTTP " + r.status);
    const j = await r.json();
    return b64urlToBytes(j.data);
  }

  /* ----------------------------- Drive ------------------------------- */
  const _folderCache = {};   // clé "parent/nom" -> id (évite les recherches répétées)
  function echapper(s) { return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
  function nomDossier(s) { return String(s || "Divers").replace(/[\/\\]+/g, "-").replace(/\s{2,}/g, " ").trim().slice(0, 120) || "Divers"; }

  async function trouverDossier(nom, parentId, driveId) {
    const q = "mimeType='application/vnd.google-apps.folder' and trashed=false"
      + " and name='" + echapper(nom) + "' and '" + parentId + "' in parents";
    const url = "https://www.googleapis.com/drive/v3/files?fields=files(id,name)"
      + "&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=" + encodeURIComponent(driveId)
      + "&q=" + encodeURIComponent(q);
    const r = await api(url);
    if (!r.ok) throw new Error("Drive recherche HTTP " + r.status + " — " + (await r.text()).slice(0, 200));
    const j = await r.json();
    return (j.files && j.files[0]) ? j.files[0].id : null;
  }
  async function creerDossier(nom, parentId) {
    const r = await api("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nom, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    });
    if (!r.ok) throw new Error("Drive création dossier HTTP " + r.status + " — " + (await r.text()).slice(0, 200));
    return (await r.json()).id;
  }
  async function assurerDossier(nom, parentId, driveId) {
    nom = nomDossier(nom);
    const cle = parentId + "/" + nom;
    if (_folderCache[cle]) return _folderCache[cle];
    let id = await trouverDossier(nom, parentId, driveId);
    if (!id) id = await creerDossier(nom, parentId);
    _folderCache[cle] = id;
    return id;
  }
  // Crée le chemin Société ▸ Année ▸ Fournisseur (sous la racine) et renvoie l'id du dernier
  async function assurerChemin(driveId, racineNom, societe, annee, fournisseur) {
    const racine = await assurerDossier(racineNom || "Factures", driveId, driveId);
    const dSoc = await assurerDossier(societe, racine, driveId);
    const dAn = await assurerDossier(annee, dSoc, driveId);
    const dFour = await assurerDossier(fournisseur, dAn, driveId);
    return { folderId: dFour, racine };
  }

  async function televerser(bytes, mimeType, nomFichier, folderId) {
    const meta = { name: nomFichier, parents: [folderId] };
    const boundary = "compta_png_" + Date.now();
    const enc = new TextEncoder();
    const pre = enc.encode(
      "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(meta) + "\r\n--" + boundary + "\r\nContent-Type: " + (mimeType || "application/octet-stream") + "\r\n\r\n"
    );
    const post = enc.encode("\r\n--" + boundary + "--");
    const body = new Blob([pre, bytes, post], { type: "multipart/related; boundary=" + boundary });
    const r = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", {
      method: "POST",
      headers: { "Content-Type": "multipart/related; boundary=" + boundary },
      body,
    });
    if (!r.ok) throw new Error("Drive téléversement HTTP " + r.status + " — " + (await r.text()).slice(0, 200));
    return r.json(); // {id, webViewLink}
  }

  // Lien d'un dossier Drive
  const lienDossier = (id) => "https://drive.google.com/drive/folders/" + id;

  /* ------------------- Test rapide du Drive (sans Gmail) ------------- */
  async function testerDrive(onLog) {
    const cfg = getCfg();
    if (!isConnected()) await connect();
    onLog && onLog("Vérification de l'accès au Drive partagé…");
    const racine = await assurerDossier(cfg.racineNom || "Factures", cfg.driveId, cfg.driveId);
    onLog && onLog("✓ Dossier racine OK : " + lienDossier(racine));
    return { ok: true, racine };
  }

  /* ============================ SYNCHRONISATION ===================== *
   * Lit les mails avec pièces jointes, OCR + création facture + archivage.
   * onLog(txt) : journal en direct.  Renvoie un récapitulatif.
   * ================================================================= */
  async function synchroniser(onLog, opts) {
    opts = opts || {};
    const log = (t) => { if (onLog) onLog(t); };
    const cfg = getCfg();
    if (!cfg.clientId) throw new Error("Renseignez d'abord l'identifiant client OAuth.");
    if (!isConnected()) { log("Connexion à Google…"); await connect(); }
    if (_email) log("Connecté : " + _email);

    log("Recherche des emails (« " + cfg.query + " »)…");
    const messages = await listerMessages(cfg.query, opts.maxMessages || 80);
    log(messages.length + " email(s) trouvé(s).");

    let nbFac = 0, nbArch = 0, nbIgnore = 0, nbErr = 0;
    const dejaTraite = new Set(cfg.processed);

    for (const ref of messages) {
      if (dejaTraite.has(ref.id)) { nbIgnore++; continue; }
      let msg;
      try { msg = await lireMessage(ref.id); }
      catch (e) { log("⚠️ Lecture email échouée : " + e.message); nbErr++; continue; }

      const headers = (msg.payload && msg.payload.headers) || [];
      const de = header(headers, "From");
      const a = header(headers, "To") || (_email || "");
      const sujet = header(headers, "Subject") || "(sans objet)";
      const pieces = collecterPieces(msg.payload, []);

      if (!pieces.length) { marquerTraite(ref.id); continue; } // pas de PJ exploitable

      log("✉️ " + sujet.slice(0, 60) + " — " + pieces.length + " pièce(s)");

      for (const pj of pieces) {
        try {
          const bytes = await telechargerPiece(ref.id, pj.attachmentId);
          const file = new File([bytes], pj.filename, { type: pj.mimeType });

          // 1) OCR + extraction des champs (pipeline existant)
          log("   ⚙︎ OCR : " + pj.filename);
          const res = await PNG.ocr.analyser(file, null);
          const champs = res.champs || {};

          // 2) création de la facture dans le logiciel
          const fac = PNG.store.creerDepuisOCR(champs, {
            source: "email", sourceEmail: de, emailDestination: a,
            fichier: pj.filename, apercu: res.apercu, apercus: res.apercus,
          });
          nbFac++;
          log("   ✓ Facture : " + fac.fournisseur + " · " + (PNG.utils.fmtEUR ? PNG.utils.fmtEUR(fac.montantTTC) : fac.montantTTC));

          // 3) archivage Drive : Société ▸ Année ▸ Fournisseur ▸ fichier
          try {
            const c = PNG.utils.companyById(fac.societeId) || {};
            const societeNom = (c.code ? c.code + " - " : "") + (c.raisonSociale || fac.societeId);
            const annee = (fac.dateFacture || PNG.utils.todayISO()).slice(0, 4);   // exercice = année civile
            const four = fac.fournisseur || "Divers";
            const { folderId } = await assurerChemin(cfg.driveId, cfg.racineNom, societeNom, annee, four);
            const up = await televerser(bytes, pj.mimeType, pj.filename, folderId);
            PNG.store.setFactureDriveReel(fac.id, up.webViewLink || lienDossier(folderId), lienDossier(folderId));
            nbArch++;
            log("   📁 Archivé : " + societeNom + " ▸ " + annee + " ▸ " + four);
          } catch (e2) {
            log("   ⚠️ Archivage Drive échoué : " + e2.message);
            nbErr++;
          }
        } catch (e) {
          log("   ⚠️ Pièce jointe ignorée (" + pj.filename + ") : " + e.message);
          nbErr++;
        }
      }
      marquerTraite(ref.id);
    }

    const recap = { messages: messages.length, factures: nbFac, archivees: nbArch, ignores: nbIgnore, erreurs: nbErr };
    log("— Terminé : " + nbFac + " facture(s) créée(s), " + nbArch + " archivée(s) sur le Drive, " + nbIgnore + " email(s) déjà traité(s).");
    return recap;
  }

  return {
    getCfg, setCfg, connect, isConnected, compteConnecte, gisPret,
    synchroniser, testerDrive, lienDossier, DRIVE_DEFAUT,
  };
})();
