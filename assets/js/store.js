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
      journal: [],   // écritures comptabilisées
      inbox: [],     // emails de collecte reçus (avant OCR)
      activity: [],  // piste d'audit / historique
    };
    if (persist) save();
  }

  // Compat : si un état chargé d'une version antérieure n'a pas ces champs
  function ensureShape() {
    if (!state.inbox) state.inbox = [];
    if (!state.activity) state.activity = [];
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
    if (f) { f.societeId = societeId; f.societeConfiance = 1; save(); }
  }
  function setFactureCompte(id, compte) {
    const f = state.factures.find((x) => x.id === id);
    if (f) { f.compteCharge = compte; save(); }
  }
  function validerBrouillon(id) {
    const f = state.factures.find((x) => x.id === id);
    if (f && (f.statut === "a_valider" || f.statut === "ocr")) { f.statut = "brouillon"; save(); }
  }
  function comptabiliser(id) {
    const f = state.factures.find((x) => x.id === id);
    if (!f) return;
    f.statut = "comptabilise";
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
      source: opts.source || "upload",      // upload | email | scan
      sourceEmail: opts.sourceEmail || null,
      dateDepot: U.todayISO(), statut: "a_valider",
      fournisseur: m.fournisseur, categorie: f ? f.categorie : "Divers",
      societeId: reco.societeId || m.soc, societeConfiance: reco.confiance,
      numeroFacture: opts.numeroFacture || ("AUTO-" + (10000 + n)),
      dateFacture: U.todayISO(),
      montantHT: m.ht, tauxTva: acc.tauxTva, montantTVA: acc.tva, montantTTC: acc.ttc,
      compteCharge: acc.compteCharge, compteTva: acc.compteTva,
      echeance: opts.echeance || addDays(U.todayISO(), 30),
      paye: false,
      ocrConfiance: 0.7 + Math.random() * 0.25, rapproche: false,
      ocrIndices: reco.indices,
    };
    fac.doublonDe = (detecterDoublon(fac) || {}).id || null;
    return fac;
  }

  function addDays(iso, d) {
    const dt = new Date(iso + "T00:00:00"); dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  }

  /* Simulation : scanner / déposer une nouvelle facture (upload manuel) */
  function scanNouvelleFacture() {
    const m = MODELES_FAC[Math.floor(Math.random() * MODELES_FAC.length)];
    const fac = ocrToFacture(m, { source: "upload" });
    state.factures.unshift(fac);
    log("Facture déposée (upload)", `${fac.fournisseur} · ${U.fmtEUR(fac.montantTTC)}`);
    save();
    return fac;
  }

  /* -------- Collecte par EMAIL (cœur Pennylane / Yooz) --------------
   * 1) recevoirEmail() : un email avec PJ arrive dans la boîte de collecte
   *    de la société (état "reçu", pas encore traité).
   * 2) traiterEmail() : l'OCR s'exécute sur la PJ -> crée la facture
   *    pré-saisie (comme la "presaise" automatique demandée).
   * ----------------------------------------------------------------- */
  function recevoirEmail(companyId) {
    ensureShape();
    // société ciblée par l'adresse (sinon aléatoire)
    const candidats = MODELES_FAC.filter((m) => !companyId || m.soc === companyId);
    const m = (candidats.length ? candidats : MODELES_FAC)[Math.floor(Math.random() * (candidats.length ? candidats.length : MODELES_FAC.length))];
    const cid = companyId || m.soc;
    const mail = {
      id: "MAIL-" + Date.now(),
      recu: U.todayISO(),
      de: `compta@${m.fournisseur.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      a: PNG.emailCapture(cid),
      societeId: cid,
      objet: `Votre facture ${m.fournisseur}`,
      piece: `${m.fournisseur.replace(/[^A-Za-z]/g, "_")}_facture.pdf`,
      modele: { fournisseur: m.fournisseur, ht: m.ht, soc: cid },
      statut: "recu",    // recu | traite
      factureId: null,
    };
    state.inbox.unshift(mail);
    log("Email reçu (collecte)", `${mail.de} → ${mail.a}`);
    save();
    return mail;
  }

  function traiterEmail(mailId) {
    ensureShape();
    const mail = state.inbox.find((x) => x.id === mailId);
    if (!mail || mail.statut === "traite") return null;
    const fac = ocrToFacture(mail.modele, {
      source: "email", sourceEmail: mail.de, fichier: mail.piece,
    });
    state.factures.unshift(fac);
    mail.statut = "traite"; mail.factureId = fac.id;
    log("Facture pré-saisie depuis email", `${fac.fournisseur} · ${U.fmtEUR(fac.montantTTC)}${fac.doublonDe ? " · DOUBLON détecté" : ""}`);
    save();
    return fac;
  }

  // Traite toute la boîte d'un coup
  function traiterTousEmails() {
    ensureShape();
    let n = 0;
    state.inbox.filter((m) => m.statut === "recu").forEach((m) => { if (traiterEmail(m.id)) n++; });
    return n;
  }

  function marquerPaye(id, val) {
    const f = state.factures.find((x) => x.id === id);
    if (f) { f.paye = val !== false; log(f.paye ? "Facture marquée payée" : "Paiement annulé", f.fournisseur); save(); }
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
      if (f) { f.rapproche = true; if (f.statut !== "comptabilise") f.statut = "comptabilise"; comptabiliser(f.id); }
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

  // Échéancier fournisseur : factures non payées (à régler)
  function aPayer(societeId) {
    return state.factures.filter((f) => f.type === "achat" && !f.paye && (!societeId || f.societeId === societeId)
      && (f.statut === "brouillon" || f.statut === "comptabilise" || f.statut === "a_valider"));
  }
  function totalAPayer(societeId) {
    return Math.round(aPayer(societeId).reduce((s, f) => s + f.montantTTC, 0) * 100) / 100;
  }
  const emailsEnAttente = () => { ensureShape(); return state.inbox.filter((m) => m.statut === "recu").length; };
  const doublonsCount = () => state.factures.filter((f) => f.doublonDe).length;

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
    setFactureSociete, setFactureCompte, validerBrouillon, comptabiliser, scanNouvelleFacture,
    recevoirEmail, traiterEmail, traiterTousEmails, marquerPaye, detecterDoublon,
    suggestionsPour, rapprocher, annulerRapprochement, rapprochementAuto,
    tresorerie, tresorerieTotale, flux, facturesAValider, tauxRapprochement, tva,
    caParSociete, repartitionFinanceurs, serieFlux,
    aPayer, totalAPayer, emailsEnAttente, doublonsCount,
  };
})();
