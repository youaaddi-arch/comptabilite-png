/* =====================================================================
 * Compta PNG — Utilitaires (formatage, reconnaissance OCR, TVA, KPI)
 * ===================================================================== */
window.PNG = window.PNG || {};

PNG.utils = (function () {
  const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  const num = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtEUR = (n) => eur.format(n || 0);
  const fmtNum = (n) => num.format(n || 0);
  const fmtPct = (n) => `${Math.round((n || 0) * 100)} %`;

  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  const todayISO = () => "2026-05-30"; // "Aujourd'hui" applicatif

  const companyById = (id) => PNG.companies.find((c) => c.id === id) || null;
  const planByNum = (n) => PNG.planComptable.find((p) => p.num === n) || null;
  const financeurByCode = (c) => PNG.financeurs.find((f) => f.code === c) || null;
  const fournisseurByNom = (n) => PNG.fournisseurs.find((f) => f.nom === n) || null;

  /* -------------------------------------------------------------------
   * Reconnaissance de la société du groupe à partir d'un texte OCR.
   * Cherche SIREN/SIRET, NDA, raison sociale, marque, ville de campus.
   * Renvoie { societeId, confiance, indices[] }.
   * ----------------------------------------------------------------- */
  function recognizeCompany(text) {
    const t = (text || "").toUpperCase();
    let best = { societeId: null, confiance: 0, indices: [] };
    PNG.companies.forEach((c) => {
      let score = 0;
      const indices = [];
      // SIRET du siège ou d'un établissement
      const sirets = [c.siret].concat((c.etablissements || []).map((es) => es.siret)).filter((s) => s && s !== "EN COURS");
      if (sirets.some((s) => t.includes(s))) { score += 0.6; indices.push("SIRET exact"); }
      if (c.siren && t.includes(c.siren)) { score += 0.4; indices.push("SIREN"); }
      if (c.nda && t.includes(c.nda)) { score += 0.25; indices.push("N° déclaration activité"); }
      if (c.raisonSociale && t.includes(c.raisonSociale.toUpperCase())) { score += 0.3; indices.push("Raison sociale"); }
      if (c.marque && t.includes(c.marque.toUpperCase())) { score += 0.2; indices.push("Marque"); }
      (c.campuses || []).forEach((camp) => {
        const ville = (camp.match(/\d{5}\s+[A-Za-zÀ-ÿ' -]+/) || [camp])[0].toUpperCase().trim();
        if (ville && t.includes(ville)) { score += 0.1; indices.push("Adresse " + ville); }
      });
      const conf = Math.min(0.99, score);
      if (conf > best.confiance) best = { societeId: c.id, confiance: conf, indices };
    });
    return best;
  }

  /* Proposition d'écriture comptable (mémoire fournisseur) */
  function proposeAccounting(fournisseurNom, ht, taux) {
    const f = fournisseurByNom(fournisseurNom);
    const compteCharge = f ? f.compteCharge : "606800";
    const tauxTva = taux != null ? taux : (f ? f.tauxTva : 20);
    const tva = Math.round(((ht * tauxTva) / 100) * 100) / 100;
    return { compteCharge, compteTva: "445660", tauxTva, tva, ttc: Math.round((ht + tva) * 100) / 100 };
  }

  /* Libellés de statut */
  const STATUT_FACTURE = {
    ocr:          { label: "OCR en cours",   cls: "bg-slate-100 text-slate-600" },
    a_valider:    { label: "À valider",      cls: "bg-amber-100 text-amber-700" },
    brouillon:    { label: "Brouillon",      cls: "bg-blue-100 text-blue-700" },
    comptabilise: { label: "Comptabilisé",   cls: "bg-emerald-100 text-emerald-700" },
  };
  const STATUT_DOSSIER = {
    en_cours: { label: "En cours",  cls: "bg-slate-100 text-slate-600" },
    facture:  { label: "Facturé",   cls: "bg-amber-100 text-amber-700" },
    encaisse: { label: "Encaissé",  cls: "bg-emerald-100 text-emerald-700" },
  };

  const escapeHtml = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* -------------------------------------------------------------------
   * API data.gouv — recherche entreprise (nom -> SIREN/SIRET/NAF/adresse)
   * Gratuite, sans clé. Renvoie une promesse :
   *   { found, siren, siret, nom, naf, adresse, source } ou { found:false }
   * En cas d'absence de réseau (ouverture du fichier en local), échoue
   * proprement sans bloquer l'app.
   * ----------------------------------------------------------------- */
  // Recherche par nom, SIREN ou SIRET. Le SIRET/SIREN est prioritaire car
  // il donne la raison sociale OFFICIELLE (orthographe exacte).
  async function lookupEntreprise(query, opts) {
    opts = opts || {};
    if (typeof fetch !== "function") return { found: false, raison: "fetch indisponible" };
    // priorité : SIRET (14) > SIREN (9) > nom
    const siret = (opts.siret || "").replace(/\D/g, "");
    const siren = (opts.siren || "").replace(/\D/g, "");
    const q = siret.length === 14 ? siret : siren.length === 9 ? siren : query;
    if (!q) return { found: false, raison: "aucun critère" };
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(PNG.dataGouv.url(q), { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) return { found: false, raison: "HTTP " + res.status };
      const data = await res.json();
      const r = data && data.results && data.results[0];
      if (!r) return { found: false, raison: "aucun résultat" };
      const s = r.siege || {};
      return {
        found: true,
        siren: r.siren,
        siret: s.siret || "",
        nom: r.nom_complet || r.nom_raison_sociale || query,
        naf: r.activite_principale || s.activite_principale || "",
        adresse: s.adresse || s.geo_adresse || "",
        parSiret: siret.length === 14 || siren.length === 9, // identifié de façon fiable
        source: "recherche-entreprises.api.gouv.fr",
      };
    } catch (err) {
      return { found: false, raison: (err && err.name === "AbortError") ? "délai dépassé" : "réseau indisponible" };
    }
  }

  // Recherche multi-résultats (pour le choix manuel d'un nouveau fournisseur)
  async function searchEntreprises(query, n) {
    if (typeof fetch !== "function") return { ok: false, raison: "fetch indisponible", results: [] };
    if (!query || query.trim().length < 2) return { ok: false, raison: "requête trop courte", results: [] };
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(PNG.dataGouv.urlMulti(query, n || 6), { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) return { ok: false, raison: "HTTP " + res.status, results: [] };
      const data = await res.json();
      const results = (data.results || []).map((r) => {
        const s = r.siege || {};
        return {
          siren: r.siren, siret: s.siret || "",
          nom: r.nom_complet || r.nom_raison_sociale || "",
          naf: r.activite_principale || s.activite_principale || "",
          adresse: s.adresse || s.geo_adresse || "",
        };
      });
      return { ok: true, results };
    } catch (err) {
      return { ok: false, raison: (err && err.name === "AbortError") ? "délai dépassé" : "réseau indisponible", results: [] };
    }
  }

  const modePaiementByCode = (c) => (PNG.modesPaiement || []).find((m) => m.code === c) || null;

  /* Libellés de statut de rapprochement / paiement */
  const STATUT_PAIEMENT = {
    a_payer:     { label: "À payer",            cls: "bg-amber-100 text-amber-700" },
    paye_attente:{ label: "Payé (à vérifier)",  cls: "bg-blue-100 text-blue-700" },
    paye_verifie:{ label: "Payé · rapproché",   cls: "bg-emerald-100 text-emerald-700" },
  };

  return {
    fmtEUR, fmtNum, fmtPct, fmtDate, todayISO,
    companyById, planByNum, financeurByCode, fournisseurByNom,
    recognizeCompany, proposeAccounting, lookupEntreprise, searchEntreprises, modePaiementByCode,
    STATUT_FACTURE, STATUT_DOSSIER, STATUT_PAIEMENT, escapeHtml,
  };
})();
