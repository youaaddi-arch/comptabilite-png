/* =====================================================================
 * Compta PNG — Jeu de données de démonstration (mai 2026)
 * Génère factures fournisseurs (OCR), dossiers de financement (ERP)
 * et écritures bancaires (encaissements / décaissements).
 * ===================================================================== */
window.PNG = window.PNG || {};

PNG.seed = (function () {
  const r2 = (n) => Math.round(n * 100) / 100;
  const ttc = (ht, taux) => r2(ht + (ht * taux) / 100);
  let _id = 0;
  const uid = (p) => `${p}-${(++_id).toString().padStart(4, "0")}`;

  /* --- Factures fournisseurs captées (boîte de réception OCR) --------- */
  const F = (o) => {
    const tva = r2((o.ht * o.taux) / 100);
    const f = PNG.fournisseurs.find((x) => x.nom === o.fournisseur) || {};
    return {
      id: uid("FAC"),
      type: "achat",
      fichier: o.fichier,
      dateDepot: o.dateDepot,
      statut: o.statut, // ocr | a_valider | brouillon | comptabilise
      fournisseur: o.fournisseur,
      categorie: f.categorie || "Divers",
      societeId: o.societeId,
      societeConfiance: o.societeConfiance,
      numeroFacture: o.num,
      dateFacture: o.dateFacture,
      montantHT: o.ht,
      tauxTva: o.taux,
      montantTVA: tva,
      montantTTC: r2(o.ht + tva),
      compteCharge: o.compte || f.compteCharge || "606800",
      compteTva: "445660",
      ocrConfiance: o.ocr,
      rapproche: !!o.rapproche,
    };
  };

  const factures = [
    F({ fichier: "facture_orange_mai2026.pdf", dateDepot: "2026-05-29", statut: "a_valider",
        fournisseur: "Orange Business", societeId: "pnbs-paris", societeConfiance: 0.97,
        num: "OR-2026-44821", dateFacture: "2026-05-27", ht: 412.50, taux: 20, ocr: 0.96 }),
    F({ fichier: "loyer_poterie_mai.pdf", dateDepot: "2026-05-28", statut: "a_valider",
        fournisseur: "SCI Foncière Poterie", societeId: "pnbs-paris", societeConfiance: 0.99,
        num: "LOY-05-2026", dateFacture: "2026-05-01", ht: 6800.00, taux: 0, ocr: 0.93 }),
    F({ fichier: "google_ads_avril.pdf", dateDepot: "2026-05-28", statut: "a_valider",
        fournisseur: "Google Ads", societeId: "dbs", societeConfiance: 0.88,
        num: "GADS-9920381", dateFacture: "2026-04-30", ht: 3240.00, taux: 20, ocr: 0.91 }),
    F({ fichier: "linkedin_recrutement.pdf", dateDepot: "2026-05-27", statut: "a_valider",
        fournisseur: "LinkedIn Ireland", societeId: "pnbs-lille", societeConfiance: 0.84,
        num: "LI-FR-553201", dateFacture: "2026-05-20", ht: 980.00, taux: 20, ocr: 0.89 }),
    F({ fichier: "edf_lyon_t2.pdf", dateDepot: "2026-05-27", statut: "a_valider",
        fournisseur: "EDF Entreprises", societeId: "pnbs-sud", societeConfiance: 0.95,
        num: "EDF-2026-T2-7781", dateFacture: "2026-05-15", ht: 1120.40, taux: 20, ocr: 0.94 }),
    F({ fichier: "canva_teams.pdf", dateDepot: "2026-05-26", statut: "brouillon",
        fournisseur: "Canva Pty", societeId: "pnff", societeConfiance: 0.90,
        num: "CNV-2026-7781", dateFacture: "2026-05-10", ht: 119.00, taux: 20, ocr: 0.92 }),
    F({ fichier: "google_workspace_mai.pdf", dateDepot: "2026-05-26", statut: "brouillon",
        fournisseur: "Google Workspace", societeId: "dbs", societeConfiance: 0.93,
        num: "GW-2026-118822", dateFacture: "2026-05-01", ht: 624.00, taux: 20, ocr: 0.95 }),
    F({ fichier: "axa_rc_pro_2026.pdf", dateDepot: "2026-05-25", statut: "brouillon",
        fournisseur: "AXA Entreprises", societeId: "pnfb", societeConfiance: 0.91,
        num: "AXA-RC-2026-009", dateFacture: "2026-05-02", ht: 2150.00, taux: 0, ocr: 0.90 }),
    F({ fichier: "manutan_mobilier.pdf", dateDepot: "2026-05-24", statut: "comptabilise",
        fournisseur: "Manutan", societeId: "pnbs-paris", societeConfiance: 0.96,
        num: "MAN-2026-44120", dateFacture: "2026-05-12", ht: 1842.30, taux: 20, ocr: 0.94, rapproche: true }),
    F({ fichier: "cabinet_compta_honoraires.pdf", dateDepot: "2026-05-22", statut: "comptabilise",
        fournisseur: "Cabinet Expertise & Co", societeId: "dbs", societeConfiance: 0.98,
        num: "CEC-2026-0512", dateFacture: "2026-05-05", ht: 1500.00, taux: 20, ocr: 0.97, rapproche: true }),
    F({ fichier: "ovh_hebergement.pdf", dateDepot: "2026-05-21", statut: "comptabilise",
        fournisseur: "OVHcloud", societeId: "pnbs-paris", societeConfiance: 0.94,
        num: "OVH-2026-77120", dateFacture: "2026-05-03", ht: 358.00, taux: 20, ocr: 0.96, rapproche: true }),
    F({ fichier: "veolia_proprete.pdf", dateDepot: "2026-05-20", statut: "comptabilise",
        fournisseur: "Veolia Propreté", societeId: "pnbs-lille", societeConfiance: 0.92,
        num: "VEO-2026-3320", dateFacture: "2026-05-04", ht: 640.00, taux: 10, ocr: 0.93, rapproche: true }),
    // En cours d'OCR (société non encore confirmée)
    F({ fichier: "scan_20260530_093210.pdf", dateDepot: "2026-05-30", statut: "ocr",
        fournisseur: "Amazon Business", societeId: "pba", societeConfiance: 0.62,
        num: "AMZ-FR-99183", dateFacture: "2026-05-28", ht: 287.45, taux: 20, ocr: 0.71 }),
    F({ fichier: "scan_20260530_101455.pdf", dateDepot: "2026-05-30", statut: "ocr",
        fournisseur: "SFR Business", societeId: "pnfb", societeConfiance: 0.58,
        num: "SFR-2026-55021", dateFacture: "2026-05-26", ht: 196.80, taux: 20, ocr: 0.68 }),
  ];

  /* --- Dossiers de financement (ERP ventes : OPCO / CPF / France Travail) --- */
  const D = (o) => ({
    id: uid("DOS"),
    type: "vente",
    stagiaire: o.stagiaire,
    formation: o.formation,
    societeId: o.societeId,
    campus: o.campus,
    financeurCode: o.financeur,
    numeroDossier: o.numDossier,
    numeroOPCO: o.opco || "",
    numeroCPF: o.cpf || "",
    numeroPOEI: o.poei || "",
    montant: o.montant,
    statut: o.statut, // en_cours | facture | encaisse
    dateDebut: o.dateDebut,
    factureNum: o.facture || "",
  });

  const dossiers = [
    D({ stagiaire: "Aïcha Benali", formation: "TP NTC", societeId: "pnbs-paris", campus: "Saint-Denis",
        financeur: "CPF", numDossier: "DOS-2026-0042", cpf: "CPF-2026-883135-00421",
        montant: 7800, statut: "encaisse", dateDebut: "2026-03-01", facture: "VTE-2026-0042" }),
    D({ stagiaire: "Karim Toumi", formation: "TP CC", societeId: "dbs", campus: "Paris",
        financeur: "OPCO", numDossier: "DOS-2026-0051", opco: "AKTO-2026-44721",
        montant: 6500, statut: "facture", dateDebut: "2026-04-15", facture: "VTE-2026-0051" }),
    D({ stagiaire: "Sophie Marchand", formation: "TP EPR", societeId: "pnff", campus: "Neuilly-sur-Seine",
        financeur: "FT", numDossier: "DOS-2026-0063", poei: "POEI-IDF-2026-7781",
        montant: 5200, statut: "facture", dateDebut: "2026-05-05", facture: "VTE-2026-0063" }),
    D({ stagiaire: "Mehdi Lahlou", formation: "TP DB", societeId: "pnfb", campus: "Meaux",
        financeur: "OPCO", numDossier: "DOS-2026-0070", opco: "CONSTRUCTYS-2026-1182",
        montant: 8900, statut: "encaisse", dateDebut: "2026-02-10", facture: "VTE-2026-0070" }),
    D({ stagiaire: "Laura Petit", formation: "CAP AP", societeId: "pba", campus: "Nanterre",
        financeur: "CPF", numDossier: "DOS-2026-0078", cpf: "CPF-2026-449651-00078",
        montant: 4300, statut: "facture", dateDebut: "2026-05-12", facture: "VTE-2026-0078" }),
    D({ stagiaire: "Yanis Cherif", formation: "TP REM", societeId: "pnbs-sud", campus: "Lyon",
        financeur: "FT", numDossier: "DOS-2026-0081", poei: "POEI-ARA-2026-3320",
        montant: 6100, statut: "en_cours", dateDebut: "2026-05-20" }),
    D({ stagiaire: "Fatou Diallo", formation: "TP NTC", societeId: "pnbs-lille", campus: "Lille",
        financeur: "OPCO", numDossier: "DOS-2026-0085", opco: "OPCOEP-2026-9920",
        montant: 7200, statut: "facture", dateDebut: "2026-05-18", facture: "VTE-2026-0085" }),
    D({ stagiaire: "Thomas Girard", formation: "TP MAC", societeId: "pnfb", campus: "Saint-Denis",
        financeur: "CPF", numDossier: "DOS-2026-0090", cpf: "CPF-2026-913471-00090",
        montant: 5600, statut: "encaisse", dateDebut: "2026-03-22", facture: "VTE-2026-0090" }),
    D({ stagiaire: "Nadia El Amrani", formation: "MASTER MBU", societeId: "pnbs-paris", campus: "Saint-Denis",
        financeur: "ENTREPRISE", numDossier: "DOS-2026-0093", montant: 9900,
        statut: "facture", dateDebut: "2026-05-02", facture: "VTE-2026-0093" }),
    D({ stagiaire: "Lucas Moreau", formation: "TP CC", societeId: "dbs", campus: "Toulouse",
        financeur: "FT", numDossier: "DOS-2026-0097", poei: "POEI-OCC-2026-1140",
        montant: 5800, statut: "en_cours", dateDebut: "2026-05-25" }),
    D({ stagiaire: "Inès Roussel", formation: "TP EPR", societeId: "pnff", campus: "Saint-Denis",
        financeur: "CPF", numDossier: "DOS-2026-0099", cpf: "CPF-2026-982283-00099",
        montant: 4900, statut: "facture", dateDebut: "2026-05-14", facture: "VTE-2026-0099" }),
    D({ stagiaire: "Omar Saïdi", formation: "CAP ECP", societeId: "pba", campus: "Nanterre",
        financeur: "OPCO", numDossier: "DOS-2026-0102", opco: "OPCOSANTE-2026-2210",
        montant: 4100, statut: "encaisse", dateDebut: "2026-02-28", facture: "VTE-2026-0102" }),
  ];

  /* --- Écritures bancaires (relevé quotidien, à rapprocher) ---------- */
  let _t = 0;
  const tx = [];
  const T = (o) => tx.push({
    id: uid("TX"),
    societeId: o.societeId,
    date: o.date,
    libelle: o.libelle,
    montant: o.montant, // signé : + encaissement / - décaissement
    sens: o.montant >= 0 ? "credit" : "debit",
    categorie: o.categorie,
    rapproche: !!o.rapproche,
    lienType: o.lienType || null,
    lienId: o.lienId || null,
  });

  // Encaissements (financeurs) déjà rapprochés
  T({ societeId: "pnbs-paris", date: "2026-03-28", libelle: "VIR CAISSE DES DEPOTS CPF DOS-0042", montant: 7800, categorie: "Encaissement formation", rapproche: true, lienType: "dossier", lienId: dossiers[0].id });
  T({ societeId: "pnfb", date: "2026-03-05", libelle: "VIR CONSTRUCTYS OPCO 1182", montant: 8900, categorie: "Encaissement formation", rapproche: true, lienType: "dossier", lienId: dossiers[3].id });
  T({ societeId: "pnfb", date: "2026-04-18", libelle: "VIR CAISSE DES DEPOTS CPF DOS-0090", montant: 5600, categorie: "Encaissement formation", rapproche: true, lienType: "dossier", lienId: dossiers[7].id });
  T({ societeId: "pba", date: "2026-03-30", libelle: "VIR OPCO SANTE 2210", montant: 4100, categorie: "Encaissement formation", rapproche: true, lienType: "dossier", lienId: dossiers[11].id });

  // Encaissements récents À RAPPROCHER (matchent des dossiers "facturé")
  T({ societeId: "dbs", date: "2026-05-29", libelle: "VIR AKTO REF 44721", montant: 6500, categorie: "Encaissement formation" });
  T({ societeId: "pnff", date: "2026-05-29", libelle: "VIR FRANCE TRAVAIL POEI 7781", montant: 5200, categorie: "Encaissement formation" });
  T({ societeId: "pnbs-lille", date: "2026-05-30", libelle: "VIR OPCO EP REF 9920", montant: 7200, categorie: "Encaissement formation" });
  T({ societeId: "pba", date: "2026-05-30", libelle: "VIR CAISSE DES DEPOTS CPF 00078", montant: 4300, categorie: "Encaissement formation" });
  T({ societeId: "pnbs-paris", date: "2026-05-28", libelle: "VIR ACME CORP FORMATION NADIA E", montant: 9900, categorie: "Encaissement formation" });

  // Décaissements (factures fournisseurs) déjà rapprochés
  T({ societeId: "pnbs-paris", date: "2026-05-18", libelle: "PRLV MANUTAN SA", montant: -ttc(1842.30, 20), categorie: "Achat fournitures", rapproche: true, lienType: "facture", lienId: factures[8].id });
  T({ societeId: "dbs", date: "2026-05-12", libelle: "VIR CABINET EXPERTISE & CO", montant: -ttc(1500, 20), categorie: "Honoraires", rapproche: true, lienType: "facture", lienId: factures[9].id });
  T({ societeId: "pnbs-paris", date: "2026-05-09", libelle: "PRLV OVH SAS", montant: -ttc(358, 20), categorie: "Hébergement", rapproche: true, lienType: "facture", lienId: factures[10].id });
  T({ societeId: "pnbs-lille", date: "2026-05-10", libelle: "PRLV VEOLIA PROPRETE", montant: -ttc(640, 10), categorie: "Entretien", rapproche: true, lienType: "facture", lienId: factures[11].id });

  // Décaissements récents À RAPPROCHER (matchent factures à valider/brouillon)
  T({ societeId: "pnbs-paris", date: "2026-05-30", libelle: "PRLV ORANGE BUSINESS SVC", montant: -ttc(412.50, 20), categorie: "Télécom" });
  T({ societeId: "pnbs-paris", date: "2026-05-29", libelle: "VIR SCI FONCIERE POTERIE LOYER", montant: -6800, categorie: "Loyer" });
  T({ societeId: "dbs", date: "2026-05-29", libelle: "PRLV GOOGLE ADS", montant: -ttc(3240, 20), categorie: "Publicité" });
  T({ societeId: "pnff", date: "2026-05-26", libelle: "PRLV CANVA", montant: -ttc(119, 20), categorie: "SaaS" });
  T({ societeId: "dbs", date: "2026-05-26", libelle: "PRLV GOOGLE WORKSPACE", montant: -ttc(624, 20), categorie: "SaaS" });

  // Décaissements divers non rattachés (salaires, frais) — restent à classer
  T({ societeId: "pnbs-paris", date: "2026-05-27", libelle: "VIR SALAIRES MAI 2026", montant: -28400, categorie: "Salaires" });
  T({ societeId: "dbs", date: "2026-05-27", libelle: "VIR SALAIRES MAI 2026", montant: -19200, categorie: "Salaires" });
  T({ societeId: "pnbs-lille", date: "2026-05-30", libelle: "CB STATION SERVICE TOTAL", montant: -84.20, categorie: "Déplacement" });

  return { factures, dossiers, transactions: tx };
})();
