/* =====================================================================
 * Compta PNG — Application (routeur, navigation, interactions)
 * ===================================================================== */
(function () {
  const V = PNG.views, S = PNG.store;

  const NAV = [
    { route: "dashboard", label: "Tableau de bord", icon: "▦" },
    { route: "factures", label: "Factures (OCR)", icon: "📄", badge: () => S.facturesAValider() },
    { route: "registre", label: "Registre factures", icon: "≡" },
    { route: "regler", label: "Factures à régler", icon: "€", badge: () => S.aRegler().length },
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

  function renderGlobalSoc() {
    const sel = document.getElementById("globalSoc");
    if (!sel) return;
    const scope = S.getScope();
    const opts = [`<option value="">🌐 Vue globale (toutes les sociétés)</option>`]
      .concat(PNG.companies.filter((c) => S.SOLDES_INIT[c.id]).map((c) => `<option value="${c.id}" ${c.id === scope ? "selected" : ""}>${c.raisonSociale}</option>`))
      .concat(PNG.companies.filter((c) => !S.SOLDES_INIT[c.id]).map((c) => `<option value="${c.id}" ${c.id === scope ? "selected" : ""}>${c.raisonSociale}</option>`));
    sel.innerHTML = opts.join("");
  }

  function render() {
    current = parseHash();
    renderSidebar();
    renderGlobalSoc();
    const view = document.getElementById("view");
    let html = "";
    switch (current.route) {
      case "collecte": location.hash = "#factures"; return; // collecte fusionnée dans factures
      case "factures": html = V.factures(current.filter); break;
      case "registre": html = V.registre(); break;
      case "regler": html = V.aReglerView(); break;
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
  let ocrActiveField = null; // {id, mode} champ ciblé pour l'OCR de zone
  function openModal(id) {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.factureModal(id);
    wrap.classList.remove("hidden");
    ocrActiveField = null;
    setupZoneOCR();
  }

  /* Sélection d'une zone sur l'aperçu pour océriser dans le champ ciblé */
  function setupZoneOCR() {
    const wrap = document.getElementById("ocrZoneWrap");
    const img = document.getElementById("ocrZoneImg");
    if (!wrap || !img) return;
    let startX, startY, box = null, dragging = false;

    function pos(ev) {
      const r = img.getBoundingClientRect();
      const e2 = ev.touches ? ev.touches[0] : ev;
      return { x: e2.clientX - r.left, y: e2.clientY - r.top };
    }
    function down(ev) {
      if (!ocrActiveField) { toast("① Cliquez d'abord le champ à remplir, puis dessinez la zone", "#ea580c"); return; }
      dragging = true; const p = pos(ev); startX = p.x; startY = p.y;
      box = document.createElement("div");
      box.style.cssText = "position:absolute;border:2px solid #2563eb;background:rgba(37,99,235,.15);pointer-events:none;z-index:5";
      wrap.appendChild(box); ev.preventDefault();
    }
    function move(ev) {
      if (!dragging || !box) return;
      const p = pos(ev);
      const x = Math.min(p.x, startX), y = Math.min(p.y, startY);
      const w = Math.abs(p.x - startX), h = Math.abs(p.y - startY);
      box.style.left = x + "px"; box.style.top = y + "px"; box.style.width = w + "px"; box.style.height = h + "px";
      ev.preventDefault();
    }
    async function up(ev) {
      if (!dragging || !box) return; dragging = false;
      const rect = { x: parseFloat(box.style.left), y: parseFloat(box.style.top), w: parseFloat(box.style.width || 0), h: parseFloat(box.style.height || 0) };
      const keep = box; setTimeout(() => keep && keep.remove(), 400);
      if (rect.w < 6 || rect.h < 6) { box.remove(); return; }
      const field = ocrActiveField;
      ocrOverlay("Lecture de la zone sélectionnée…", 0.5);
      try {
        const val = await PNG.ocr.ocrZone(img, rect, field.mode);
        ocrOverlayClose();
        const el = document.getElementById(field.id);
        if (el && val !== "" && val != null) {
          el.value = val;
          // recalcul si montant
          if (field.id === "edHT" || field.id === "edTaux") el.dispatchEvent(new Event("input", { bubbles: true }));
          toast("Zone océrisée → " + val, "#059669");
        } else toast("Rien de lisible dans cette zone", "#ea580c");
      } catch (err) { ocrOverlayClose(); toast("Erreur OCR zone : " + (err && err.message || "?"), "#dc2626"); }
    }
    wrap.addEventListener("mousedown", down); wrap.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    wrap.addEventListener("touchstart", down); wrap.addEventListener("touchmove", move); wrap.addEventListener("touchend", up);
  }
  function openMobileModal() {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.mobileModal();
    wrap.classList.remove("hidden");
  }
  function openFournModal(id) {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.nouveauFournModal(id);
    wrap.classList.remove("hidden");
    // lance une recherche auto avec le nom/SIRET pré-rempli
    setTimeout(() => lancerRechercheFourn(id), 50);
  }
  async function lancerRechercheFourn(id) {
    const input = document.getElementById("fournSearch");
    const box = document.getElementById("fournResults");
    if (!box) return;
    const q = input ? input.value : "";
    box.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">🔎 Recherche data.gouv…</p>`;
    const r = await PNG.utils.searchEntreprises(q, 6);
    if (!r.ok) { box.innerHTML = `<p class="text-sm text-red-500 text-center py-6">Erreur : ${r.raison}</p>`; return; }
    box.innerHTML = V.renderFournResults(id, r.results);
  }
  function closeModal() {
    const wrap = document.getElementById("modal");
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
  }

  /* --------- Chargement d'un vrai fichier + OCR réel --------------- */
  function ouvrirFichier() {
    let input = document.getElementById("fileInput");
    if (!input) {
      input = document.createElement("input");
      input.type = "file"; input.id = "fileInput";
      input.accept = "application/pdf,image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        input.value = "";
        if (file) traiterFichier(file);
      });
    }
    input.click();
  }

  function ocrOverlay(msg, pct) {
    let o = document.getElementById("ocrOverlay");
    if (!o) {
      o = document.createElement("div");
      o.id = "ocrOverlay";
      o.className = "fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4";
      document.body.appendChild(o);
    }
    o.innerHTML = `<div class="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
      <div class="text-4xl mb-3">🔍</div>
      <p class="font-semibold text-slate-800 mb-1">Océrisation en cours…</p>
      <p class="text-xs text-slate-500 mb-3">${msg || ""}</p>
      <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div class="bg-blue-600 h-2 transition-all" style="width:${Math.round((pct||0)*100)}%"></div></div>
      <p class="text-xs text-slate-400 mt-2">Le traitement se fait dans votre navigateur (aucun envoi serveur).</p>
    </div>`;
  }
  function ocrOverlayClose() { const o = document.getElementById("ocrOverlay"); if (o) o.remove(); }

  async function traiterFichier(file) {
    if (!PNG.ocr || !PNG.ocr.dispo()) {
      toast("Module OCR non chargé (vérifiez la connexion internet)", "#dc2626");
      return;
    }
    ocrOverlay("Lecture du fichier…", 0.05);
    try {
      const { apercu, champs } = await PNG.ocr.analyser(file, (p, m) => ocrOverlay(m, p));
      ocrOverlayClose();
      // société : celle filtrée si une est sélectionnée, sinon la 1re active
      const scope = S.getScope();
      const f = S.creerDepuisOCR(champs, {
        societeId: scope || undefined, source: "upload",
        fichier: file.name, apercu,
      });
      const c = PNG.utils.companyById(f.societeId);
      toast(`Facture océrisée : ${f.fournisseur || "?"} → ${c ? c.code : "?"}`, "#059669");
      if (location.hash.slice(1).split("/")[0] !== "factures") location.hash = "#factures/a_saisir";
      render();
      setTimeout(() => openModal(f.id), 150);
    } catch (err) {
      ocrOverlayClose();
      toast("Échec de l'océrisation : " + (err && err.message ? err.message : "erreur"), "#dc2626");
    }
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
    const t = ev.target.closest("[data-filter],[data-finfilter],[data-open],[data-valider],[data-compta],[data-paye],[data-savefac],[data-saisirpaie],[data-verifbanque],[data-siren],[data-newfourn],[data-pickent],[data-rappro],[data-rapprochoix],[data-unrappro],#btnScan,#btnSimEmail,#btnAutoRappro,#btnSyncBanque,#btnVerifPaie,#btnDeposeMobile,#mobEnvoyer,#btnFournSearch,#closeModal,#modalBack,#btnReset");
    if (!t) return;

    if (t.id === "modalBack" && ev.target.id === "modalBack") return closeModal();
    if (t.id === "closeModal") return closeModal();

    if (t.dataset.filter != null) { location.hash = `#factures/${t.dataset.filter}`; return; }
    if (t.dataset.finfilter != null) { location.hash = `#financements/${t.dataset.finfilter}`; return; }
    if (t.dataset.open) { openModal(t.dataset.open); return; }

    if (t.dataset.valider) { S.validerBrouillon(t.dataset.valider); toast("Facture validée en brouillon ✓", "#2563eb"); closeModal(); render(); return; }
    if (t.dataset.compta) { S.comptabiliser(t.dataset.compta); toast("Écriture comptabilisée ✓", "#059669"); closeModal(); render(); return; }
    if (t.dataset.paye) { S.marquerPaye(t.dataset.paye, t.dataset.val === "1"); toast(t.dataset.val === "1" ? "Facture marquée payée ✓" : "Paiement annulé", "#059669"); openModal(t.dataset.paye); render(); return; }
    if (t.dataset.savefac) {
      const id = t.dataset.savefac;
      const v = (i) => { const el = document.getElementById(i); return el ? el.value : null; };
      S.editFacture(id, {
        fournisseur: v("edFournisseur"), societeId: v("edSoc"), numeroFacture: v("edNum"),
        categorie: v("edCat"), dateFacture: v("edDate"), echeance: v("edEch"),
        montantHT: v("edHT"), tauxTva: v("edTaux"), montantTVA: v("edTVA"), montantTTC: v("edTTC"),
      });
      toast("Modifications enregistrées ✓", "#0f172a");
      openModal(id); render(); return;
    }
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
      if (r.ok) {
        const inter = r.interSociete ? ` ↔ réglé par ${(PNG.utils.companyById(r.regleParSocieteId)||{}).code || "une autre société"}` : "";
        toast(`Paiement vérifié en banque ✓${inter}${r.modeOk === false ? " (⚠︎ mode différent)" : ""}`, r.interSociete ? "#7c3aed" : (r.modeOk === false ? "#ea580c" : "#059669"));
      } else toast("Aucun règlement trouvé (ni dans les autres sociétés)", "#dc2626");
      openModal(t.dataset.verifbanque); render(); return;
    }
    if (t.dataset.siren) {
      toast("Recherche data.gouv en cours…", "#2563eb");
      S.enrichirSiren(t.dataset.siren, true).then((r) => {
        toast(r && r.found ? `Identifié : ${r.nom} (SIREN ${r.siren})` : `Non trouvé (${(r&&r.raison)||"?"})`, r && r.found ? "#059669" : "#64748b");
        openModal(t.dataset.siren); render();
      });
      return;
    }
    if (t.dataset.newfourn) { openFournModal(t.dataset.newfourn); return; }
    if (t.id === "btnFournSearch") { lancerRechercheFourn(t.dataset.id); return; }
    if (t.dataset.pickent) {
      try {
        const data = JSON.parse(t.getAttribute("data-ent"));
        S.appliquerEntreprise(t.dataset.pickent, data);
        toast(`Fournisseur enregistré : ${data.nom}`, "#059669");
        openModal(t.dataset.pickent); render();
      } catch (err) { toast("Erreur sélection", "#dc2626"); }
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

    if (t.id === "btnScan") { ouvrirFichier(); return; }
    if (t.id === "btnSimEmail") {
      const scope = S.getScope();
      const f = S.recevoirEmail(scope || undefined);
      const c = PNG.utils.companyById(f.societeId);
      toast(`✉️ Facture reçue par email de ${f.sourceEmail} → ${c ? c.raisonSociale : "?"}`, "#7c3aed");
      render(); setTimeout(() => openModal(f.id), 150); return;
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
  // Sélection du champ cible pour l'OCR de zone (focus / clic)
  document.addEventListener("focusin", (ev) => {
    const el = ev.target;
    if (el && el.dataset && el.dataset.ocrfield) {
      ocrActiveField = { id: el.id, mode: el.dataset.ocrfield };
      // surbrillance visuelle du champ actif
      document.querySelectorAll("[data-ocrfield]").forEach((x) => x.classList.remove("ring-2", "ring-blue-400"));
      el.classList.add("ring-2", "ring-blue-400");
      const hint = document.getElementById("zoneHint");
      if (hint) hint.textContent = "② Dessinez la zone sur la facture pour remplir « " + (el.previousElementSibling ? el.previousElementSibling.textContent : el.id) + " »";
    }
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.id === "selCpt") { S.setFactureCompte(el.dataset.id, el.value); toast("Compte modifié"); }
    if (el.name === "mobPaie") {
      const d = document.getElementById("mobPaieDetails");
      if (d) d.classList.toggle("hidden", el.value !== "paye");
    }
    if (el.id === "globalSoc") { S.setScope(el.value); render(); }
  });

  // Recalcul live des montants dans la fiche facture (sans recharger la modale)
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.id !== "edHT" && el.id !== "edTaux") return;
    const ht = parseFloat((document.getElementById("edHT")||{}).value);
    const taux = parseFloat((document.getElementById("edTaux")||{}).value);
    if (isNaN(ht) || isNaN(taux)) return;
    const tva = Math.round((ht * taux / 100) * 100) / 100;
    const tvaEl = document.getElementById("edTVA"); if (tvaEl) tvaEl.value = tva;
    const ttcEl = document.getElementById("edTTC"); if (ttcEl) ttcEl.value = Math.round((ht + tva) * 100) / 100;
  });

  window.addEventListener("hashchange", render);
  // Échap ferme la modale
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeModal(); });

  /* ------------------------------ Init ----------------------------- */
  // Démarrage protégé : si d'anciennes données cassent le rendu, on
  // réinitialise automatiquement au lieu d'afficher une page blanche.
  function safeRender() {
    try { render(); }
    catch (err) {
      console.error("Rendu en échec, réinitialisation :", err);
      try { S.reset(); render(); }
      catch (e2) {
        var v = document.getElementById("view");
        if (v) v.innerHTML = '<div class="p-8 text-red-600">Erreur d\'affichage. Cliquez sur « Réinitialiser les données démo » en bas à gauche, ou videz le cache (Cmd+Shift+R).</div>';
      }
    }
  }
  try { S.load(); } catch (e) { try { S.reset(); } catch (e2) {} }
  S.subscribe(() => { try { renderSidebar(); } catch (e) {} });
  window.PNG._render = safeRender;
  safeRender();
})();
