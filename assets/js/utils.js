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

  return {
    fmtEUR, fmtNum, fmtPct, fmtDate, todayISO,
    companyById, planByNum, financeurByCode, fournisseurByNom,
    recognizeCompany, proposeAccounting,
    STATUT_FACTURE, STATUT_DOSSIER, escapeHtml,
  };
})();
