/* =====================================================================
 * Compta PNG — Store : état applicatif, persistance, actions, KPI
 * ===================================================================== */
window.PNG = window.PNG || {};

PNG.store = (function () {
  const KEY = "compta-png-state-v1";
  const U = PNG.utils;

  // Soldes bancaires d'ouverture par société (au 01/05/2026)
  const SOLDES_INIT = {
    "pnbs-paris": 84200, "pnbs-lille": 41200, "pnbs-sud": 38600, "pnbs-rouen": 12400,
    "dbs": 96500, "pnff": 33800, "pnfb": 47100, "pba": 21900,
    "defis": 152000, "cflss": 18300, "pnbs-marseille": 9700, "polylangues": 27600,
    "pnbs-atlantique": 14200, "ouest-formation": 11800, "qualifforma": 8600,
    "france-acces": 6400, "ilef": 7200, "elfe": 15600,
  };

  let state = null;
  const listeners = [];

  /* Filtre global de société ("" = toutes / vue globale). Persistant. */
  const SCOPE_KEY = "compta-png-scope";
  let scope = "";
  try { scope = localStorage.getItem(SCOPE_KEY) || ""; } catch (e) {}
  const getScope = () => scope;
  function setScope(id) { scope = id || ""; try { localStorage.setItem(SCOPE_KEY, scope); } catch (e) {} listeners.forEach((fn) => fn()); }
  // applique le filtre société courant à une liste d'objets ayant societeId
  const inScope = (o) => !scope || o.societeId === scope;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); ensureShape(); return; }
    } catch (e) { /* ignore */ }
    reset(false);
  }

  function reset(persist = true) {
    state = {
      factures: JSON.parse(JSON.stringify(PNG.seed.factures)),
      dossiers: JSON.parse(JSON.stringify(PNG.seed.dossiers)),
      transactions: JSON.parse(JSON.stringify(PNG.seed.transactions)),
      journal: [],      // écritures comptabilisées
      inbox: [],        // emails de collecte reçus (avant OCR)
      activity: [],     // piste d'audit / historique
      fournisseurs: [], // fiches fournisseurs (créées auto)
    };
    ensureShape();
    if (persist) save();
  }

  // Compat : si un état chargé d'une version antérieure n'a pas ces champs
  function ensureShape() {
    if (!state.inbox) state.inbox = [];
    if (!state.activity) state.activity = [];
    if (!state.fournisseurs || !state.fournisseurs.length) { state.fournisseurs = []; rebuildFournisseurs(); }
    // champs paiement/drive sur factures anciennes
    state.factures.forEach((f) => {
      if (f.statutPaiement === undefined) f.statutPaiement = f.paye ? "paye_attente" : "a_payer";
      if (f.driveUrl === undefined) f.driveUrl = PNG.drive.path(f.societeId, f.fournisseur, f.fichier);
      if (f.dateImport === undefined) f.dateImport = f.dateDepot || null;
      if (f.emailDestination === undefined) f.emailDestination = (f.source === "email") ? PNG.emailCapture(f.societeId) : null;
      if (f.dateReglement === undefined) f.dateReglement = f.datePaiement || null;
      if (f.dateDecaissement === undefined) f.dateDecaissement = (f.rapproche && f.statutPaiement === "paye_verifie") ? (f.datePaiement || null) : null;
      if (f.regleParSocieteId === undefined) f.regleParSocieteId = null;
    });
  }

  /* ---- Fiches / dossiers fournisseurs (créés automatiquement) ------ */
  function fournisseurKey(nom, societeId) { return (nom || "?") + "@" + societeId; }

  function upsertFournisseur(fac) {
    if (!state.fournisseurs) state.fournisseurs = [];
    const key = fournisseurKey(fac.fournisseur, fac.societeId);
    let fo = state.fournisseurs.find((x) => x.key === key);
    if (!fo) {
      const ref = U.fournisseurByNom(fac.fournisseur) || {};
      fo = {
        key, nom: fac.fournisseur, societeId: fac.societeId,
        categorie: fac.categorie || ref.categorie || "Divers",
        compteCharge: fac.compteCharge || ref.compteCharge || "606800",
        compteTiers: "401" + String(100 + (state.fournisseurs.length + 1)).slice(-3), // 401xxx auxiliaire
        siren: fac.fournisseurSiren || "", siret: fac.fournisseurSiret || "",
        naf: fac.fournisseurNaf || "", adresse: fac.fournisseurAdresse || "",
        sourceSiren: fac.fournisseurSource || "",
        cree: U.todayISO(),
      };
      state.fournisseurs.push(fo);
      log("Fiche fournisseur créée", `${fo.nom} (${U.companyById(fo.societeId) ? U.companyById(fo.societeId).code : ""})`);
    } else {
      // enrichit si la facture apporte des infos data.gouv
      if (fac.fournisseurSiren && !fo.siren) { fo.siren = fac.fournisseurSiren; fo.siret = fac.fournisseurSiret || fo.siret; fo.naf = fac.fournisseurNaf || fo.naf; fo.adresse = fac.fournisseurAdresse || fo.adresse; fo.sourceSiren = fac.fournisseurSource || fo.sourceSiren; }
    }
    return fo;
  }

  function rebuildFournisseurs() {
    state.fournisseurs = [];
    state.factures.slice().reverse().forEach((f) => upsertFournisseur(f));
  }

  function fournisseurDossiers() {
    ensureShape();
    return state.fournisseurs.map((fo) => {
      const facs = state.factures.filter((f) => fournisseurKey(f.fournisseur, f.societeId) === fo.key);
      const total = facs.reduce((s, f) => s + f.montantTTC, 0);
      const du = facs.filter((f) => f.statutPaiement !== "paye_verifie").reduce((s, f) => s + f.montantTTC, 0);
      return { ...fo, factures: facs, nbFactures: facs.length, total: Math.round(total * 100) / 100, du: Math.round(du * 100) / 100 };
    }).sort((a, b) => b.total - a.total);
  }

  // Enrichit une facture via data.gouv. Priorité au SIRET/SIREN lu sur la
  // facture (raison sociale officielle), sinon recherche par nom.
  // Si corrigerNom=true, remplace le nom OCR par la raison sociale officielle.
  async function enrichirSiren(factureId, corrigerNom) {
    ensureShape();
    const f = state.factures.find((x) => x.id === factureId);
    if (!f) return null;
    const r = await U.lookupEntreprise(f.fournisseur, { siret: f.fournisseurSiret, siren: f.fournisseurSiren });
    if (r.found) {
      const ancienNom = f.fournisseur;
      f.fournisseurSiren = r.siren; f.fournisseurSiret = r.siret;
      f.fournisseurNaf = r.naf; f.fournisseurAdresse = r.adresse;
      f.fournisseurSource = r.source;
      // Corrige l'orthographe du fournisseur si identifié de façon fiable (par SIRET/SIREN)
      if ((corrigerNom || r.parSiret) && r.nom && r.nom.length > 1) {
        f.fournisseur = r.nom;
        f.driveUrl = PNG.drive.path(f.societeId, f.fournisseur, f.fichier);
      }
      upsertFournisseur(f);
      log("Fournisseur identifié (data.gouv)", `${ancienNom} → ${r.nom} (SIREN ${r.siren})${r.parSiret ? " [via SIRET/SIREN]" : ""}`);
      save();
    }
    return r;
  }

  // Applique une entreprise choisie (data.gouv) à une facture + crée la fiche
  function appliquerEntreprise(factureId, data) {
    ensureShape();
    const f = state.factures.find((x) => x.id === factureId);
    if (!f || !data) return null;
    if (data.nom) { f.fournisseur = data.nom; f.driveUrl = PNG.drive.path(f.societeId, f.fournisseur, f.fichier); }
    f.fournisseurSiren = data.siren || ""; f.fournisseurSiret = data.siret || "";
    f.fournisseurNaf = data.naf || ""; f.fournisseurAdresse = data.adresse || "";
    f.fournisseurSource = "recherche-entreprises.api.gouv.fr";
    const fo = upsertFournisseur(f);
    log("Nouveau fournisseur enregistré", `${f.fournisseur} (SIREN ${data.siren || "?"})`);
    save();
    return fo;
  }

  // Le fournisseur existe-t-il déjà dans notre base ? (par SIREN sinon par nom)
  function fournisseurExiste(facture) {
    ensureShape();
    if (!facture) return false;
    const siren = (facture.fournisseurSiren || "").replace(/\s/g, "");
    const nom = (facture.fournisseur || "").trim().toUpperCase();
    return state.fournisseurs.some((fo) => {
      if (siren && fo.siren && fo.siren.replace(/\s/g, "") === siren) return true;
      // même nom ET même société (le compte tiers est par société)
      return fo.nom && fo.nom.trim().toUpperCase() === nom && fo.societeId === facture.societeId;
    });
  }

  // Ajoute explicitement le fournisseur de la facture à la base (fiche)
  function ajouterFournisseur(factureId) {
    ensureShape();
    const f = state.factures.find((x) => x.id === factureId);
    if (!f) return null;
    const fo = upsertFournisseur(f);
    f.fournisseurAjoute = true;
    log("Fournisseur ajouté à la base", `${f.fournisseur}${f.fournisseurSiren ? " (SIREN " + f.fournisseurSiren + ")" : ""}`);
    save();
    return fo;
  }

  function log(action, detail) {
    ensureShape();
    state.activity.unshift({ ts: Date.now(), date: U.todayISO(), action, detail });
    if (state.activity.length > 200) state.activity.pop();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    listeners.forEach((fn) => fn());
  }

  const subscribe = (fn) => listeners.push(fn);
  const get = () => state;

  /* ----------------------------- Actions facture ------------------- */
  function setFactureSociete(id, societeId) {
    const f = state.factures.find((x) => x.id === id);
    if (f) { f.societeId = societeId; f.societeConfiance = 1; f.driveUrl = PNG.drive.path(societeId, f.fournisseur, f.fichier); save(); }
  }
  function setFactureCompte(id, compte) {
    const f = state.factures.find((x) => x.id === id);
    if (f) { f.compteCharge = compte; save(); }
  }

  /* Édition libre par le comptable AVANT validation : tous les champs.
   * Recalcule TVA/TTC à partir de HT + taux (sauf si TTC fourni explicitement). */
  function editFacture(id, champs) {
    const f = state.factures.find((x) => x.id === id);
    if (!f) return;
    const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : Math.round(n * 100) / 100; };
    if (champs.fournisseur != null) { f.fournisseur = champs.fournisseur; f.driveUrl = PNG.drive.path(f.societeId, f.fournisseur, f.fichier); }
    if (champs.societeId != null) { f.societeId = champs.societeId; f.societeConfiance = 1; f.driveUrl = PNG.drive.path(f.societeId, f.fournisseur, f.fichier); }
    if (champs.numeroFacture != null) f.numeroFacture = champs.numeroFacture;
    if (champs.dateFacture != null) f.dateFacture = champs.dateFacture;
    if (champs.echeance != null) f.echeance = champs.echeance;
    if (champs.compteCharge != null) f.compteCharge = champs.compteCharge;
    if (champs.categorie != null) f.categorie = champs.categorie;
    // identité fournisseur (modifiable manuellement)
    if (champs.fournisseurSiren != null) f.fournisseurSiren = String(champs.fournisseurSiren).replace(/\s/g, "");
    if (champs.fournisseurSiret != null) f.fournisseurSiret = String(champs.fournisseurSiret).replace(/\s/g, "");
    if (champs.fournisseurNaf != null) f.fournisseurNaf = champs.fournisseurNaf;
    if (champs.fournisseurAdresse != null) f.fournisseurAdresse = champs.fournisseurAdresse;
    // montants
    let recalc = false;
    if (champs.montantHT != null) { const v = num(champs.montantHT); if (v != null) { f.montantHT = v; recalc = true; } }
    if (champs.tauxTva != null) { const v = num(champs.tauxTva); if (v != null) { f.tauxTva = v; recalc = true; } }
    if (champs.montantTTC != null) {
      // si le comptable saisit directement le TTC, on ajuste TVA = TTC - HT
      const ttc = num(champs.montantTTC);
      if (ttc != null) { f.montantTTC = ttc; f.montantTVA = Math.round((ttc - f.montantHT) * 100) / 100; recalc = false; }
    } else if (champs.montantTVA != null) {
      const tva = num(champs.montantTVA);
      if (tva != null) { f.montantTVA = tva; f.montantTTC = Math.round((f.montantHT + tva) * 100) / 100; recalc = false; }
    }
    if (recalc) {
      f.montantTVA = Math.round((f.montantHT * f.tauxTva / 100) * 100) / 100;
      f.montantTTC = Math.round((f.montantHT + f.montantTVA) * 100) / 100;
    }
    // recontrôle de cohérence des montants après édition
    const r2 = (x) => Math.round((x || 0) * 100) / 100;
    const al = [];
    if (f.montantHT != null && f.montantTVA != null && f.montantTTC != null) {
      if (Math.abs(r2(f.montantHT + f.montantTVA) - f.montantTTC) > 0.02)
        al.push("HT (" + r2(f.montantHT) + ") + TVA (" + r2(f.montantTVA) + ") = " + r2(f.montantHT + f.montantTVA) + " ≠ TTC (" + r2(f.montantTTC) + ")");
      if (f.tauxTva && Math.abs(r2(f.montantHT * f.tauxTva / 100) - f.montantTVA) > 0.02)
        al.push("TVA saisie (" + r2(f.montantTVA) + ") ≠ TVA calculée " + f.tauxTva + "% (" + r2(f.montantHT * f.tauxTva / 100) + ")");
    }
    f.alerteMontants = al.length ? al : null;
    // re-détecte un doublon après modif
    f.doublonDe = (detecterDoublon(f) || {}).id || null;
    f.modifie = true;
    log("Facture modifiée (comptable)", `${f.fournisseur} · ${U.fmtEUR(f.montantTTC)}`);
    upsertFournisseur(f);
    save();
  }

  function validerBrouillon(id) {
    const f = state.factures.find((x) => x.id === id);
    if (f && (f.statut === "a_valider" || f.statut === "ocr")) { f.statut = "brouillon"; save(); }
  }
  function comptabiliser(id) {
    const f = state.factures.find((x) => x.id === id);
    if (!f) return;
    f.statut = "comptabilise";
    upsertFournisseur(f); // garantit la fiche fournisseur à la comptabilisation
    state.journal.push({
      id: "ECR-" + f.id, date: U.todayISO(), piece: f.numeroFacture,
      societeId: f.societeId,
      lignes: [
        { compte: f.compteCharge, libelle: f.fournisseur, debit: f.montantHT, credit: 0 },
        { compte: f.compteTva, libelle: "TVA déductible", debit: f.montantTVA, credit: 0 },
        { compte: "401000", libelle: "Fournisseur " + f.fournisseur, debit: 0, credit: f.montantTTC },
      ],
    });
    save();
  }

  /* Supprime une facture ET son écriture comptable (journal), et délie
   * l'éventuelle écriture bancaire rapprochée. */
  function supprimerFacture(id) {
    ensureShape();
    const f = state.factures.find((x) => x.id === id);
    if (!f) return false;
    // délie la transaction bancaire éventuellement rapprochée à cette facture
    state.transactions.forEach((t) => {
      if (t.lienType === "facture" && t.lienId === id) { t.rapproche = false; t.lienType = null; t.lienId = null; }
    });
    // retire l'écriture du journal
    state.journal = (state.journal || []).filter((e) => e.id !== ("ECR-" + id));
    // retire la facture
    state.factures = state.factures.filter((x) => x.id !== id);
    // reconstruit les fiches fournisseurs (au cas où c'était la seule)
    rebuildFournisseurs();
    log("Facture supprimée", `${f.fournisseur} · ${f.numeroFacture} · ${U.fmtEUR(f.montantTTC)}`);
    save();
    return true;
  }

  /* Modèles de factures fournisseurs pour la démo (collecte/scan) */
  const MODELES_FAC = [
    { fournisseur: "Bureau Vallée", ht: 154.90, soc: "pnbs-rouen" },
    { fournisseur: "Engie", ht: 880.40, soc: "pnbs-sud" },
    { fournisseur: "Microsoft France", ht: 432.00, soc: "dbs" },
    { fournisseur: "Meta Platforms Ireland", ht: 1260.00, soc: "pnbs-lille" },
    { fournisseur: "OpenAI LLC", ht: 96.00, soc: "pnff" },
    { fournisseur: "SCI Lillenium Invest", ht: 5200.00, soc: "pnbs-lille" },
    { fournisseur: "Amazon Business", ht: 312.75, soc: "pba" },
    { fournisseur: "Google Workspace", ht: 248.00, soc: "pnbs-paris" },
  ];

  /* Détection de doublon : même société + même fournisseur + même n° (ou même
   * montant TTC à 1 cent près et date proche). Comme Pennylane / Yooz. */
  function detecterDoublon(fac) {
    return state.factures.find((f) => f.id !== fac.id && f.societeId === fac.societeId && (
      (f.numeroFacture && fac.numeroFacture && f.numeroFacture === fac.numeroFacture && f.fournisseur === fac.fournisseur) ||
      (f.fournisseur === fac.fournisseur && Math.abs(f.montantTTC - fac.montantTTC) < 0.01 && f.dateFacture === fac.dateFacture)
    )) || null;
  }

  /* Construit une facture océrisée à partir d'un modèle (cœur OCR partagé) */
  function ocrToFacture(m, opts) {
    opts = opts || {};
    const c = U.companyById(m.soc);
    // Texte OCR simulé contenant la raison sociale + SIRET du destinataire
    const fauxTexte = `FACTURE ${m.fournisseur} CLIENT ${c.raisonSociale} ${c.siret} ${(c.campuses && c.campuses[0]) || ""}`;
    const reco = U.recognizeCompany(fauxTexte);
    const acc = U.proposeAccounting(m.fournisseur, m.ht, null);
    const f = U.fournisseurByNom(m.fournisseur);
    const n = state.factures.length + 1;
    const fac = {
      id: "FAC-NEW-" + Date.now() + "-" + n,
      type: "achat",
      fichier: opts.fichier || `scan_${U.todayISO().replace(/-/g, "")}_${100000 + Math.floor(Math.random() * 899999)}.pdf`,
      source: opts.source || "upload",      // upload | email | scan | online
      sourceEmail: opts.sourceEmail || null,        // adresse d'expédition (transmission)
      emailDestination: opts.emailDestination || null, // boîte de collecte qui a reçu
      dateDepot: U.todayISO(), dateImport: U.todayISO(), statut: "a_valider",
      dateReglement: null, dateDecaissement: null, regleParSocieteId: null,
      fournisseur: m.fournisseur, categorie: f ? f.categorie : "Divers",
      societeId: reco.societeId || m.soc, societeConfiance: reco.confiance,
      numeroFacture: opts.numeroFacture || ("AUTO-" + (10000 + n)),
      dateFacture: U.todayISO(),
      montantHT: m.ht, tauxTva: acc.tauxTva, montantTVA: acc.tva, montantTTC: acc.ttc,
      compteCharge: acc.compteCharge, compteTva: acc.compteTva,
      echeance: opts.echeance || addDays(U.todayISO(), 30),
      paye: false,
      statutPaiement: "a_payer",   // a_payer | paye_attente | paye_verifie
      modePaiement: null, datePaiement: null,
      fournisseurSiren: "", fournisseurSiret: "", fournisseurNaf: "", fournisseurAdresse: "", fournisseurSource: "",
      ocrConfiance: 0.7 + Math.random() * 0.25, rapproche: false,
      ocrIndices: reco.indices,
    };
    fac.driveUrl = PNG.drive.path(fac.societeId, fac.fournisseur, fac.fichier);
    fac.doublonDe = (detecterDoublon(fac) || {}).id || null;
    return fac;
  }

  function addDays(iso, d) {
    const dt = new Date(iso + "T00:00:00"); dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  }

  /* Crée une facture à partir d'un VRAI résultat OCR (champs extraits par
   * PNG.ocr) + la société choisie. apercu = dataURL de l'image (aperçu). */
  function creerDepuisOCR(champs, opts) {
    opts = opts || {};
    champs = champs || {};
    // société destinataire : si l'OCR a trouvé NOTRE SIRET, on l'utilise
    let soc = opts.societeId;
    if (!soc && champs.societeHint) soc = champs.societeHint;
    if (!soc && champs.siretDestinataire) {
      const found = PNG.companies.find((c) => {
        const s = champs.siretDestinataire;
        if (c.siret && c.siret.replace(/\D/g, "") === s) return true;
        if (c.siren && c.siren === s.slice(0, 9)) return true;
        return (c.etablissements || []).some((e) => e.siret && e.siret.replace(/\D/g, "") === s);
      });
      if (found) soc = found.id;
    }
    // Si la société destinataire n'a pas été reconnue, on NE force PAS une
    // valeur par défaut (évite "Deniz Finances" systématique) : on marque
    // la facture à confirmer et on prend une société neutre temporaire.
    let societeReconnue = !!soc;
    if (!soc) soc = (PNG.companies.find((c) => SOLDES_INIT[c.id]) || {}).id;
    const fournisseur = (champs.fournisseur || "Fournisseur à préciser").trim();
    const fref = U.fournisseurByNom(fournisseur) || {};
    const ht = champs.montantHT != null ? champs.montantHT : 0;
    const taux = champs.tauxTva != null ? champs.tauxTva : 20;
    const tva = champs.montantTVA != null ? champs.montantTVA : Math.round((ht * taux / 100) * 100) / 100;
    const ttc = champs.montantTTC != null ? champs.montantTTC : Math.round((ht + tva) * 100) / 100;
    const n = state.factures.length + 1;
    const fac = {
      id: "FAC-OCR-" + Date.now() + "-" + n,
      type: "achat",
      fichier: opts.fichier || "document.pdf",
      source: opts.source || "upload",
      sourceEmail: opts.sourceEmail || null,
      emailDestination: opts.emailDestination || null,
      dateDepot: U.todayISO(), dateImport: U.todayISO(), statut: "a_valider",
      dateReglement: null, dateDecaissement: null, regleParSocieteId: null,
      fournisseur, categorie: fref.categorie || "Divers",
      societeId: soc, societeConfiance: societeReconnue ? 1 : 0.3,
      numeroFacture: champs.numeroFacture || ("AUTO-" + (10000 + n)),
      dateFacture: champs.dateFacture || U.todayISO(),
      montantHT: ht, tauxTva: taux, montantTVA: tva, montantTTC: ttc,
      compteCharge: fref.compteCharge || "606800", compteTva: "445660",
      echeance: addDays(champs.dateFacture || U.todayISO(), 30),
      paye: false, statutPaiement: "a_payer", modePaiement: null, datePaiement: null,
      fournisseurSiren: champs.siren || "", fournisseurSiret: champs.siret || "",
      fournisseurNaf: "", fournisseurAdresse: "", fournisseurSource: champs.siret ? "OCR (facture)" : "",
      ocrConfiance: 0.9, rapproche: false, ocrIndices: ["OCR réel"],
      apercu: opts.apercu || null, apercus: opts.apercus || (opts.apercu ? [opts.apercu] : null), ocrTexte: champs.texteBrut || "", ocrMoteur: champs.moteur || "",
      alerteMontants: champs.alerteMontants || null,
    };
    fac.driveUrl = PNG.drive.path(fac.societeId, fac.fournisseur, fac.fichier);
    fac.doublonDe = (detecterDoublon(fac) || {}).id || null;
    state.factures.unshift(fac);
    log("Facture chargée (OCR réel)", `${fac.fournisseur} · ${U.fmtEUR(fac.montantTTC)}`);
    postCreationFacture(fac);
    save();
    return fac;
  }

  /* Après création d'une facture : crée la fiche/dossier fournisseur,
   * archive (lien Drive) et tente l'identification SIREN via data.gouv. */
  function postCreationFacture(fac, opts) {
    // On NE crée PAS automatiquement la fiche fournisseur ici : l'utilisateur
    // l'ajoute explicitement (bouton « Ajouter le fournisseur ») après
    // vérification data.gouv, ou elle est créée à la comptabilisation.
    log("Facture archivée (Drive)", `${fac.fournisseur} → ${fac.driveUrl}`);
    // Identification data.gouv en tâche de fond (ne bloque pas l'UI)
    if (!(opts && opts.noLookup)) {
      // true = corriger le nom du fournisseur avec la raison sociale officielle
      enrichirSiren(fac.id, true).then((r) => {
        if (r && r.found && typeof window !== "undefined" && window.PNG && window.PNG._render) window.PNG._render();
      }).catch(() => {});
    }
  }

  /* Simulation : déposer une facture (upload manuel depuis l'ordinateur) */
  function scanNouvelleFacture() {
    const m = MODELES_FAC[Math.floor(Math.random() * MODELES_FAC.length)];
    const fac = ocrToFacture(m, { source: "upload" });
    state.factures.unshift(fac);
    log("Facture déposée (upload)", `${fac.fournisseur} · ${U.fmtEUR(fac.montantTTC)}`);
    postCreationFacture(fac);
    save();
    return fac;
  }

  /* Dépôt MOBILE par un salarié (photo) : il choisit la société (boîte),
   * et peut pré-saisir le paiement (mode + date) ou « à payer ». */
  function deposerMobile(opts) {
    opts = opts || {};
    const m = MODELES_FAC[Math.floor(Math.random() * MODELES_FAC.length)];
    const soc = opts.societeId || m.soc;
    const fac = ocrToFacture({ fournisseur: m.fournisseur, ht: m.ht, soc }, {
      source: "scan",
      fichier: `IMG_${Math.floor(1000 + Math.random() * 8999)}.jpg`,
    });
    fac.deposePar = opts.salarie || "Salarié (mobile)";
    if (opts.statutPaiement === "paye" && opts.modePaiement) {
      fac.statutPaiement = "paye_attente"; fac.paye = true;
      fac.modePaiement = opts.modePaiement; fac.datePaiement = opts.datePaiement || U.todayISO();
    }
    state.factures.unshift(fac);
    log("Facture déposée (mobile)", `${fac.deposePar} · ${fac.fournisseur} · ${U.companyById(soc) ? U.companyById(soc).code : ""}`);
    postCreationFacture(fac);
    save();
    return fac;
  }

  /* -------- Collecte par EMAIL ---------------------------------------
   * Une facture reçue par email remonte DIRECTEMENT dans la liste des
   * factures à traiter (pré-saisie OCR automatique), sans étape manuelle.
   * On conserve l'adresse mail d'expéditeur (transmission).
   * ----------------------------------------------------------------- */
  function recevoirEmail(companyId) {
    ensureShape();
    const candidats = MODELES_FAC.filter((m) => !companyId || m.soc === companyId);
    const m = (candidats.length ? candidats : MODELES_FAC)[Math.floor(Math.random() * (candidats.length ? candidats.length : MODELES_FAC.length))];
    const cid = companyId || m.soc;
    const de = `compta@${m.fournisseur.toLowerCase().replace(/[^a-z]/g, "")}.com`;
    const fac = ocrToFacture({ fournisseur: m.fournisseur, ht: m.ht, soc: cid }, {
      source: "email", sourceEmail: de, emailDestination: PNG.emailCapture(cid),
      fichier: `${m.fournisseur.replace(/[^A-Za-z]/g, "_")}_facture.pdf`,
    });
    state.factures.unshift(fac);
    log("Facture reçue par email", `${de} → ${fac.fournisseur} · ${U.fmtEUR(fac.montantTTC)}${fac.doublonDe ? " · DOUBLON" : ""}`);
    postCreationFacture(fac);
    save();
    return fac;
  }

  // Compat (ancienne boîte de collecte) — désormais sans objet
  function traiterEmail() { return null; }
  function traiterTousEmails() {
    ensureShape();
    // plus de boîte d'attente : la collecte email crée directement les factures
    return 0;
  }

  /* Saisie du paiement par le salarié : mode + date.
   * statutPaiement passe à "paye_attente" (le logiciel vérifiera la banque). */
  function saisirPaiement(id, modePaiement, datePaiement) {
    const f = state.factures.find((x) => x.id === id);
    if (!f) return;
    if (!modePaiement) { // repasser à "à payer"
      f.statutPaiement = "a_payer"; f.paye = false; f.modePaiement = null; f.datePaiement = null;
      log("Paiement annulé", f.fournisseur); save(); return;
    }
    f.modePaiement = modePaiement; f.datePaiement = datePaiement || U.todayISO();
    f.paye = true; f.statutPaiement = "paye_attente";
    log("Paiement saisi", `${f.fournisseur} · ${modePaiement} · ${f.datePaiement}`);
    save();
  }
  // compat ancien nom
  function marquerPaye(id, val) {
    if (val === false) return saisirPaiement(id, null);
    return saisirPaiement(id, "virement", U.todayISO());
  }

  /* VÉRIFICATION BANCAIRE du paiement :
   * cherche une écriture bancaire (débit) qui correspond au montant TTC de la
   * facture, sur la même société. Si trouvée, vérifie aussi le MODE de paiement
   * (libellé bancaire VIR/PRLV/CB…) puis passe la facture en "payé · rapproché"
   * et lettre la transaction. C'est le rapprochement paiement fournisseur. */
  function verifierPaiementBanque(factureId) {
    ensureShape();
    const f = state.factures.find((x) => x.id === factureId);
    if (!f) return { ok: false, raison: "facture introuvable" };
    const matchMontant = (t) => !t.rapproche && t.sens === "debit" && Math.abs(Math.abs(t.montant) - f.montantTTC) < 0.01;
    // 1) banque de la société de la facture
    let tx = state.transactions.find((t) => t.societeId === f.societeId && matchMontant(t));
    let interSociete = false;
    // 2) sinon : règlement par UNE AUTRE de nos sociétés (boîtes du groupe)
    if (!tx) {
      tx = state.transactions.find((t) => matchMontant(t));
      if (tx) interSociete = true;
    }
    if (!tx) return { ok: false, raison: "aucune écriture bancaire correspondante (ni dans les autres sociétés du groupe)" };
    // contrôle du mode de paiement via le libellé bancaire
    let modeOk = true, modeDetecte = f.modePaiement;
    if (f.modePaiement) {
      const mp = U.modePaiementByCode(f.modePaiement);
      modeOk = mp ? mp.bankRegex.test(tx.libelle) : true;
    } else {
      const mp = (PNG.modesPaiement || []).find((m) => m.bankRegex.test(tx.libelle));
      modeDetecte = mp ? mp.code : null; f.modePaiement = modeDetecte;
    }
    // rapproche + comptabilise
    tx.rapproche = true; tx.lienType = "facture"; tx.lienId = f.id;
    f.rapproche = true; f.paye = true;
    f.dateReglement = f.datePaiement || tx.date;     // date de règlement (saisie ou banque)
    f.dateDecaissement = tx.date;                    // date réelle de sortie en banque
    f.datePaiement = f.datePaiement || tx.date;
    f.statutPaiement = "paye_verifie";
    // règlement par une autre société du groupe
    if (interSociete) {
      f.regleParSocieteId = tx.societeId;
      log("Réglé par une autre société du groupe", `${f.fournisseur} · payé par ${U.companyById(tx.societeId) ? U.companyById(tx.societeId).code : tx.societeId} (facture de ${U.companyById(f.societeId) ? U.companyById(f.societeId).code : f.societeId})`);
    } else {
      f.regleParSocieteId = null;
    }
    if (f.statut !== "comptabilise") comptabiliser(f.id);
    log("Paiement vérifié en banque", `${f.fournisseur} · ${U.fmtEUR(f.montantTTC)} · ${tx.libelle}${modeOk ? "" : " (mode différent !)"}${interSociete ? " · INTER-SOCIÉTÉS" : ""}`);
    save();
    return { ok: true, tx, modeOk, modeDetecte, interSociete, regleParSocieteId: tx.societeId };
  }

  // Lance la vérification bancaire sur toutes les factures "payé en attente"
  function verifierTousPaiements() {
    ensureShape();
    let n = 0;
    state.factures.filter((f) => f.statutPaiement === "paye_attente").forEach((f) => {
      if (verifierPaiementBanque(f.id).ok) n++;
    });
    return n;
  }

  /* ------------------------- Rapprochement bancaire ---------------- */
  // Suggestions de rapprochement pour une transaction non rapprochée
  function suggestionsPour(tx) {
    const out = [];
    if (tx.sens === "debit") {
      state.factures.forEach((f) => {
        if (f.rapproche) return;
        const ecart = Math.abs(Math.abs(tx.montant) - f.montantTTC);
        if (f.societeId === tx.societeId && ecart < 1) {
          out.push({ type: "facture", id: f.id, label: `${f.fournisseur} · ${f.numeroFacture}`, montant: f.montantTTC, score: 0.98 });
        }
      });
    } else {
      state.dossiers.forEach((d) => {
        const enc = (state.transactions.find((t) => t.lienType === "dossier" && t.lienId === d.id && t.rapproche));
        if (enc) return;
        const ecart = Math.abs(tx.montant - d.montant);
        if (d.societeId === tx.societeId && ecart < 1) {
          out.push({ type: "dossier", id: d.id, label: `${d.stagiaire} · ${d.numeroDossier}`, montant: d.montant, score: 0.97 });
        }
      });
    }
    return out;
  }

  function rapprocher(txId, cibleType, cibleId) {
    const tx = state.transactions.find((t) => t.id === txId);
    if (!tx) return;
    tx.rapproche = true; tx.lienType = cibleType; tx.lienId = cibleId;
    if (cibleType === "facture") {
      const f = state.factures.find((x) => x.id === cibleId);
      if (f) {
        f.rapproche = true; f.paye = true; f.statutPaiement = "paye_verifie";
        if (!f.modePaiement) { const mp = (PNG.modesPaiement || []).find((m) => m.bankRegex.test(tx.libelle)); if (mp) f.modePaiement = mp.code; }
        if (!f.datePaiement) f.datePaiement = tx.date;
        if (f.statut !== "comptabilise") comptabiliser(f.id);
      }
    } else if (cibleType === "dossier") {
      const d = state.dossiers.find((x) => x.id === cibleId);
      if (d) d.statut = "encaisse";
    }
    save();
  }
  function annulerRapprochement(txId) {
    const tx = state.transactions.find((t) => t.id === txId);
    if (!tx) return;
    tx.rapproche = false; tx.lienType = null; tx.lienId = null; save();
  }

  /* Synchronisation bancaire quotidienne : de nouvelles écritures remontent.
   * Crée en priorité les débits correspondant aux factures non encore
   * rapprochées (pour que le rapprochement ait un sens), sinon des écritures
   * variées. (Simulation d'un flux d'agrégation type Bridge/Powens.) */
  function synchroniserBanque() {
    ensureShape();
    const nouvelles = [];
    // factures payées (ou à payer) sans écriture bancaire correspondante
    const sansTx = state.factures.filter((f) => !f.rapproche &&
      !state.transactions.some((t) => t.sens === "debit" && t.societeId === f.societeId && Math.abs(Math.abs(t.montant) - f.montantTTC) < 0.01));
    sansTx.slice(0, 3).forEach((f) => {
      const mp = (f.modePaiement && (PNG.modesPaiement || []).find((m) => m.code === f.modePaiement));
      const prefix = mp ? (mp.code === "prelevement" ? "PRLV" : mp.code === "cb" ? "CB" : mp.code === "cheque" ? "CHQ" : "VIR") : "PRLV";
      nouvelles.push({
        id: "TX-SYNC-" + Date.now() + "-" + nouvelles.length,
        societeId: f.societeId, date: U.todayISO(),
        libelle: `${prefix} ${f.fournisseur.toUpperCase()}`,
        montant: -f.montantTTC, sens: "debit",
        categorie: f.categorie || "Achat", rapproche: false, lienType: null, lienId: null,
      });
    });
    if (!nouvelles.length) {
      // rien à matcher : une écriture neutre pour montrer le flux quotidien
      const c = PNG.companies.find((x) => SOLDES_INIT[x.id]);
      nouvelles.push({
        id: "TX-SYNC-" + Date.now(), societeId: c.id, date: U.todayISO(),
        libelle: "CB FRAIS DIVERS", montant: -Math.round((20 + Math.random() * 180) * 100) / 100,
        sens: "debit", categorie: "Divers", rapproche: false, lienType: null, lienId: null,
      });
    }
    nouvelles.forEach((t) => state.transactions.unshift(t));
    log("Synchronisation bancaire", `${nouvelles.length} écriture(s) remontée(s)`);
    save();
    return nouvelles.length;
  }
  function rapprochementAuto() {
    let n = 0;
    state.transactions.filter((t) => !t.rapproche).forEach((tx) => {
      const sug = suggestionsPour(tx);
      if (sug.length === 1 && sug[0].score >= 0.95) { rapprocher(tx.id, sug[0].type, sug[0].id); n++; }
    });
    return n;
  }

  /* -------------------------------- KPI ---------------------------- */
  function tresorerie(societeId) {
    const base = SOLDES_INIT[societeId] || 0;
    const flux = state.transactions.filter((t) => t.societeId === societeId)
      .reduce((s, t) => s + t.montant, 0);
    return base + flux;
  }
  const tresorerieTotale = () => PNG.companies.reduce((s, c) => s + tresorerie(c.id), 0);

  function flux(date) {
    let enc = 0, dec = 0;
    state.transactions.filter((t) => t.date === date).forEach((t) => {
      if (t.montant >= 0) enc += t.montant; else dec += Math.abs(t.montant);
    });
    return { enc, dec };
  }

  const facturesAValider = () => state.factures.filter((f) => f.statut === "a_valider" || f.statut === "ocr").length;

  function tauxRapprochement() {
    const tot = state.transactions.length;
    if (!tot) return 1;
    return state.transactions.filter((t) => t.rapproche).length / tot;
  }

  // TVA : déductible (achats) / collectée (ventes taxables = financement ENTREPRISE 20%)
  function tva(societeId) {
    const facs = state.factures.filter((f) => (f.statut === "brouillon" || f.statut === "comptabilise") && (!societeId || f.societeId === societeId));
    const deductible = facs.reduce((s, f) => s + f.montantTVA, 0);
    const doss = state.dossiers.filter((d) => (d.statut === "facture" || d.statut === "encaisse") && (!societeId || d.societeId === societeId));
    const collectee = doss.filter((d) => d.financeurCode === "ENTREPRISE")
      .reduce((s, d) => s + Math.round((d.montant - d.montant / 1.2) * 100) / 100, 0);
    return { deductible: Math.round(deductible * 100) / 100, collectee: Math.round(collectee * 100) / 100, aDecaisser: Math.round((collectee - deductible) * 100) / 100 };
  }

  function caParSociete() {
    const map = {};
    PNG.companies.forEach((c) => (map[c.id] = 0));
    state.dossiers.filter((d) => d.statut !== "en_cours").forEach((d) => { map[d.societeId] = (map[d.societeId] || 0) + d.montant; });
    return map;
  }

  function repartitionFinanceurs() {
    const map = {};
    PNG.financeurs.forEach((f) => (map[f.code] = 0));
    state.dossiers.forEach((d) => { map[d.financeurCode] = (map[d.financeurCode] || 0) + d.montant; });
    return map;
  }

  // « À régler » : factures VALIDÉES dont le statut paiement est "à payer"
  // (le salarié ne les a pas marquées payées sur l'app).
  function aRegler(societeId) {
    return state.factures.filter((f) => f.type === "achat" && f.statutPaiement === "a_payer"
      && (f.statut === "brouillon" || f.statut === "comptabilise")
      && (!societeId || f.societeId === societeId));
  }
  const totalARegler = (societeId) => Math.round(aRegler(societeId).reduce((s, f) => s + f.montantTTC, 0) * 100) / 100;

  // Échéancier fournisseur : factures non payées (à régler) — toutes statuts
  function aPayer(societeId) {
    return state.factures.filter((f) => f.type === "achat" && !f.paye && (!societeId || f.societeId === societeId)
      && (f.statut === "brouillon" || f.statut === "comptabilise" || f.statut === "a_valider"));
  }
  function totalAPayer(societeId) {
    return Math.round(aPayer(societeId).reduce((s, f) => s + f.montantTTC, 0) * 100) / 100;
  }
  const emailsEnAttente = () => { ensureShape(); return state.inbox.filter((m) => m.statut === "recu").length; };
  const doublonsCount = () => state.factures.filter((f) => f.doublonDe).length;
  const paiementsAVerifier = () => state.factures.filter((f) => f.statutPaiement === "paye_attente").length;

  // Série encaissements / décaissements 7 derniers jours
  function serieFlux() {
    const jours = [];
    const base = new Date("2026-05-30T00:00:00");
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const f = flux(iso);
      jours.push({ iso, label: iso.slice(8) + "/" + iso.slice(5, 7), enc: f.enc, dec: f.dec });
    }
    return jours;
  }

  return {
    load, reset, save, subscribe, get, SOLDES_INIT, log,
    getScope, setScope, inScope,
    setFactureSociete, setFactureCompte, validerBrouillon, comptabiliser, supprimerFacture,
    scanNouvelleFacture, deposerMobile, creerDepuisOCR,
    recevoirEmail, traiterEmail, traiterTousEmails, detecterDoublon,
    saisirPaiement, marquerPaye, verifierPaiementBanque, verifierTousPaiements,
    enrichirSiren, appliquerEntreprise, fournisseurExiste, ajouterFournisseur, fournisseurDossiers, rebuildFournisseurs,
    suggestionsPour, rapprocher, annulerRapprochement, rapprochementAuto, synchroniserBanque,
    tresorerie, tresorerieTotale, flux, facturesAValider, tauxRapprochement, tva,
    caParSociete, repartitionFinanceurs, serieFlux,
    editFacture, aRegler, totalARegler,
    aPayer, totalAPayer, emailsEnAttente, doublonsCount, paiementsAVerifier,
  };
})();
