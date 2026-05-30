/* =====================================================================
 * Compta PNG — Application (routeur, navigation, interactions)
 * ===================================================================== */
(function () {
  const V = PNG.views, S = PNG.store;

  const NAV = [
    { route: "dashboard", label: "Tableau de bord", icon: "▦" },
    { route: "collecte", label: "Collecte email", icon: "✉️", badge: () => S.emailsEnAttente() },
    { route: "factures", label: "Factures (OCR)", icon: "📄", badge: () => S.facturesAValider() },
    { route: "registre", label: "Registre factures", icon: "≡" },
    { route: "fournisseurs", label: "Fournisseurs", icon: "🏷️" },
    { route: "banque", label: "Banque & rapprochement", icon: "⇄", badge: () => S.get().transactions.filter(t=>!t.rapproche).length },
    { route: "tva", label: "TVA", icon: "T" },
    { route: "financements", label: "Financements / ERP", icon: "🎓" },
    { route: "societes", label: "Sociétés", icon: "🏢" },
    { route: "plan", label: "Plan comptable", icon: "≣" },
    { route: "fonctionnalites", label: "Fonctionnalités", icon: "★" },
  ];

  let current = { route: "dashboard", filter: null };

  function parseHash() {
    const h = (location.hash || "#dashboard").slice(1);
    const [route, filter] = h.split("/");
    return { route: route || "dashboard", filter: filter || null };
  }

  function renderSidebar() {
    const el = document.getElementById("nav");
    el.innerHTML = NAV.map((n) => {
      const active = current.route === n.route;
      const b = n.badge ? n.badge() : 0;
      return `<a href="#${n.route}" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}">
        <span class="w-5 text-center">${n.icon}</span><span class="flex-1">${n.label}</span>
        ${b ? `<span class="text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/25" : "bg-amber-100 text-amber-700"}">${b}</span>` : ""}
      </a>`;
    }).join("");
  }

  function render() {
    current = parseHash();
    renderSidebar();
    const view = document.getElementById("view");
    let html = "";
    switch (current.route) {
      case "collecte": html = V.collecte(); break;
      case "factures": html = V.factures(current.filter); break;
      case "registre": html = V.registre(); break;
      case "fournisseurs": html = V.fournisseurs(); break;
      case "banque": html = V.banque(); break;
      case "tva": html = V.tvaView(); break;
      case "financements": html = V.financements(current.filter); break;
      case "societes": html = V.societes(); break;
      case "plan": html = V.plan(); break;
      case "fonctionnalites": html = V.fonctionnalites(); break;
      default: html = V.dashboard();
    }
    view.innerHTML = html;
    if (current.route === "dashboard") setTimeout(V.dashboardCharts, 30);
    window.scrollTo(0, 0);
  }

  /* --------------------------- Modale ------------------------------ */
  function openModal(id) {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.factureModal(id);
    wrap.classList.remove("hidden");
  }
  function openMobileModal() {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.mobileModal();
    wrap.classList.remove("hidden");
  }
  function closeModal() {
    const wrap = document.getElementById("modal");
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
  }

  /* --------------------------- Toast ------------------------------- */
  let toastT;
  function toast(msg, color) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.style.background = color || "#1e293b";
    t.classList.remove("opacity-0", "translate-y-3");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.add("opacity-0", "translate-y-3"), 2600);
  }

  /* --------------------- Délégation d'événements ------------------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-filter],[data-finfilter],[data-open],[data-valider],[data-compta],[data-paye],[data-saisirpaie],[data-verifbanque],[data-siren],[data-traitemail],[data-rappro],[data-rapprochoix],[data-unrappro],#btnScan,#btnSimEmail,#btnTraiterMails,#btnAutoRappro,#btnSyncBanque,#btnVerifPaie,#btnDeposeMobile,#mobEnvoyer,#closeModal,#modalBack,#btnReset");
    if (!t) return;

    if (t.id === "modalBack" && ev.target.id === "modalBack") return closeModal();
    if (t.id === "closeModal") return closeModal();

    if (t.dataset.filter != null) { location.hash = `#factures/${t.dataset.filter}`; return; }
    if (t.dataset.finfilter != null) { location.hash = `#financements/${t.dataset.finfilter}`; return; }
    if (t.dataset.open) { openModal(t.dataset.open); return; }

    if (t.dataset.valider) { S.validerBrouillon(t.dataset.valider); toast("Facture validée en brouillon ✓", "#2563eb"); closeModal(); render(); return; }
    if (t.dataset.compta) { S.comptabiliser(t.dataset.compta); toast("Écriture comptabilisée ✓", "#059669"); closeModal(); render(); return; }
    if (t.dataset.paye) { S.marquerPaye(t.dataset.paye, t.dataset.val === "1"); toast(t.dataset.val === "1" ? "Facture marquée payée ✓" : "Paiement annulé", "#059669"); openModal(t.dataset.paye); render(); return; }
    if (t.dataset.saisirpaie) {
      const id = t.dataset.saisirpaie;
      const mode = (document.getElementById("selMode") || {}).value || "";
      const date = (document.getElementById("selDatePaie") || {}).value || S.get && undefined;
      if (!mode) { toast("Choisissez un mode de paiement", "#dc2626"); return; }
      S.saisirPaiement(id, mode, date);
      toast("Paiement enregistré — à vérifier en banque", "#2563eb");
      openModal(id); render(); return;
    }
    if (t.dataset.verifbanque) {
      const r = S.verifierPaiementBanque(t.dataset.verifbanque);
      if (r.ok) toast(`Paiement vérifié en banque ✓${r.modeOk === false ? " (⚠︎ mode différent du relevé)" : ""}`, r.modeOk === false ? "#ea580c" : "#059669");
      else toast("Aucune écriture bancaire correspondante", "#dc2626");
      openModal(t.dataset.verifbanque); render(); return;
    }
    if (t.dataset.siren) {
      toast("Recherche data.gouv en cours…", "#2563eb");
      S.enrichirSiren(t.dataset.siren).then((r) => {
        toast(r && r.found ? `Identifié : SIREN ${r.siren}` : `Non trouvé (${(r&&r.raison)||"?"})`, r && r.found ? "#059669" : "#64748b");
        openModal(t.dataset.siren); render();
      });
      return;
    }
    if (t.id === "btnVerifPaie") { const n = S.verifierTousPaiements(); toast(n ? `${n} paiement(s) vérifié(s) en banque ✓` : "Aucun paiement en attente de vérification", n ? "#059669" : "#64748b"); render(); return; }
    if (t.id === "btnDeposeMobile") { openMobileModal(); return; }
    if (t.id === "mobEnvoyer") {
      const soc = (document.getElementById("mobSoc")||{}).value;
      const salarie = (document.getElementById("mobSalarie")||{}).value || "Salarié (mobile)";
      const paye = document.querySelector('input[name="mobPaie"]:checked');
      const opts = { societeId: soc, salarie };
      if (paye && paye.value === "paye") { opts.statutPaiement = "paye"; opts.modePaiement = (document.getElementById("mobMode")||{}).value || "cb"; opts.datePaiement = (document.getElementById("mobDate")||{}).value; }
      const f = S.deposerMobile(opts);
      closeModal();
      toast(`📱 Facture envoyée : ${f.fournisseur} → ${PNG.utils.companyById(f.societeId).code}`, "#0f172a");
      render(); setTimeout(() => openModal(f.id), 150); return;
    }

    if (t.id === "btnScan") {
      const f = S.scanNouvelleFacture();
      const c = PNG.utils.companyById(f.societeId);
      toast(`OCR : ${f.fournisseur} → ${c ? c.raisonSociale : "?"} (${Math.round(f.societeConfiance*100)}%)`, "#7c3aed");
      render(); setTimeout(() => openModal(f.id), 150); return;
    }
    if (t.id === "btnSimEmail") {
      const m = S.recevoirEmail();
      toast(`✉️ Email reçu de ${m.de} — facture en attente d'OCR`, "#7c3aed");
      if (location.hash.slice(1).split("/")[0] !== "collecte") location.hash = "#collecte"; else render();
      return;
    }
    if (t.dataset.traitemail) {
      const f = S.traiterEmail(t.dataset.traitemail);
      if (f) { const c = PNG.utils.companyById(f.societeId); toast(`Pré-saisie OCR : ${f.fournisseur} → ${c ? c.raisonSociale : "?"}${f.doublonDe ? " ⚠︎ doublon" : ""}`, "#059669"); render(); setTimeout(() => openModal(f.id), 150); }
      return;
    }
    if (t.id === "btnTraiterMails") {
      const n = S.traiterTousEmails();
      toast(n ? `${n} facture(s) pré-saisie(s) depuis les emails ✓` : "Aucun email à traiter", n ? "#059669" : "#64748b");
      render(); return;
    }

    if (t.dataset.rappro) { S.rapprocher(t.dataset.rappro, t.dataset.ctype, t.dataset.cid); closeModal(); toast("Écriture rapprochée ✓", "#059669"); render(); return; }
    if (t.dataset.rapprochoix) {
      const wrap = document.getElementById("modal");
      wrap.innerHTML = V.rapproManuelModal(t.dataset.rapprochoix);
      wrap.classList.remove("hidden");
      return;
    }
    if (t.dataset.unrappro) { S.annulerRapprochement(t.dataset.unrappro); toast("Rapprochement annulé", "#64748b"); render(); return; }
    if (t.id === "btnAutoRappro") { const n = S.rapprochementAuto(); toast(n ? `${n} écriture(s) rapprochée(s) automatiquement ✓` : "Aucun rapprochement automatique possible", n ? "#059669" : "#64748b"); render(); return; }
    if (t.id === "btnSyncBanque") { const n = S.synchroniserBanque(); toast(`🔄 ${n} écriture(s) bancaire(s) remontée(s)`, "#0f172a"); render(); return; }

    if (t.id === "btnReset") { if (confirm("Réinitialiser toutes les données de démonstration ?")) { S.reset(); toast("Données réinitialisées", "#64748b"); render(); } return; }
  });

  // Changements de sélection dans la modale (société / compte)
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.id === "selSoc") { S.setFactureSociete(el.dataset.id, el.value); toast("Société réaffectée"); openModal(el.dataset.id); }
    if (el.id === "selCpt") { S.setFactureCompte(el.dataset.id, el.value); toast("Compte modifié"); openModal(el.dataset.id); }
    if (el.name === "mobPaie") {
      const d = document.getElementById("mobPaieDetails");
      if (d) d.classList.toggle("hidden", el.value !== "paye");
    }
  });

  window.addEventListener("hashchange", render);
  document.getElementById("btnReset2") && document.getElementById("btnReset2").addEventListener("click", () => {});

  /* ------------------------------ Init ----------------------------- */
  S.load();
  S.subscribe(() => { /* re-render léger de la sidebar pour les badges */ renderSidebar(); });
  render();
  window.PNG._render = render;
})();
