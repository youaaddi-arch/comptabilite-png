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
      if (raw) { state = JSON.parse(raw); return; }
    } catch (e) { /* ignore */ }
    reset(false);
  }

  function reset(persist = true) {
    state = {
      factures: JSON.parse(JSON.stringify(PNG.seed.factures)),
      dossiers: JSON.parse(JSON.stringify(PNG.seed.dossiers)),
      transactions: JSON.parse(JSON.stringify(PNG.seed.transactions)),
      journal: [], // écritures comptabilisées
    };
    if (persist) save();
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

  /* Simulation : scanner / déposer une nouvelle facture (OCR) */
  function scanNouvelleFacture() {
    const modeles = [
      { fournisseur: "Bureau Vallée", ht: 154.90, soc: "pnbs-rouen" },
      { fournisseur: "Engie", ht: 880.40, soc: "pnbs-sud" },
      { fournisseur: "Microsoft France", ht: 432.00, soc: "dbs" },
      { fournisseur: "Meta Platforms Ireland", ht: 1260.00, soc: "pnbs-lille" },
      { fournisseur: "OpenAI LLC", ht: 96.00, soc: "pnff" },
      { fournisseur: "SCI Lillenium Invest", ht: 5200.00, soc: "pnbs-lille" },
    ];
    const m = modeles[Math.floor(Math.random() * modeles.length)];
    const c = U.companyById(m.soc);
    // Texte OCR simulé contenant la raison sociale + SIRET de la société destinataire
    const fauxTexte = `FACTURE ${m.fournisseur} CLIENT ${c.raisonSociale} ${c.siret} ${c.campuses[0] || ""}`;
    const reco = U.recognizeCompany(fauxTexte);
    const acc = U.proposeAccounting(m.fournisseur, m.ht, null);
    const f = U.fournisseurByNom(m.fournisseur);
    const n = state.factures.length + 1;
    const fac = {
      id: "FAC-NEW-" + Date.now(),
      type: "achat",
      fichier: `scan_${U.todayISO().replace(/-/g, "")}_${100000 + Math.floor(Math.random() * 899999)}.pdf`,
      dateDepot: U.todayISO(), statut: "a_valider",
      fournisseur: m.fournisseur, categorie: f ? f.categorie : "Divers",
      societeId: reco.societeId || m.soc, societeConfiance: reco.confiance,
      numeroFacture: "AUTO-" + (10000 + n), dateFacture: U.todayISO(),
      montantHT: m.ht, tauxTva: acc.tauxTva, montantTVA: acc.tva, montantTTC: acc.ttc,
      compteCharge: acc.compteCharge, compteTva: acc.compteTva,
      ocrConfiance: 0.7 + Math.random() * 0.25, rapproche: false,
      ocrIndices: reco.indices,
    };
    state.factures.unshift(fac);
    save();
    return fac;
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
    load, reset, save, subscribe, get, SOLDES_INIT,
    setFactureSociete, setFactureCompte, validerBrouillon, comptabiliser, scanNouvelleFacture,
    suggestionsPour, rapprocher, annulerRapprochement, rapprochementAuto,
    tresorerie, tresorerieTotale, flux, facturesAValider, tauxRapprochement, tva,
    caParSociete, repartitionFinanceurs, serieFlux,
  };
})();
