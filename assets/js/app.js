/* =====================================================================
 * Compta PNG — Application (routeur, navigation, interactions)
 * ===================================================================== */
(function () {
  const V = PNG.views, S = PNG.store;

  const NAV = [
    { route: "dashboard", label: "Tableau de bord", icon: "▦" },
    { route: "factures", label: "Factures à valider", icon: "📄", badge: () => S.facturesAValider() },
    { route: "collecte", label: "Collecte par email", icon: "📥" },
    { route: "registre", label: "Registre factures", icon: "≡" },
    { route: "regler", label: "Factures à régler", icon: "€", badge: () => S.aRegler().length },
    { route: "fournisseurs", label: "Fournisseurs", icon: "🏷️" },
    { route: "banque", label: "Banque & rapprochement", icon: "⇄", badge: () => S.get().transactions.filter(t=>!t.rapproche).length },
    { route: "tva", label: "TVA", icon: "T" },
    { route: "financements", label: "Financements / ERP", icon: "🎓" },
    { route: "societes", label: "Sociétés", icon: "🏢" },
    { route: "plan", label: "Plan comptable", icon: "≣" },
    { route: "fonctionnalites", label: "Fonctionnalités", icon: "★" },
    { route: "ocr", label: "Réglages OCR", icon: "⚙" },
  ];

  let current = { route: "dashboard", filter: null };

  function parseHash() {
    const h = (location.hash || "#dashboard").slice(1);
    const slash = h.indexOf("/");
    const route = slash >= 0 ? h.slice(0, slash) : h;
    const filter = slash >= 0 ? decodeURIComponent(h.slice(slash + 1)) : null;
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
      case "collecte": html = V.collecte(); break;
      case "factures": html = V.factures(current.filter); break;
      case "registre": html = V.registre(); break;
      case "regler": html = V.aReglerView(); break;
      case "fournisseurs": html = V.fournisseurs(); break;
      case "fournisseur": html = V.fournisseurDetail(current.filter, PNG._foPeriode || {}); break;
      case "banque": html = V.banque(); break;
      case "tva": html = V.tvaView(); break;
      case "financements": html = V.financements(current.filter); break;
      case "societes": html = V.societes(); break;
      case "societe": html = V.societeDetail(current.filter, PNG._scPeriode || {}); break;
      case "facturesfiltre": html = V.facturesFiltre(current.filter); break;
      case "plan": html = V.plan(); break;
      case "fonctionnalites": html = V.fonctionnalites(); break;
      case "ocr": html = V.ocrSettings(); break;
      default: html = V.dashboard();
    }
    view.innerHTML = html;
    if (current.route === "dashboard") setTimeout(V.dashboardCharts, 30);
    if (current.route === "fournisseur") setTimeout(() => V.fournisseurDetailCharts(current.filter, PNG._foPeriode || {}), 40);
    if (current.route === "societe") setTimeout(() => V.societeDetailCharts(current.filter, PNG._scPeriode || {}), 40);
    window.scrollTo(0, 0);
  }

  /* --------------------------- Modale ------------------------------ */
  let ocrActiveField = null; // {id, mode} champ ciblé pour l'OCR de zone
  let ocrPage = 0;           // page d'aperçu courante (factures multi-pages)
  function openModal(id) {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.factureModal(id);
    wrap.classList.remove("hidden");
    ocrActiveField = null;
    ocrPage = 0;
    setupZoneOCR();
  }

  // File de validation : factures "à saisir" dans le périmètre société courant
  function fileASaisir() {
    return S.get().factures.filter(S.inScope).filter((f) => f.statut === "ocr" || f.statut === "a_valider");
  }
  // Navigue depuis une facture vers la précédente/suivante (toutes factures)
  function naviguerFacture(id, dir) {
    const all = S.get().factures.filter(S.inScope);
    const i = all.findIndex((f) => f.id === id);
    if (i < 0) return;
    let j = i + (dir === "next" ? 1 : -1);
    if (j < 0) j = all.length - 1;
    if (j >= all.length) j = 0;
    openModal(all[j].id);
  }
  // Ouvre la prochaine facture "à saisir" (après validation), sinon ferme
  function ouvrirSuivanteASaisir(currentId) {
    const file = fileASaisir().filter((f) => f.id !== currentId);
    if (file.length) { openModal(file[0].id); toast("Facture suivante à saisir →", "#2563eb"); }
    else { closeModal(); toast("🎉 Toutes les factures à saisir sont traitées !", "#059669"); }
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
    if (!PNG.ocr) { toast("Module OCR non chargé", "#dc2626"); return; }
    ocrOverlay("Lecture du fichier…", 0.05);
    try {
      const res = await PNG.ocr.analyser(file, (p, m) => ocrOverlay(m, p));
      const apercu = res.apercu, champs = res.champs;
      ocrOverlayClose();
      // société : celle filtrée si une est sélectionnée, sinon la 1re active
      const scope = S.getScope();
      const f = S.creerDepuisOCR(champs, {
        societeId: scope || undefined, source: "upload",
        fichier: file.name, apercu, apercus: res.apercus,
      });
      const c = PNG.utils.companyById(f.societeId);
      toast(`OCR (${champs.moteur||"?"}) : ${f.fournisseur || "?"} → ${c ? c.code : "?"}`, "#059669");
      if (location.hash.slice(1).split("/")[0] !== "factures") location.hash = "#factures/a_saisir";
      render();
      setTimeout(() => openModal(f.id), 150);
    } catch (err) {
      ocrOverlayClose();
      // On crée quand même la facture pour montrer l'aperçu + le diagnostic
      try {
        let apercu = null;
        try { apercu = await PNG.ocr.pdfExtractText ? null : null; } catch (e) {}
        const f = S.creerDepuisOCR({ fournisseur: "", texteBrut: "ERREUR OCR : " + (err && err.message ? err.message : err), moteur: "échec" }, { source: "upload", fichier: file.name });
        toast("OCR en échec : ouvrez la fiche → Diagnostic OCR", "#dc2626");
        render(); setTimeout(() => openModal(f.id), 150);
      } catch (e2) {
        toast("Échec : " + (err && err.message ? err.message : "erreur"), "#dc2626");
      }
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
    const t = ev.target.closest("[data-filter],[data-finfilter],[data-open],[data-navfac],[data-valider],[data-compta],[data-paye],[data-savefac],[data-suppfac],[data-pageprev],[data-pagenext],[data-savefourn],[data-verifdg],[data-addfourn],[data-saisirpaie],[data-saisirstatut],[data-verifbanque],[data-siren],[data-newfourn],[data-pickent],[data-rappro],[data-rapprochoix],[data-unrappro],[data-editfourn],[data-savefourndossier],[data-suppfourn],[data-newfourndossier],[data-fourndetail],[data-fournfac],[data-socdetail],[data-editsoc],[data-savesoc],[data-socfac],#btnAddSoc,#btnScan,#btnSimEmail,#btnGoogleConnect,#btnGoogleSync,#btnGoogleTestDrive,#btnAutoRappro,#btnSyncBanque,#btnVerifPaie,#btnDeposeMobile,#mobEnvoyer,#btnFournSearch,#btnSaveOcr,#btnSaveOcr2,#btnTestGemini,#regReset,#btnImportFourn,#btnAddFourn,#fournImportConfirm,#closeModal,#modalBack,#btnReset");
    if (!t) return;

    if (t.id === "modalBack" && ev.target.id === "modalBack") return closeModal();
    if (t.id === "closeModal") return closeModal();

    if (t.dataset.filter != null) { location.hash = `#factures/${t.dataset.filter}`; return; }
    if (t.dataset.finfilter != null) { location.hash = `#financements/${t.dataset.finfilter}`; return; }
    if (t.dataset.open) { openModal(t.dataset.open); return; }

    if (t.dataset.navfac) { naviguerFacture(t.dataset.id, t.dataset.navfac); return; }
    if (t.dataset.valider) { const id = t.dataset.valider; S.validerBrouillon(id); toast("Facture validée ✓", "#2563eb"); render(); ouvrirSuivanteASaisir(id); return; }
    if (t.dataset.compta) { const id = t.dataset.compta; S.comptabiliser(id); toast("Écriture comptabilisée ✓", "#059669"); render(); ouvrirSuivanteASaisir(id); return; }
    if (t.dataset.paye) { S.marquerPaye(t.dataset.paye, t.dataset.val === "1"); toast(t.dataset.val === "1" ? "Facture marquée payée ✓" : "Paiement annulé", "#059669"); openModal(t.dataset.paye); render(); return; }
    if (t.dataset.suppfac) {
      if (confirm("Supprimer définitivement cette facture et son écriture comptable ?")) {
        S.supprimerFacture(t.dataset.suppfac); closeModal(); toast("Facture supprimée 🗑", "#dc2626"); render();
      }
      return;
    }
    if (t.dataset.pageprev || t.dataset.pagenext) {
      const id = t.dataset.pageprev || t.dataset.pagenext;
      const f = S.get().factures.find((x) => x.id === id);
      if (f && f.apercus && f.apercus.length > 1) {
        ocrPage = (ocrPage || 0) + (t.dataset.pagenext ? 1 : -1);
        if (ocrPage < 0) ocrPage = f.apercus.length - 1;
        if (ocrPage >= f.apercus.length) ocrPage = 0;
        const img = document.getElementById("ocrZoneImg");
        const num = document.getElementById("ocrPageNum");
        if (img) img.src = f.apercus[ocrPage];
        if (num) num.textContent = ocrPage + 1;
      }
      return;
    }
    if (t.dataset.savefac) {
      const id = t.dataset.savefac;
      const v = (i) => { const el = document.getElementById(i); return el ? el.value : null; };
      // compte : la saisie manuelle prime, sinon la liste déroulante
      const compteManuel = (v("edCompteManuel") || "").trim();
      const compte = compteManuel || v("selCpt");
      S.editFacture(id, {
        fournisseur: v("edFournisseur"), societeId: v("edSoc"), numeroFacture: v("edNum"),
        categorie: v("edCat2") != null ? v("edCat2") : v("edCat"), dateFacture: v("edDate"), echeance: v("edEch"),
        montantHT: v("edHT"), tauxTva: v("edTaux"), montantTVA: v("edTVA"), montantTTC: v("edTTC"),
        compteCharge: compte,
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
    if (t.dataset.saisirstatut) {
      const id = t.dataset.saisirstatut;
      const statut = (document.getElementById("selStatutPaie") || {}).value || "a_payer";
      const mode = (document.getElementById("selMode") || {}).value || "";
      const date = (document.getElementById("selDatePaie") || {}).value || undefined;
      S.definirStatutPaiement(id, statut, mode, date);
      const lbl = { a_payer: "À payer", paye_attente: "À vérifier", paye_verifie: "Payée" }[statut];
      toast("Statut : " + lbl + " ✓", "#059669");
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
    if (t.dataset.savefourn) {
      const id = t.dataset.savefourn;
      const v = (i) => { const el = document.getElementById(i); return el ? el.value : null; };
      S.editFacture(id, { fournisseurSiren: v("edFSiren"), fournisseurSiret: v("edFSiret"), fournisseurNaf: v("edFNaf"), fournisseurAdresse: v("edFAdr") });
      toast("Identité fournisseur enregistrée ✓", "#0f172a");
      openModal(id); render(); return;
    }
    if (t.dataset.verifdg) {
      const id = t.dataset.verifdg;
      // enregistre d'abord ce qui est saisi (SIREN/SIRET) puis interroge data.gouv
      const v = (i) => { const el = document.getElementById(i); return el ? el.value : null; };
      S.editFacture(id, { fournisseurSiren: v("edFSiren"), fournisseurSiret: v("edFSiret") });
      toast("Vérification data.gouv en cours…", "#2563eb");
      S.enrichirSiren(id, true).then((r) => {
        toast(r && r.found ? `✓ ${r.nom} (SIREN ${r.siren})` : `Non trouvé (${(r&&r.raison)||"?"})`, r && r.found ? "#059669" : "#64748b");
        openModal(id); render();
      });
      return;
    }
    if (t.dataset.addfourn) {
      S.ajouterFournisseur(t.dataset.addfourn);
      toast("Fournisseur ajouté à la base ✓ — vous pouvez continuer la saisie", "#059669");
      openModal(t.dataset.addfourn); render(); return;
    }
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

    // ---- Connexion Google (Gmail + Drive) ----
    if (t.id === "btnGoogleConnect" || t.id === "btnGoogleSync" || t.id === "btnGoogleTestDrive") {
      enregistrerCfgGoogle();
      if (t.id === "btnGoogleConnect") {
        gLog("Ouverture de l'autorisation Google…", true);
        PNG.google.connect().then((r) => { gLog("✓ Connecté" + (r.email ? " : " + r.email : "")); toast("Google connecté ✓", "#059669"); render(); })
          .catch((e) => { gLog("❌ " + (e.message || e)); toast("Connexion Google échouée", "#dc2626"); });
        return;
      }
      if (t.id === "btnGoogleTestDrive") {
        gLog("Test de l'accès au Drive partagé…", true);
        PNG.google.testerDrive((l) => gLog(l)).then(() => toast("Accès Drive OK ✓", "#059669"))
          .catch((e) => { gLog("❌ " + (e.message || e)); toast("Accès Drive : échec", "#dc2626"); });
        return;
      }
      // btnGoogleSync
      const btn = document.getElementById("btnGoogleSync");
      if (btn) { btn.disabled = true; btn.textContent = "⏳ Synchronisation en cours…"; }
      gLog("Démarrage de la synchronisation…", true);
      PNG.google.synchroniser((l) => gLog(l)).then((r) => {
        toast(`📥 ${r.factures} facture(s) créée(s), ${r.archivees} archivée(s) sur le Drive`, "#059669");
        render();
      }).catch((e) => { gLog("❌ " + (e.message || e)); toast("Synchronisation échouée : " + (e.message || e), "#dc2626"); })
        .finally(() => { const b = document.getElementById("btnGoogleSync"); if (b) { b.disabled = false; b.textContent = "⬇️ Synchroniser les factures reçues"; } });
      return;
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

    if (t.id === "btnTestGemini") {
      // enregistre d'abord la clé saisie, puis teste
      const kg = (document.getElementById("ocrKeyGemini") || {}).value || "";
      if (PNG.ocr && PNG.ocr.setConfig) PNG.ocr.setConfig({ geminiKey: kg.trim(), useGemini: true });
      const box = document.getElementById("geminiTestResult");
      if (box) box.innerHTML = '<span class="text-slate-500">🧪 Test en cours…</span>';
      PNG.ocr.testerGemini().then((r) => {
        if (box) box.innerHTML = r.ok
          ? '<span class="text-emerald-700">' + PNG.utils.escapeHtml(r.message) + '</span>'
          : '<span class="text-red-600">❌ ' + PNG.utils.escapeHtml(r.message) + '</span>';
        toast(r.ok ? "IA Gemini opérationnelle ✓" : "IA Gemini : échec", r.ok ? "#059669" : "#dc2626");
      });
      return;
    }
    if (t.id === "btnSaveOcr" || t.id === "btnSaveOcr2") {
      const engine = (document.querySelector('input[name="ocrEngine"]:checked') || {}).value || "ocrspace";
      const ks = (document.getElementById("ocrKeySpace") || {}).value || "";
      const km = (document.getElementById("ocrKeyMindee") || {}).value || "";
      const kg = (document.getElementById("ocrKeyGemini") || {}).value || "";
      const useG = !!(document.getElementById("ocrUseGemini") || {}).checked;
      if (PNG.ocr && PNG.ocr.setConfig) PNG.ocr.setConfig({ engine: engine, ocrspaceKey: ks.trim(), mindeeKey: km.trim(), geminiKey: kg.trim(), useGemini: useG });
      toast(useG && kg.trim() ? "Réglages enregistrés ✓ — IA Gemini activée 🧠" : "Réglages OCR enregistrés ✓", "#059669");
      return;
    }
    if (t.id === "regReset") { PNG._regFiltre = { q:"", statut:"", fournisseur:"", societe:"", dateFactDe:"", dateFactA:"", dateRegDe:"", dateRegA:"" }; render(); return; }

    // ---- Fournisseurs : éditer / enregistrer / supprimer / ajouter / importer ----
    if (t.dataset.editfourn) { ouvrirFournDossierModal(t.dataset.editfourn); return; }
    if (t.id === "btnAddFourn") { ouvrirFournDossierModal(null); return; }
    if (t.dataset.fourndetail) { PNG._foPeriode = {}; location.hash = "#fournisseur/" + encodeURIComponent(t.dataset.fourndetail); return; }
    if (t.dataset.fournfac) { location.hash = "#facturesfiltre/" + encodeURIComponent("fourn|" + t.dataset.fournfac); return; }

    // ---- Sociétés : détail / modifier / ajouter / liste factures ----
    if (t.dataset.socdetail) { PNG._scPeriode = {}; location.hash = "#societe/" + encodeURIComponent(t.dataset.socdetail); return; }
    if (t.dataset.editsoc) { const w = document.getElementById("modal"); w.innerHTML = V.societeModal(t.dataset.editsoc); w.classList.remove("hidden"); return; }
    if (t.id === "btnAddSoc") { const w = document.getElementById("modal"); w.innerHTML = V.societeModal(null); w.classList.remove("hidden"); return; }
    if (t.dataset.socfac) { location.hash = "#facturesfiltre/" + encodeURIComponent("societe|" + t.dataset.socfac); return; }
    if (t.dataset.savesoc) {
      const id = t.dataset.savesoc;
      const v = (i) => { const el = document.getElementById(i); return el ? el.value : null; };
      const tvaSel = v("scTva");
      const champs = { raisonSociale: v("scNom"), code: v("scCode"), marque: v("scMarque"), siren: v("scSiren"), siret: v("scSiret"), formeJuridique: v("scForme"), representant: v("scRep"), nda: v("scNda"), opco: v("scOpco"), siege: v("scSiege"), tvaAssujetti: tvaSel === "oui" ? true : tvaSel === "non" ? false : null, solde: v("scSolde") };
      if (id === "new") { const c = S.creerSociete(champs); toast("Société ajoutée ✓", "#059669"); closeModal(); location.hash = "#societe/" + encodeURIComponent(c.id); render(); }
      else { S.modifierSociete(id, champs); toast("Société modifiée ✓", "#0f172a"); closeModal(); render(); }
      return;
    }
    if (t.dataset.savefourndossier) {
      const key = t.dataset.savefourndossier;
      const v = (i) => { const el = document.getElementById(i); return el ? el.value : null; };
      const champs = { nom: v("foNom"), societeId: v("foSoc"), categorie: v("foCat"), compteCharge: v("foCompte"), compteTiers: v("foTiers"), siren: v("foSiren"), siret: v("foSiret"), naf: v("foNaf"), adresse: v("foAdr"), email: v("foEmail"), telephone: v("foTel"), iban: v("foIban"), notes: v("foNotes") };
      if (key === "new") { S.creerFournisseurManuel(champs); toast("Fournisseur ajouté ✓", "#059669"); }
      else { S.modifierFournisseur(key, champs); toast("Fournisseur modifié ✓", "#0f172a"); }
      closeModal(); render(); return;
    }
    if (t.dataset.suppfourn) {
      if (confirm("Supprimer cette fiche fournisseur ?")) { S.supprimerFournisseur(t.dataset.suppfourn); closeModal(); toast("Fournisseur supprimé 🗑", "#dc2626"); render(); }
      return;
    }
    if (t.id === "btnImportFourn") { ouvrirImportFournModal(); return; }
    if (t.id === "fournImportConfirm") {
      const txt = (document.getElementById("fournImportText") || {}).value || "";
      const lignes = parserTableauFournisseurs(txt);
      if (!lignes.length) { toast("Aucune ligne détectée (collez le tableau avec entêtes)", "#dc2626"); return; }
      const r = S.importerFournisseurs(lignes, S.getScope() || undefined);
      closeModal(); toast(`Import : ${r.cree} créé(s), ${r.maj} mis à jour ✓`, "#059669"); render(); return;
    }

    if (t.id === "btnReset") { if (confirm("Réinitialiser toutes les données de démonstration ?")) { S.reset(); toast("Données réinitialisées", "#64748b"); render(); } return; }
  });

  /* ---- Connexion Google : config + journal en direct --------------- */
  function enregistrerCfgGoogle() {
    if (!PNG.google) return;
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : undefined; };
    const c = {};
    const ci = v("gClientId"); if (ci !== undefined) c.clientId = ci;
    const di = v("gDriveId"); if (di !== undefined) c.driveId = di;
    const ra = v("gRacine"); if (ra !== undefined) c.racineNom = ra;
    const q = v("gQuery"); if (q !== undefined) c.query = q;
    PNG.google.setCfg(c);
  }
  function gLog(line, reset) {
    const box = document.getElementById("googleLog");
    if (!box) return;
    box.classList.remove("hidden");
    const t = new Date().toLocaleTimeString("fr-FR");
    box.textContent = (reset ? "" : box.textContent + "\n") + "[" + t + "] " + line;
    box.scrollTop = box.scrollHeight;
  }

  /* ---- Fournisseurs : modales d'édition et d'import ---------------- */
  function ouvrirFournDossierModal(key) {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.fournDossierModal(key);
    wrap.classList.remove("hidden");
  }
  function ouvrirImportFournModal() {
    const wrap = document.getElementById("modal");
    wrap.innerHTML = V.importFournModal();
    wrap.classList.remove("hidden");
  }
  // Parse un tableau collé (TSV depuis Excel, ou CSV) avec ligne d'entête
  function parserTableauFournisseurs(txt) {
    const lignes = txt.split(/\r?\n/).filter((l) => l.trim());
    if (lignes.length < 2) return [];
    const sep = lignes[0].indexOf("\t") >= 0 ? "\t" : (lignes[0].indexOf(";") >= 0 ? ";" : ",");
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
    const entetes = lignes[0].split(sep).map(norm);
    return lignes.slice(1).map((l) => {
      const cells = l.split(sep);
      const o = {};
      entetes.forEach((h, i) => { o[h] = (cells[i] || "").trim(); });
      // alias d'entêtes courants
      o.nom = o.nom || o.fournisseur || o.raisonsociale || o.societe2 || "";
      o.comptecharge = o.comptecharge || o.compte || o.comptecomptable || o.codecomptable || o.codecompte || "";
      o.comptetiers = o.comptetiers || o.compteauxiliaire || o.tiers || "";
      o.telephone = o.telephone || o.tel || o.telephone1 || "";
      o.email = o.email || o.mail || o.courriel || "";
      return o;
    });
  }

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

  // Filtres du registre : selects + dates -> re-render ; texte -> via input plus bas
  const REG_FILTER_IDS = { regStatut: "statut", regSociete: "societe", regDateFactDe: "dateFactDe", regDateFactA: "dateFactA", regDateRegDe: "dateRegDe", regDateRegA: "dateRegA" };
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (REG_FILTER_IDS[el.id]) { PNG._regFiltre[REG_FILTER_IDS[el.id]] = el.value; render(); return; }
    if (el.id === "foDetailAnnee") { PNG._foPeriode = Object.assign({}, PNG._foPeriode, { annee: el.value }); render(); return; }
    if (el.id === "foDetailMois") { PNG._foPeriode = Object.assign({}, PNG._foPeriode, { mois: el.value }); render(); return; }
    if (el.id === "scDetailAnnee") { PNG._scPeriode = Object.assign({}, PNG._scPeriode, { annee: el.value }); render(); return; }
    if (el.id === "scDetailMois") { PNG._scPeriode = Object.assign({}, PNG._scPeriode, { mois: el.value }); render(); return; }
    if (el.id === "selCpt") { S.setFactureCompte(el.dataset.id, el.value); toast("Compte modifié"); }
    if (el.id === "selStatutPaie") {
      // active/désactive visuellement le mode+date selon le statut choisi
      const d = document.getElementById("paieDetails");
      if (d) d.classList.toggle("opacity-50", el.value === "a_payer");
    }
    if (el.name === "mobPaie") {
      const d = document.getElementById("mobPaieDetails");
      if (d) d.classList.toggle("hidden", el.value !== "paye");
    }
    if (el.id === "globalSoc") { S.setScope(el.value); render(); }
  });

  // Recherche texte du registre / fournisseurs : filtre avec léger délai (garde le focus)
  let _filtreT;
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.id === "regQ" || el.id === "regFournisseur") {
      PNG._regFiltre[el.id === "regQ" ? "q" : "fournisseur"] = el.value;
      clearTimeout(_filtreT); _filtreT = setTimeout(() => { render(); const f = document.getElementById(el.id); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250);
      return;
    }
    if (el.id === "fournQ") {
      PNG._fournFiltre = el.value;
      clearTimeout(_filtreT); _filtreT = setTimeout(() => { render(); const f = document.getElementById("fournQ"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250);
      return;
    }
    if (el.id === "socQ") {
      PNG._socQ = el.value;
      clearTimeout(_filtreT); _filtreT = setTimeout(() => { render(); const f = document.getElementById("socQ"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250);
      return;
    }
    // Config Google : persiste la saisie au fil de l'eau (sans re-render)
    if (el.id === "gClientId" || el.id === "gDriveId" || el.id === "gRacine" || el.id === "gQuery") {
      const map = { gClientId: "clientId", gDriveId: "driveId", gRacine: "racineNom", gQuery: "query" };
      if (PNG.google) PNG.google.setCfg({ [map[el.id]]: el.value.trim() });
      return;
    }
  });

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
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") return closeModal();
    // flèches ← → pour naviguer entre factures (si la fiche est ouverte et qu'on ne tape pas dans un champ)
    const modalOuvert = !document.getElementById("modal").classList.contains("hidden");
    const tag = (ev.target && ev.target.tagName) || "";
    if (modalOuvert && (ev.key === "ArrowLeft" || ev.key === "ArrowRight") && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
      const nav = document.querySelector('[data-navfac="' + (ev.key === "ArrowRight" ? "next" : "prev") + '"]');
      if (nav) { ev.preventDefault(); naviguerFacture(nav.dataset.id, ev.key === "ArrowRight" ? "next" : "prev"); }
    }
  });

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
