/* =====================================================================
 * Compta PNG — Vues (rendu HTML de chaque module)
 * ===================================================================== */
window.PNG = window.PNG || {};

PNG.views = (function () {
  const U = PNG.utils, S = PNG.store;
  const e = U.escapeHtml;

  /* --------------------------- Composants UI ----------------------- */
  function kpiCard(label, value, sub, color, icon) {
    return `
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">${e(label)}</p>
            <p class="text-2xl font-bold text-slate-800 mt-1">${value}</p>
            ${sub ? `<p class="text-xs text-slate-400 mt-1">${sub}</p>` : ""}
          </div>
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg" style="background:${color}">${icon}</div>
        </div>
      </div>`;
  }
  function badge(label, cls) { return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${cls}">${e(label)}</span>`; }
  function confBadge(c) {
    const cls = c >= 0.9 ? "bg-emerald-100 text-emerald-700" : c >= 0.75 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return badge(Math.round(c * 100) + "%", cls);
  }
  function societeChip(id) {
    const c = U.companyById(id); if (!c) return "—";
    return `<span class="inline-flex items-center gap-1.5 text-sm"><span class="w-2.5 h-2.5 rounded-full" style="background:${c.couleur}"></span>${e(c.raisonSociale)}</span>`;
  }
  // Bandeau indiquant la vue courante (société sélectionnée ou globale)
  function scopeBanner() {
    const id = S.getScope();
    if (!id) return `<div class="inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1 mb-3">🌐 Vue globale — toutes les sociétés</div>`;
    const c = U.companyById(id); if (!c) return "";
    return `<div class="inline-flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1 mb-3" style="background:${c.couleur}1a;color:${c.couleur}"><span class="w-2 h-2 rounded-full" style="background:${c.couleur}"></span>Vue : ${e(c.raisonSociale)}</div>`;
  }
  function modePaiementOptions(sel) {
    return `<option value="">— mode —</option>` + (PNG.modesPaiement || []).map((m) => `<option value="${m.code}" ${m.code === sel ? "selected" : ""}>${m.icon} ${m.libelle}</option>`).join("");
  }
  // Bloc paiement : à payer -> saisie mode+date ; payé -> vérification banque
  function paiementBlock(x) {
    const reglePar = x.regleParSocieteId ? (U.companyById(x.regleParSocieteId) || {}) : null;
    const st = x.statutPaiement || "a_payer";
    const statutOpt = [
      ["a_payer", "🟠 À payer"],
      ["paye_attente", "🔵 À vérifier"],
      ["paye_verifie", "🟢 Payée"],
    ].map(([v, lbl]) => `<option value="${v}" ${v === st ? "selected" : ""}>${lbl}</option>`).join("");
    const besoinMode = (st === "paye_attente" || st === "paye_verifie");
    // INCOHÉRENCE : un règlement est rapproché en banque alors que la facture est "À payer"
    const incoherenceRappro = (x.rapproche && st === "a_payer");
    return `
      <div class="space-y-2">
        ${incoherenceRappro ? `<div class="bg-red-50 border-2 border-red-300 rounded-lg px-3 py-2 text-sm text-red-700 font-medium">🔴 <strong>Incohérence :</strong> un règlement est <strong>rapproché en banque</strong> alors que le statut est « À payer ». Vérifiez : cette facture est probablement déjà <strong>Payée</strong>.</div>` : ""}
        <div>
          <label class="block text-[11px] text-slate-400">Statut du paiement ${x.rapproche ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full ${incoherenceRappro ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}">↔ rapproché en banque</span>` : ""}</label>
          <select id="selStatutPaie" data-id="${x.id}" class="w-full border ${incoherenceRappro ? "border-red-400" : "border-slate-200"} rounded-lg px-3 py-2 text-sm">${statutOpt}</select>
        </div>
        <div id="paieDetails" class="grid grid-cols-2 gap-2 ${besoinMode ? "" : "opacity-50"}">
          <div><label class="block text-[11px] text-slate-400">Mode</label>
            <select id="selMode" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">${modePaiementOptions(x.modePaiement)}</select></div>
          <div><label class="block text-[11px] text-slate-400">Date paiement</label>
            <input id="selDatePaie" type="date" value="${e(x.datePaiement || U.todayISO())}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <button data-saisirstatut="${x.id}" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">€ Enregistrer le statut de paiement</button>
        ${st === "paye_attente" ? `<button data-verifbanque="${x.id}" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium">🏦 Vérifier en banque &amp; rapprocher</button>
          <p class="text-[10px] text-slate-400">Si le règlement n'est pas sur la banque de cette société, recherche dans les autres sociétés du groupe.</p>` : ""}
        ${st === "paye_verifie" ? `<div class="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-800">✓ Payé et rapproché. ${reglePar ? "↔ Réglé par <strong>" + e(reglePar.raisonSociale) + "</strong>. " : ""}Décaissement : ${U.fmtDate(x.dateDecaissement || x.datePaiement)}</div>` : ""}
        <p class="text-[10px] text-slate-400">Échéance : ${U.fmtDate(x.echeance)}</p>
      </div>`;
  }

  /* ============================ DASHBOARD ========================== */
  function dashboard() {
    const today = U.todayISO();
    const f = S.flux(today);
    const tva = S.tva();
    const tx = S.tresorerieTotale();
    const taux = S.tauxRapprochement();
    const aValider = S.facturesAValider();
    const ca = S.caParSociete();
    const caTotal = Object.values(ca).reduce((a, b) => a + b, 0);
    const nonRappro = S.get().transactions.filter((t) => !t.rapproche).length;

    const tresoRows = PNG.companies.filter((c) => S.SOLDES_INIT[c.id] || S.tresorerie(c.id))
      .sort((a, b) => S.tresorerie(b.id) - S.tresorerie(a.id))
      .map((c) => {
        const t = S.tresorerie(c.id);
        const enc = S.get().transactions.filter((x) => x.societeId === c.id && x.montant > 0).reduce((s, x) => s + x.montant, 0);
        const dec = S.get().transactions.filter((x) => x.societeId === c.id && x.montant < 0).reduce((s, x) => s + Math.abs(x.montant), 0);
        return `<tr class="border-t border-slate-100">
          <td class="py-2.5">${societeChip(c.id)}</td>
          <td class="py-2.5 text-right text-emerald-600">${U.fmtEUR(enc)}</td>
          <td class="py-2.5 text-right text-red-500">-${U.fmtEUR(dec)}</td>
          <td class="py-2.5 text-right font-semibold ${t < 0 ? "text-red-600" : "text-slate-800"}">${U.fmtEUR(t)}</td>
        </tr>`;
      }).join("");

    return `
      ${scopeBanner()}
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Tableau de bord</h1>
        <p class="text-slate-500 text-sm">KPI quotidiens — ${S.getScope() ? (U.companyById(S.getScope())||{}).raisonSociale : "Groupe Paris Nord"} · ${U.fmtDate(today)}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${kpiCard("Trésorerie groupe", U.fmtEUR(tx), `${PNG.companies.filter(c=>S.SOLDES_INIT[c.id]).length} sociétés`, "#2563eb", "€")}
        ${kpiCard("Encaissements du jour", U.fmtEUR(f.enc), U.fmtDate(today), "#059669", "↑")}
        ${kpiCard("Décaissements du jour", U.fmtEUR(f.dec), U.fmtDate(today), "#dc2626", "↓")}
        ${kpiCard("Rapprochement bancaire", U.fmtPct(taux), `${nonRappro} écriture(s) à traiter`, "#7c3aed", "⇄")}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${kpiCard("Factures à traiter", aValider, `${S.doublonsCount()} doublon(s) détecté(s)`, "#ea580c", "▦")}
        ${kpiCard("À payer (fournisseurs)", U.fmtEUR(S.totalAPayer()), `${S.aPayer().length} facture(s) non réglée(s)`, "#dc2626", "€")}
        ${kpiCard("TVA collectée", U.fmtEUR(tva.collectee), "Mois en cours", "#16a34a", "T")}
        ${kpiCard("TVA déductible", U.fmtEUR(tva.deductible), `À ${tva.aDecaisser>=0?'décaisser':'récupérer'} : ${U.fmtEUR(Math.abs(tva.aDecaisser))}`, "#db2777", "T")}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${kpiCard("Chiffre d'affaires", U.fmtEUR(caTotal), "Dossiers facturés", "#0ea5e9", "▲")}
        ${kpiCard("Reçues par email", S.get().factures.filter(S.inScope).filter(x=>x.source==="email").length, "factures collectées par email", "#7c3aed", "✉")}
        ${kpiCard("Sociétés actives", PNG.companies.filter(c=>S.SOLDES_INIT[c.id]).length, `sur ${PNG.companies.length} entités`, "#0891b2", "🏢")}
        ${kpiCard("Factures comptabilisées", S.get().factures.filter(x=>x.statut==="comptabilise").length, "ce mois", "#16a34a", "✓")}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 lg:col-span-2">
          <h3 class="font-semibold text-slate-700 mb-4">Encaissements vs décaissements — 7 jours</h3>
          <canvas id="chartFlux" height="110"></canvas>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 class="font-semibold text-slate-700 mb-4">Répartition des financeurs</h3>
          <canvas id="chartFinanceurs" height="200"></canvas>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 lg:col-span-2">
          <h3 class="font-semibold text-slate-700 mb-3">Trésorerie & flux par société</h3>
          <table class="w-full text-sm">
            <thead><tr class="text-xs text-slate-400 text-left">
              <th class="font-medium pb-1">Société</th>
              <th class="font-medium pb-1 text-right">Encaissé</th>
              <th class="font-medium pb-1 text-right">Décaissé</th>
              <th class="font-medium pb-1 text-right">Solde</th>
            </tr></thead>
            <tbody>${tresoRows}</tbody>
          </table>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 class="font-semibold text-slate-700 mb-4">CA par société</h3>
          <canvas id="chartCA" height="220"></canvas>
        </div>
      </div>`;
  }

  function dashboardCharts() {
    if (!window.Chart) return;
    PNG._charts = PNG._charts || {};
    Object.values(PNG._charts).forEach((c) => c && c.destroy());
    PNG._charts = {};

    const serie = S.serieFlux();
    PNG._charts.flux = new Chart(document.getElementById("chartFlux"), {
      type: "bar",
      data: {
        labels: serie.map((s) => s.label),
        datasets: [
          { label: "Encaissements", data: serie.map((s) => s.enc), backgroundColor: "#10b981", borderRadius: 6 },
          { label: "Décaissements", data: serie.map((s) => s.dec), backgroundColor: "#ef4444", borderRadius: 6 },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } },
    });

    const rf = S.repartitionFinanceurs();
    const fcodes = PNG.financeurs.filter((f) => rf[f.code] > 0);
    PNG._charts.fin = new Chart(document.getElementById("chartFinanceurs"), {
      type: "doughnut",
      data: { labels: fcodes.map((f) => f.code), datasets: [{ data: fcodes.map((f) => rf[f.code]), backgroundColor: fcodes.map((f) => f.couleur) }] },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } },
    });

    const ca = S.caParSociete();
    const cs = PNG.companies.filter((c) => ca[c.id] > 0);
    PNG._charts.ca = new Chart(document.getElementById("chartCA"), {
      type: "bar",
      data: { labels: cs.map((c) => c.code + " " + (c.raisonSociale.split(" ")[1] || "")), datasets: [{ data: cs.map((c) => ca[c.id]), backgroundColor: cs.map((c) => c.couleur), borderRadius: 6 }] },
      options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false } } },
    });
  }

  /* ============================ FACTURES =========================== */
  // Dossiers métier : "à saisir" (pré-saisies à compléter/valider) vs "validé"
  const DOSSIER_A_SAISIR = ["ocr", "a_valider"];
  const DOSSIER_VALIDE = ["brouillon", "comptabilise"];
  const srcLabel = { email: "Email", upload: "Saisie directe", scan: "App mobile", online: "Récupéré en ligne" };
  const srcIcon = { email: "✉️", upload: "⬆︎", scan: "📱", online: "🌐" };

  function factures(filter) {
    const f = filter || "a_saisir";
    const all = S.get().factures.filter(S.inScope);
    // filtre principal : dossier (a_saisir / valide / tous) OU origine (src:email…)
    let list;
    if (f === "tous") list = all;
    else if (f === "valide") list = all.filter((x) => DOSSIER_VALIDE.includes(x.statut));
    else if (f.startsWith("src:")) { const s = f.slice(4); list = all.filter((x) => (x.source || "upload") === s); }
    else list = all.filter((x) => DOSSIER_A_SAISIR.includes(x.statut)); // a_saisir par défaut

    const cnt = {
      a_saisir: all.filter((x) => DOSSIER_A_SAISIR.includes(x.statut)).length,
      valide: all.filter((x) => DOSSIER_VALIDE.includes(x.statut)).length,
      tous: all.length,
    };
    const srcCnt = (s) => all.filter((x) => (x.source || "upload") === s).length;
    const tab = (key, label, n) => `<button data-filter="${key}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${f === key ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}">${label} <span class="opacity-70">${n}</span></button>`;

    const rows = list.map((x) => {
      const st = U.STATUT_FACTURE[x.statut];
      const lowConf = x.societeConfiance < 0.75;
      return `<tr class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" data-open="${x.id}">
        <td class="py-3 pl-2"><div class="flex items-center gap-2"><span class="text-slate-400">${srcIcon[x.source]||"📄"}</span><div><p class="text-sm font-medium text-slate-700">${e(x.fournisseur)} ${x.doublonDe ? `<span class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full align-middle">DOUBLON</span>` : ""}</p><p class="text-xs text-slate-400">${e(x.fichier)}</p></div></div></td>
        <td class="py-3">${societeChip(x.societeId)} ${lowConf ? `<span class="ml-1 text-xs text-red-500" title="Confiance faible">⚠︎</span>` : ""}</td>
        <td class="py-3 text-xs"><span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">${srcIcon[x.source]||"📄"} ${e(srcLabel[x.source]||"Saisie directe")}</span></td>
        <td class="py-3 text-xs text-slate-500">${x.sourceEmail ? e(x.sourceEmail) : `<span class="text-slate-300">—</span>`}</td>
        <td class="py-3 text-sm text-slate-600">${e(x.numeroFacture)}</td>
        <td class="py-3 text-sm text-slate-500">${U.fmtDate(x.dateFacture)}</td>
        <td class="py-3 text-right text-sm font-medium text-slate-700">${U.fmtEUR(x.montantTTC)}</td>
        <td class="py-3 text-center">${confBadge(x.ocrConfiance)}</td>
        <td class="py-3 text-center">${badge(st.label, st.cls)} ${x.paye ? `<span class="ml-1 text-emerald-500" title="Payée">€✓</span>` : ""}</td>
      </tr>`;
    }).join("");

    return `
      ${scopeBanner()}
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div><h1 class="text-2xl font-bold text-slate-800">Factures à valider</h1>
        <p class="text-slate-500 text-sm">Toutes les factures remontent ici automatiquement : email, app mobile, saisie directe, récupération en ligne.</p></div>
        <div class="flex gap-2">
          <button id="btnSimEmail" class="bg-violet-600 hover:bg-violet-700 text-white px-3 py-2.5 rounded-xl text-sm font-medium shadow-sm" title="Simuler une facture reçue par email">✉️ Email</button>
          <button id="btnDeposeMobile" class="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2.5 rounded-xl text-sm font-medium shadow-sm">📱 App mobile</button>
          <button id="btnScan" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-xl text-sm font-medium shadow-sm" title="Charger un PDF / une image depuis l'ordinateur">⬆︎ Charger une facture (PDF/photo)</button>
        </div>
      </div>

      <!-- Les deux DOSSIERS principaux -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <button data-filter="a_saisir" class="text-left rounded-2xl p-4 border-2 transition ${(f==='a_saisir')?'border-amber-400 bg-amber-50':'border-slate-100 bg-white hover:border-amber-200'}">
          <p class="text-xs text-slate-400 uppercase tracking-wide">Dossier 1</p>
          <p class="font-bold text-slate-800">📥 À saisir <span class="text-amber-600">(${cnt.a_saisir})</span></p>
          <p class="text-xs text-slate-500 mt-0.5">Pré-saisies automatiquement par l'OCR (fournisseur, montant, TVA déjà remplis) — à vérifier puis valider.</p>
        </button>
        <button data-filter="valide" class="text-left rounded-2xl p-4 border-2 transition ${(f==='valide')?'border-emerald-400 bg-emerald-50':'border-slate-100 bg-white hover:border-emerald-200'}">
          <p class="text-xs text-slate-400 uppercase tracking-wide">Dossier 2</p>
          <p class="font-bold text-slate-800">✅ Validé <span class="text-emerald-600">(${cnt.valide})</span></p>
          <p class="text-xs text-slate-500 mt-0.5">Factures saisies/comptabilisées, prêtes pour le rapprochement bancaire.</p>
        </button>
      </div>

      <!-- Filtre par mode de transmission -->
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <span class="text-xs text-slate-400 mr-1">Mode de transmission :</span>
        ${tab("tous","Tous", cnt.tous)}
        ${tab("src:email","✉️ Email", srcCnt("email"))}
        ${tab("src:scan","📱 App mobile", srcCnt("scan"))}
        ${tab("src:upload","⬆︎ Saisie directe", srcCnt("upload"))}
        ${tab("src:online","🌐 En ligne", srcCnt("online"))}
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table class="w-full min-w-[860px]">
          <thead><tr class="text-xs text-slate-400 text-left bg-slate-50">
            <th class="font-medium py-2.5 pl-2">Fournisseur / fichier</th><th class="font-medium py-2.5">Société reconnue</th>
            <th class="font-medium py-2.5">Transmission</th><th class="font-medium py-2.5">Adresse mail</th>
            <th class="font-medium py-2.5">N° facture</th><th class="font-medium py-2.5">Date</th>
            <th class="font-medium py-2.5 text-right">TTC</th><th class="font-medium py-2.5 text-center">OCR</th><th class="font-medium py-2.5 text-center">Statut</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="9" class="text-center py-8 text-slate-400">Aucune facture dans ce dossier</td></tr>`}</tbody>
        </table>
      </div>`;
  }

  /* ===================== COLLECTE PAR EMAIL ======================== */
  function collecte() {
    const inbox = S.get().inbox || [];
    const rows = inbox.map((m) => {
      const traite = m.statut === "traite";
      return `<div class="bg-white rounded-xl border ${traite ? "border-emerald-100" : "border-violet-200"} p-4 flex items-start justify-between gap-3">
        <div class="flex items-start gap-3 min-w-0">
          <span class="w-9 h-9 rounded-lg flex items-center justify-center text-white ${traite ? "bg-emerald-500" : "bg-violet-500"}">✉️</span>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-700 truncate">${e(m.objet)}</p>
            <p class="text-xs text-slate-400 truncate">De ${e(m.de)} → ${e(m.a)}</p>
            <p class="text-xs text-slate-400">📎 ${e(m.piece)} · reçu le ${U.fmtDate(m.recu)} · ${societeChip(m.societeId)}</p>
          </div>
        </div>
        <div class="text-right whitespace-nowrap">
          ${traite
            ? `${badge("Pré-saisie ✓","bg-emerald-100 text-emerald-700")}<br><button class="text-xs text-violet-700 hover:underline mt-1" data-open="${m.factureId}">Voir la facture →</button>`
            : `${badge("À traiter","bg-violet-100 text-violet-700")}<br><button class="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg mt-1" data-traitemail="${m.id}">⚙︎ Lancer l'OCR</button>`}
        </div>
      </div>`;
    }).join("");

    const enAttente = S.emailsEnAttente();
    return `
      <div class="flex items-center justify-between mb-6">
        <div><h1 class="text-2xl font-bold text-slate-800">Collecte par email</h1>
        <p class="text-slate-500 text-sm">Boîte de réception des factures transférées · pré-saisie OCR automatique (comme Pennylane / Yooz)</p></div>
        <div class="flex gap-2">
          ${enAttente ? `<button id="btnTraiterMails" class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">⚙︎ Tout traiter (${enAttente})</button>` : ""}
          <button id="btnSimEmail" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">✉️ Simuler une réception</button>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
        <h3 class="font-semibold text-slate-700 mb-3 text-sm">Adresses de collecte par société</h3>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          ${PNG.companies.filter((c) => S.SOLDES_INIT[c.id]).map((c) => `<div class="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2"><span class="w-2 h-2 rounded-full" style="background:${c.couleur}"></span><span class="text-slate-500 truncate">${e(c.raisonSociale)}</span><code class="ml-auto text-violet-700">${e(PNG.emailCapture(c.id))}</code></div>`).join("")}
        </div>
        <p class="text-xs text-amber-600 mt-3">⚠️ Adresses proposées pour la démo : elles ne reçoivent réellement les emails qu'une fois configurées sur votre serveur de messagerie / votre outil (Pennylane, Yooz…).</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${rows || `<div class="col-span-2 text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">Aucun email reçu pour l'instant.<br>Cliquez sur « Simuler une réception » pour voir la pré-saisie automatique.</div>`}</div>`;
  }

  /* Modale détail facture : aperçu OCR + écriture proposée */
  function factureModal(id) {
    const x = S.get().factures.find((f) => f.id === id);
    if (!x) return "";
    const c = U.companyById(x.societeId);
    const optionsSoc = PNG.companies.map((co) => `<option value="${co.id}" ${co.id === x.societeId ? "selected" : ""}>${e(co.raisonSociale)}</option>`).join("");
    // liste complète du plan comptable (charges en premier), + le compte courant s'il est hors liste
    const comptesTries = PNG.planComptable.slice().sort((a, b) => (a.type === "Charge" ? 0 : 1) - (b.type === "Charge" ? 0 : 1) || a.num.localeCompare(b.num));
    let optionsCpt = comptesTries.map((p) => `<option value="${p.num}" ${p.num === x.compteCharge ? "selected" : ""}>${p.num} — ${e(p.libelle)}${p.type !== "Charge" ? " (" + p.type + ")" : ""}</option>`).join("");
    if (x.compteCharge && !PNG.planComptable.some((p) => p.num === x.compteCharge)) {
      optionsCpt = `<option value="${e(x.compteCharge)}" selected>${e(x.compteCharge)} — (compte saisi)</option>` + optionsCpt;
    }
    const st = U.STATUT_FACTURE[x.statut];
    const editable = x.statut !== "comptabilise"; // tout modifiable tant que pas comptabilisé
    const champ = (lbl, val, conf) => `<div class="flex items-center justify-between py-1.5 border-b border-slate-100"><span class="text-xs text-slate-400">${lbl}</span><span class="text-sm font-medium text-slate-700">${val} ${conf != null ? confBadge(conf) : ""}</span></div>`;

    // File de validation = factures "à saisir" (dans le périmètre société courant)
    const file = S.get().factures.filter(S.inScope).filter((f) => f.statut === "ocr" || f.statut === "a_valider");
    const posFile = file.findIndex((f) => f.id === x.id);
    const totalFile = file.length;

    return `
    <div class="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4" id="modalBack">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div class="flex items-center gap-2">
            <button data-navfac="prev" data-id="${x.id}" class="text-slate-400 hover:text-blue-600 text-xl px-1" title="Facture précédente (←)">‹</button>
            <div><h2 class="font-bold text-slate-800">${e(x.fournisseur)} · ${e(x.numeroFacture)}</h2><p class="text-xs text-slate-400">${e(x.fichier)} · ${x.source === "email" ? `reçu par email (${e(x.sourceEmail||"")})` : x.source === "scan" ? "scan" : "dépôt manuel"}${posFile >= 0 && totalFile > 1 ? ` · à saisir ${posFile + 1}/${totalFile}` : ""}</p></div>
            <button data-navfac="next" data-id="${x.id}" class="text-slate-400 hover:text-blue-600 text-xl px-1" title="Facture suivante (→)">›</button>
          </div>
          <div class="flex items-center gap-3">
            <button data-suppfac="${x.id}" class="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1" title="Supprimer la facture et son écriture">🗑 Supprimer</button>
            <button id="closeModal" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
          </div>
        </div>
        ${x.doublonDe ? `<div class="bg-red-50 border-b border-red-100 px-6 py-2.5 text-sm text-red-700">⚠︎ <strong>Doublon potentiel détecté</strong> : une facture du même fournisseur avec le même montant/numéro existe déjà. Vérifiez avant de comptabiliser.</div>` : ""}
        <div class="grid md:grid-cols-2 gap-0">
          <!-- Aperçu document : image réelle si OCR, sinon reconstitution -->
          <div class="p-6 bg-slate-50 border-r border-slate-100">
            ${x.apercu
              ? `${editable ? `<div class="mb-2 flex items-center gap-2 text-xs">
                    <span id="zoneHint" class="px-2 py-1 rounded-lg bg-blue-50 text-blue-700">①&nbsp;Cliquez un champ à droite, ② puis dessinez la zone sur la facture pour l'océriser.</span>
                  </div>` : ""}
                ${(x.apercus && x.apercus.length > 1) ? `<div class="flex items-center justify-between mb-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                    <button data-pageprev="${x.id}" class="text-slate-500 hover:text-blue-600 text-sm font-medium">‹ Page précédente</button>
                    <span class="text-xs text-slate-500">Page <span id="ocrPageNum">1</span> / ${x.apercus.length}</span>
                    <button data-pagenext="${x.id}" class="text-slate-500 hover:text-blue-600 text-sm font-medium">Page suivante ›</button>
                  </div>` : ""}
                <div id="ocrZoneWrap" class="relative inline-block w-full ${editable ? "cursor-crosshair" : ""}" data-id="${x.id}">
                  <img id="ocrZoneImg" src="${x.apercu}" alt="Aperçu de la facture" data-pages='${(x.apercus && x.apercus.length>1) ? "multi" : "single"}' class="w-full rounded-lg border border-slate-200 shadow-sm select-none" draggable="false" />
                </div>`
              : `<div class="bg-white border border-slate-200 rounded-lg p-5 shadow-sm text-sm">
              <div class="flex justify-between items-start mb-4">
                <div><p class="font-bold text-slate-800">${e(x.fournisseur)}</p><p class="text-xs text-slate-400">${e(x.categorie)}</p></div>
                <div class="text-right"><p class="font-semibold">FACTURE</p><p class="text-xs text-slate-500">${e(x.numeroFacture)}</p></div>
              </div>
              <div class="bg-blue-50 border border-blue-100 rounded p-2 mb-3 text-xs">
                <span class="text-blue-700 font-medium">Destinataire détecté :</span><br>${e(c ? c.raisonSociale : "—")}<br>SIRET ${e(c ? c.siret : "—")}<br>${e(c && c.campuses[0] ? c.campuses[0] : "")}
              </div>
              <table class="w-full text-xs"><tbody>
                <tr><td class="text-slate-500 py-1">Date facture</td><td class="text-right">${U.fmtDate(x.dateFacture)}</td></tr>
                <tr><td class="text-slate-500 py-1">Montant HT</td><td class="text-right">${U.fmtEUR(x.montantHT)}</td></tr>
                <tr><td class="text-slate-500 py-1">TVA ${x.tauxTva}%</td><td class="text-right">${U.fmtEUR(x.montantTVA)}</td></tr>
                <tr class="font-bold border-t border-slate-200"><td class="py-1">Total TTC</td><td class="text-right">${U.fmtEUR(x.montantTTC)}</td></tr>
              </tbody></table>
            </div>`}
            <p class="text-xs text-slate-400 mt-3">Moteur : <strong>${e(x.ocrMoteur||"?")}</strong> · Confiance ${confBadge(x.ocrConfiance)}</p>
            ${x.geminiErreur ? `<div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mt-1">⚠︎ <strong>L'IA Gemini a échoué :</strong> ${e(x.geminiErreur)}<br>→ Vérifiez votre clé dans ⚙ Réglages OCR (bouton « Tester l'IA »).</div>` : ""}
            <details class="mt-2 text-xs">
              <summary class="cursor-pointer text-blue-600">🔎 Diagnostic OCR (texte brut extrait)</summary>
              <textarea readonly class="w-full mt-1 h-40 border border-slate-200 rounded-lg p-2 font-mono text-[10px]">${e(x.ocrTexte||"(aucun texte extrait — le PDF est peut-être une image scannée, ou la lecture a échoué)")}</textarea>
            </details>
          </div>
          <!-- Champs extraits + écriture -->
          <div class="p-6">
            <div class="mb-4 flex items-center justify-between">${badge(st.label, st.cls)}${editable ? `<span class="text-xs text-blue-600">✎ Tous les champs sont modifiables</span>` : `<span class="text-xs text-slate-400">Comptabilisée — non modifiable</span>`}</div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2">Données extraites (OCR) ${editable ? "— modifiables" : ""}</h3>
            ${editable ? `
            <div class="space-y-2 mb-2">
              <div><label class="block text-[11px] text-slate-400">Fournisseur</label><input id="edFournisseur" data-ocrfield="text" data-id="${x.id}" value="${e(x.fournisseur)}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label class="block text-[11px] text-slate-400">Société</label><select id="edSoc" data-id="${x.id}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">${optionsSoc}</select></div>
              <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-[11px] text-slate-400">N° facture</label><input id="edNum" data-ocrfield="text" data-id="${x.id}" value="${e(x.numeroFacture)}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label class="block text-[11px] text-slate-400">Catégorie</label><input id="edCat" data-id="${x.id}" value="${e(x.categorie)}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-[11px] text-slate-400">Date facture</label><input id="edDate" data-id="${x.id}" type="date" value="${e(x.dateFacture)}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label class="block text-[11px] text-slate-400">Échéance</label><input id="edEch" data-id="${x.id}" type="date" value="${e(x.echeance)}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div><label class="block text-[11px] text-slate-400">Montant HT</label><input id="edHT" data-ocrfield="amount" data-id="${x.id}" inputmode="decimal" value="${x.montantHT}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label class="block text-[11px] text-slate-400">Taux TVA %</label><input id="edTaux" data-id="${x.id}" inputmode="decimal" value="${x.tauxTva}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label class="block text-[11px] text-slate-400">TVA €</label><input id="edTVA" data-ocrfield="amount" data-id="${x.id}" inputmode="decimal" value="${x.montantTVA}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label class="block text-[11px] text-slate-400">Montant TTC</label><input id="edTTC" data-ocrfield="amount" data-id="${x.id}" inputmode="decimal" value="${x.montantTTC}" class="w-full border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-sm font-semibold" /></div>
              ${(x.alerteMontants && x.alerteMontants.length) ? `<div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">⚠︎ <strong>Écart détecté sur les montants :</strong><ul class="list-disc ml-4 mt-1">${x.alerteMontants.map((a)=>`<li>${e(a)}</li>`).join("")}</ul><p class="mt-1 text-red-500">Vérifiez HT / TVA / TTC avant de valider.</p></div>` : `<div class="text-[10px] text-emerald-600">✓ Montants cohérents (HT + TVA = TTC)</div>`}
              <button data-savefac="${x.id}" class="w-full bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium">💾 Enregistrer les modifications</button>
              <p class="text-[10px] text-slate-400">Astuce : si vous changez HT ou le taux, la TVA et le TTC se recalculent. Vous pouvez aussi forcer le TTC directement.</p>
            </div>` : `
            ${champ("Fournisseur", e(x.fournisseur), x.ocrConfiance)}
            ${champ("N° facture", e(x.numeroFacture), null)}
            ${champ("Date", U.fmtDate(x.dateFacture), null)}
            ${champ("Montant HT", U.fmtEUR(x.montantHT), null)}
            ${champ("TVA " + x.tauxTva + "%", U.fmtEUR(x.montantTVA), null)}
            ${champ("Montant TTC", U.fmtEUR(x.montantTTC), null)}`}

            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2 mt-5">Identification fournisseur</h3>
            ${editable ? `
            <div class="space-y-2 mb-2">
              <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-[11px] text-slate-400">SIREN</label><input id="edFSiren" data-id="${x.id}" value="${e(x.fournisseurSiren||"")}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" /></div>
                <div><label class="block text-[11px] text-slate-400">SIRET siège</label><input id="edFSiret" data-id="${x.id}" value="${e(x.fournisseurSiret||"")}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" /></div>
              </div>
              <div><label class="block text-[11px] text-slate-400">Code NAF</label><input id="edFNaf" data-id="${x.id}" value="${e(x.fournisseurNaf||"")}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label class="block text-[11px] text-slate-400">Adresse du siège</label><input id="edFAdr" data-id="${x.id}" value="${e(x.fournisseurAdresse||"")}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              <div class="flex gap-2">
                <button data-savefourn="${x.id}" class="flex-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-medium">💾 Enregistrer l'identité</button>
                <button data-verifdg="${x.id}" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-medium">🇫🇷 Vérifier via data.gouv</button>
              </div>
              <p class="text-[10px] text-slate-400">La vérification data.gouv complète SIREN/SIRET/adresse et corrige la raison sociale (orthographe officielle) à partir du SIRET/SIREN.</p>
            </div>` : `
            <div class="bg-slate-50 rounded-lg p-3 text-sm mb-2">
              ${x.fournisseurSiren ? `<div class="flex justify-between"><span class="text-slate-400 text-xs">SIREN</span><span class="font-mono">${e(x.fournisseurSiren)}</span></div>` : ""}
              ${x.fournisseurSiret ? `<div class="flex justify-between"><span class="text-slate-400 text-xs">SIRET siège</span><span class="font-mono">${e(x.fournisseurSiret)}</span></div>` : ""}
              ${x.fournisseurAdresse ? `<div class="mt-1"><span class="text-slate-400 text-xs">Adresse du siège</span><p class="text-xs text-slate-600">${e(x.fournisseurAdresse)}</p></div>` : ""}
            </div>`}
            ${(() => {
              const existe = S.fournisseurExiste(x);
              if (existe) return `<div class="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700 mb-2">✓ Ce fournisseur existe déjà dans votre base.</div>`;
              return `<div class="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2 flex items-center justify-between gap-2">
                <span class="text-xs text-amber-700">Fournisseur inconnu de votre base.</span>
                <button data-addfourn="${x.id}" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap">＋ Ajouter le fournisseur</button>
              </div>`;
            })()}
            <a href="${e(x.driveUrl||"#")}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-2">📁 Voir dans le Drive <span class="text-slate-300">(archivage auto)</span></a>

            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2 mt-3">Catégorie & compte comptable ${x.compteParIA ? `<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">🧠 proposé par l'IA</span>` : ""}</h3>
            ${editable ? `<label class="block text-[11px] text-slate-400">Catégorie (modifiable)</label>
            <input id="edCat2" data-id="${x.id}" value="${e(x.categorie||"")}" placeholder="ex: Télécom, Loyer, Publicité…" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2" />` : ""}
            <label class="block text-[11px] text-slate-400">Compte du plan comptable (choisir dans la liste)</label>
            <select id="selCpt" data-id="${x.id}" ${editable ? "" : "disabled"} class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2">${optionsCpt}</select>
            ${editable ? `<label class="block text-[11px] text-slate-400">…ou saisir un autre n° de compte à la main</label>
            <input id="edCompteManuel" data-id="${x.id}" placeholder="ex: 606300" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4" />` : `<div class="mb-4"></div>`}

            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2">Écriture comptable (brouillon)</h3>
            <table class="w-full text-sm mb-4">
              <thead><tr class="text-xs text-slate-400 text-left"><th class="font-medium">Compte</th><th class="font-medium text-right">Débit</th><th class="font-medium text-right">Crédit</th></tr></thead>
              <tbody>
                <tr class="border-t border-slate-100"><td class="py-1.5">${x.compteCharge} ${e((U.planByNum(x.compteCharge)||{}).libelle||"")}</td><td class="text-right">${U.fmtEUR(x.montantHT)}</td><td class="text-right">—</td></tr>
                <tr class="border-t border-slate-100"><td class="py-1.5">445660 TVA déductible</td><td class="text-right">${U.fmtEUR(x.montantTVA)}</td><td class="text-right">—</td></tr>
                <tr class="border-t border-slate-100"><td class="py-1.5">401000 Fournisseurs</td><td class="text-right">—</td><td class="text-right">${U.fmtEUR(x.montantTTC)}</td></tr>
              </tbody>
            </table>
            <div class="flex gap-2">
              ${x.statut !== "comptabilise" ? `<button data-valider="${x.id}" class="flex-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-4 py-2.5 rounded-xl text-sm font-medium">Valider en brouillon</button>` : ""}
              ${x.statut !== "comptabilise" ? `<button data-compta="${x.id}" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">Comptabiliser</button>` : `<span class="flex-1 text-center text-emerald-600 text-sm py-2.5">✓ Comptabilisé ${x.rapproche ? "· rapproché" : ""}</span>`}
            </div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2 mt-5">Paiement</h3>
            ${paiementBlock(x)}
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ======================= BANQUE / RAPPROCHEMENT ================== */
  function banque() {
    const txs = S.get().transactions.filter(S.inScope).slice().sort((a, b) => b.date.localeCompare(a.date));
    const taux = S.tauxRapprochement();
    const nonRappro = txs.filter((t) => !t.rapproche);

    const card = (t) => {
      const c = U.companyById(t.societeId);
      const credit = t.montant >= 0;
      const sug = t.rapproche ? [] : S.suggestionsPour(t);
      return `<div class="bg-white rounded-xl border ${t.rapproche ? "border-emerald-100" : "border-slate-200"} p-4">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <span class="w-9 h-9 rounded-lg flex items-center justify-center text-white ${credit ? "bg-emerald-500" : "bg-red-400"}">${credit ? "↓" : "↑"}</span>
            <div>
              <p class="text-sm font-medium text-slate-700">${e(t.libelle)}</p>
              <p class="text-xs text-slate-400">${U.fmtDate(t.date)} · ${societeChip(t.societeId)} · ${e(t.categorie)}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-semibold ${credit ? "text-emerald-600" : "text-red-500"}">${credit ? "+" : ""}${U.fmtEUR(t.montant)}</p>
            ${t.rapproche ? badge("Rapproché", "bg-emerald-100 text-emerald-700") : badge("À rapprocher", "bg-amber-100 text-amber-700")}
          </div>
        </div>
        ${t.rapproche ? `<div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>↔ Rattaché à ${e(lienLabel(t))}</span>
            <button data-unrappro="${t.id}" class="text-slate-400 hover:text-red-500">Annuler</button></div>`
          : sug.length ? `<div class="mt-3 pt-3 border-t border-slate-100">
              <p class="text-xs text-slate-400 mb-2">Suggestion${sug.length>1?"s":""} de rapprochement :</p>
              ${sug.map((s) => `<button data-rappro="${t.id}" data-ctype="${s.type}" data-cid="${s.id}" class="w-full flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 mb-1.5 text-sm">
                <span class="text-emerald-800">${s.type === "facture" ? "📄" : "🎓"} ${e(s.label)}</span>
                <span class="flex items-center gap-2"><span class="text-slate-500">${U.fmtEUR(s.montant)}</span>${confBadge(s.score)}<span class="text-emerald-700 font-medium">Rapprocher →</span></span></button>`).join("")}
              <button data-rapprochoix="${t.id}" class="w-full text-xs text-slate-500 hover:text-blue-600 mt-1">⇄ Choisir une autre contrepartie…</button>
            </div>`
          : `<div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-xs text-slate-400">Aucune contrepartie automatique trouvée.</span>
              <button data-rapprochoix="${t.id}" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">⇄ Rapprocher manuellement</button>
            </div>`}
      </div>`;
    };

    return `
      ${scopeBanner()}
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 class="text-2xl font-bold text-slate-800">Banque & rapprochement</h1>
        <p class="text-slate-500 text-sm">Les écritures bancaires remontent automatiquement chaque jour. Rapprochez-les avec les factures (décaissements) et les dossiers (encaissements).</p></div>
        <div class="flex gap-2">
          <button id="btnSyncBanque" class="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm">🔄 Synchroniser la banque (jour)</button>
          <button id="btnAutoRappro" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm">⇄ Rapprochement automatique</button>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${kpiCard("Taux de rapprochement", U.fmtPct(taux), `${txs.filter(t=>t.rapproche).length}/${txs.length} écritures`, "#7c3aed", "⇄")}
        ${kpiCard("À rapprocher", nonRappro.length, "écritures en attente", "#ea580c", "!")}
        ${kpiCard("Solde net période", U.fmtEUR(txs.reduce((s,t)=>s+t.montant,0)), "tous comptes", "#2563eb", "€")}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${txs.map(card).join("")}</div>`;
  }
  function lienLabel(t) {
    if (t.lienType === "facture") { const f = S.get().factures.find((x) => x.id === t.lienId); return f ? f.fournisseur + " " + f.numeroFacture : "facture"; }
    if (t.lienType === "dossier") { const d = S.get().dossiers.find((x) => x.id === t.lienId); return d ? d.stagiaire + " " + d.numeroDossier : "dossier"; }
    return "—";
  }

  /* ============================== TVA ============================= */
  function tvaView() {
    const rows = PNG.companies.map((c) => ({ c, v: S.tva(c.id) })).filter((x) => x.v.collectee || x.v.deductible).map(({ c, v }) => {
      return `<tr class="border-t border-slate-100">
        <td class="py-3">${societeChip(c.id)}</td>
        <td class="py-3 text-right text-emerald-600">${U.fmtEUR(v.collectee)}</td>
        <td class="py-3 text-right text-blue-600">${U.fmtEUR(v.deductible)}</td>
        <td class="py-3 text-right font-semibold ${v.aDecaisser >= 0 ? "text-slate-800" : "text-emerald-600"}">${U.fmtEUR(v.aDecaisser)}</td>
        <td class="py-3 text-center">${v.aDecaisser >= 0 ? badge("À décaisser", "bg-amber-100 text-amber-700") : badge("Crédit TVA", "bg-emerald-100 text-emerald-700")}</td>
      </tr>`;
    }).join("");
    const tot = S.tva();
    return `
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">TVA</h1>
      <p class="text-slate-500 text-sm">TVA collectée / déductible · déclaration CA3 par société · mois en cours</p></div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${kpiCard("TVA collectée", U.fmtEUR(tot.collectee), "Ventes taxables", "#16a34a", "T")}
        ${kpiCard("TVA déductible", U.fmtEUR(tot.deductible), "Achats", "#2563eb", "T")}
        ${kpiCard(tot.aDecaisser >= 0 ? "TVA à décaisser" : "Crédit de TVA", U.fmtEUR(Math.abs(tot.aDecaisser)), "Solde net groupe", "#db2777", "Σ")}
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        ℹ︎ Les actions de <strong>formation professionnelle continue</strong> conventionnées (CPF, OPCO, France Travail) sont <strong>exonérées de TVA</strong> (art. 261-4-4° a du CGI). La TVA collectée provient des prestations taxables (financement entreprise / activités annexes).
      </div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead><tr class="text-xs text-slate-400 text-left bg-slate-50">
            <th class="font-medium py-2.5 pl-4">Société</th><th class="font-medium py-2.5 text-right">TVA collectée (445710)</th>
            <th class="font-medium py-2.5 text-right">TVA déductible (445660)</th><th class="font-medium py-2.5 text-right pr-2">Solde (445510)</th><th class="font-medium py-2.5 text-center">Position</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr class="border-t-2 border-slate-200 font-semibold bg-slate-50">
            <td class="py-3 pl-4">TOTAL GROUPE</td><td class="py-3 text-right text-emerald-600">${U.fmtEUR(tot.collectee)}</td>
            <td class="py-3 text-right text-blue-600">${U.fmtEUR(tot.deductible)}</td><td class="py-3 text-right">${U.fmtEUR(tot.aDecaisser)}</td><td></td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  /* ====================== FINANCEMENTS (ERP) ====================== */
  function financements(filter) {
    const f = filter || "tous";
    const list = S.get().dossiers.filter(S.inScope).filter((d) => f === "tous" ? true : d.financeurCode === f);
    const tab = (key, label) => `<button data-finfilter="${key}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${f === key ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}">${label}</button>`;
    const rows = list.map((d) => {
      const fin = U.financeurByCode(d.financeurCode);
      const st = U.STATUT_DOSSIER[d.statut];
      const numero = d.numeroCPF || d.numeroOPCO || d.numeroPOEI || "—";
      return `<tr class="border-t border-slate-100 hover:bg-slate-50">
        <td class="py-3 pl-4"><p class="text-sm font-medium text-slate-700">${e(d.stagiaire)}</p><p class="text-xs text-slate-400">${e(d.numeroDossier)}</p></td>
        <td class="py-3 text-sm">${e(d.formation)}</td>
        <td class="py-3">${societeChip(d.societeId)}<p class="text-xs text-slate-400 ml-4">${e(d.campus)}</p></td>
        <td class="py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" style="background:${fin.couleur}20;color:${fin.couleur}">${fin.code}</span></td>
        <td class="py-3 text-xs font-mono text-slate-500">${e(numero)}</td>
        <td class="py-3 text-right text-sm font-medium">${U.fmtEUR(d.montant)}</td>
        <td class="py-3 text-center">${badge(st.label, st.cls)}</td>
      </tr>`;
    }).join("");
    const rf = S.repartitionFinanceurs();
    return `
      ${scopeBanner()}
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">Financements & ERP</h1>
      <p class="text-slate-500 text-sm">Dossiers de financement · numéros OPCO / CPF / France Travail (POEI) · facturation</p></div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        ${PNG.financeurs.map((fc) => `<div class="bg-white rounded-xl p-3 border border-slate-100 text-center"><p class="text-xs text-slate-400">${fc.code}</p><p class="text-lg font-bold" style="color:${fc.couleur}">${U.fmtEUR(rf[fc.code]||0)}</p></div>`).join("")}
      </div>
      <div class="flex flex-wrap gap-2 mb-4">${tab("tous","Tous")}${PNG.financeurs.map((fc)=>tab(fc.code,fc.code)).join("")}</div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table class="w-full">
          <thead><tr class="text-xs text-slate-400 text-left bg-slate-50">
            <th class="font-medium py-2.5 pl-4">Stagiaire / dossier</th><th class="font-medium py-2.5">Formation</th><th class="font-medium py-2.5">Société / campus</th>
            <th class="font-medium py-2.5">Financeur</th><th class="font-medium py-2.5">N° OPCO/CPF/POEI</th><th class="font-medium py-2.5 text-right">Montant</th><th class="font-medium py-2.5 text-center">Statut</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /* ============================ SOCIÉTÉS ========================== */
  function societes() {
    const cards = PNG.companies.map((c) => `
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div class="flex items-center gap-3 mb-3">
          <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs" style="background:${c.couleur}">${e(c.num || c.code.slice(0,2))}</span>
          <div class="min-w-0"><p class="font-bold text-slate-800 truncate">${e(c.raisonSociale)}</p><p class="text-xs text-slate-400 truncate">${e(c.marque)} · ${e(c.formeJuridique)}</p></div>
        </div>
        <dl class="text-xs space-y-1">
          ${c.siren ? `<div class="flex justify-between"><dt class="text-slate-400">SIREN</dt><dd class="font-mono">${e(c.siren)}</dd></div>` : ""}
          ${c.siret ? `<div class="flex justify-between"><dt class="text-slate-400">SIRET siège</dt><dd class="font-mono">${e(c.siret)}</dd></div>` : ""}
          ${c.nda ? `<div class="flex justify-between"><dt class="text-slate-400">NDA</dt><dd class="font-mono">${e(c.nda)}</dd></div>` : ""}
          ${c.representant && c.representant !== "—" ? `<div class="flex justify-between"><dt class="text-slate-400">Représentant</dt><dd class="text-right">${e(c.representant)}</dd></div>` : ""}
          ${c.opco ? `<div class="flex justify-between"><dt class="text-slate-400">OPCO</dt><dd>${e(c.opco)}</dd></div>` : ""}
          <div class="flex justify-between"><dt class="text-slate-400">Assujetti TVA</dt><dd>${c.tvaAssujetti === true ? badge("Oui","bg-emerald-100 text-emerald-700") : c.tvaAssujetti === false ? badge("Non","bg-slate-100 text-slate-500") : badge("À confirmer","bg-amber-100 text-amber-700")}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-400">Trésorerie</dt><dd class="font-semibold ${S.tresorerie(c.id)<0?'text-red-600':'text-slate-700'}">${U.fmtEUR(S.tresorerie(c.id))}</dd></div>
        </dl>
        ${c.campuses.length ? `<div class="mt-3 pt-3 border-t border-slate-100"><p class="text-xs text-slate-400 mb-1">Établissements (${c.campuses.length})</p>${c.campuses.map((cp)=>`<p class="text-xs text-slate-600">📍 ${e(cp)}</p>`).join("")}</div>` : `<p class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-300 italic">Informations à compléter</p>`}
        ${c.cursus && c.cursus.length ? `<div class="mt-2 flex flex-wrap gap-1">${c.cursus.map((cu)=>`<span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">${e(cu)}</span>`).join("")}</div>` : ""}
      </div>`).join("");
    return `
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">Sociétés du groupe</h1>
      <p class="text-slate-500 text-sm">${PNG.companies.length} entités · utilisées pour la reconnaissance OCR et l'affectation comptable</p></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>`;
  }

  /* ========================= PLAN COMPTABLE ======================= */
  function plan() {
    const rows = PNG.planComptable.map((p) => `<tr class="border-t border-slate-100">
      <td class="py-2.5 pl-4 font-mono text-sm">${e(p.num)}</td><td class="py-2.5 text-sm">${e(p.libelle)}</td>
      <td class="py-2.5 text-center">${badge(p.type, p.type==="Charge"?"bg-red-50 text-red-600":p.type==="Produit"?"bg-emerald-50 text-emerald-600":"bg-slate-100 text-slate-500")}</td></tr>`).join("");
    return `
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">Plan comptable</h1>
      <p class="text-slate-500 text-sm">Plan Comptable Général (PCG) — comptes utilisés pour l'affectation automatique</p></div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table class="w-full"><thead><tr class="text-xs text-slate-400 text-left bg-slate-50">
          <th class="font-medium py-2.5 pl-4">N° compte</th><th class="font-medium py-2.5">Libellé</th><th class="font-medium py-2.5 text-center">Type</th></tr></thead>
          <tbody>${rows}</tbody></table>
      </div>`;
  }

  /* ===================== FONCTIONNALITÉS (Pennylane / Yooz) ======== */
  function fonctionnalites() {
    const stPill = {
      fait:      badge("Fait", "bg-emerald-100 text-emerald-700"),
      partiel:   badge("Partiel", "bg-amber-100 text-amber-700"),
      abrancher: badge("À brancher", "bg-slate-100 text-slate-500"),
    };
    const check = (v) => v ? `<span class="text-emerald-500">✓</span>` : `<span class="text-slate-300">—</span>`;
    const blocs = PNG.featureMatrix.map((g) => `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
        <div class="px-5 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700 text-sm">${e(g.cat)}</div>
        <table class="w-full text-sm">
          <thead><tr class="text-xs text-slate-400 text-left">
            <th class="font-medium py-2 pl-5">Fonctionnalité</th>
            <th class="font-medium py-2 text-center w-24">Pennylane</th>
            <th class="font-medium py-2 text-center w-20">Yooz</th>
            <th class="font-medium py-2 text-center w-32">Compta PNG</th>
          </tr></thead>
          <tbody>
            ${g.items.map((it) => `<tr class="border-t border-slate-100">
              <td class="py-2.5 pl-5 text-slate-700">${e(it.f)}</td>
              <td class="py-2.5 text-center">${check(it.penny)}</td>
              <td class="py-2.5 text-center">${check(it.yooz)}</td>
              <td class="py-2.5 text-center">${stPill[it.statut]}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`).join("");

    return `
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">Fonctionnalités — couverture Pennylane / Yooz</h1>
      <p class="text-slate-500 text-sm">Comparatif factuel des fonctions des deux outils et leur état dans Compta PNG.</p></div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm"><strong class="text-emerald-700">Fait</strong> — implémenté dans le prototype (données simulées).</div>
        <div class="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm"><strong class="text-amber-700">Partiel</strong> — base présente, à approfondir.</div>
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"><strong class="text-slate-600">À brancher</strong> — architecture prête, intégration réelle à venir.</div>
      </div>
      ${blocs}
      <p class="text-xs text-slate-400 mt-2">Sources : documentation publique Pennylane et Yooz. Comparatif indicatif (les offres évoluent). Aucune donnée bancaire ou fiscale réelle n'est utilisée dans ce prototype.</p>`;
  }

  /* ===================== REGISTRE DES FACTURES (grand tableau) ===== */
  function registre() {
    const list = S.get().factures.filter(S.inScope).slice().sort((a, b) => (b.dateFacture || "").localeCompare(a.dateFacture || ""));
    const d = (v) => v ? U.fmtDate(v) : `<span class="text-slate-300">—</span>`;
    const rows = list.map((x) => {
      const sp = U.STATUT_PAIEMENT[x.statutPaiement] || U.STATUT_PAIEMENT.a_payer;
      const mp = U.modePaiementByCode(x.modePaiement);
      const cpt = (U.planByNum(x.compteCharge) || {});
      const reglePar = x.regleParSocieteId ? (U.companyById(x.regleParSocieteId) || {}) : null;
      return `<tr class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" data-open="${x.id}">
        <td class="py-2.5 pl-3"><div class="flex items-center gap-1.5"><span>${srcIcon[x.source]||"📄"}</span><span class="text-sm font-medium text-slate-700">${e(x.fournisseur)}</span>${x.doublonDe?`<span class="text-[9px] bg-red-100 text-red-700 px-1 rounded">DBL</span>`:""}</div>
          <span class="text-[10px] text-slate-400 ml-5">${societeChip(x.societeId)}${x.sourceEmail?` · ${e(x.sourceEmail)}`:""}</span></td>
        <td class="py-2.5 text-xs text-slate-500">${e(x.numeroFacture)}</td>
        <td class="py-2.5 text-xs">${d(x.dateFacture)}</td>
        <td class="py-2.5 text-xs">${d(x.dateImport)}</td>
        <td class="py-2.5 text-xs">${d(x.dateReglement)}</td>
        <td class="py-2.5 text-xs">${d(x.dateDecaissement)}${reglePar?`<br><span class="text-[9px] bg-violet-100 text-violet-700 px-1 rounded" title="Réglé par une autre société du groupe">↔ ${e(reglePar.code||"")}</span>`:""}</td>
        <td class="py-2.5 text-center text-xs">${mp?mp.icon+" "+mp.libelle.slice(0,4):"—"}</td>
        <td class="py-2.5 text-right text-sm">${U.fmtEUR(x.montantHT)}</td>
        <td class="py-2.5 text-right text-xs text-slate-500">${U.fmtEUR(x.montantTVA)}<br>${x.tauxTva}%</td>
        <td class="py-2.5 text-right text-sm font-medium">${U.fmtEUR(x.montantTTC)}</td>
        <td class="py-2.5 text-center"><span class="font-mono text-xs">${e(x.compteCharge)}</span></td>
        <td class="py-2.5 text-center text-xs">${(x.rapproche && x.statutPaiement === "a_payer") ? badge("🔴 À payer / rapproché", "bg-red-100 text-red-700") : badge(sp.label, sp.cls)}${(x.rapproche && x.statutPaiement !== "a_payer") ? ` <span class="text-[9px] text-emerald-600" title="Rapproché en banque">↔</span>` : ""}</td>
        <td class="py-2.5 text-center">${x.driveUrl?`<a href="${e(x.driveUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-blue-600" title="Drive">📁</a>`:""}</td>
        <td class="py-2.5 text-center"><button data-suppfac="${x.id}" onclick="event.stopPropagation()" class="text-red-400 hover:text-red-600" title="Supprimer">🗑</button></td>
      </tr>`;
    }).join("");
    const tHT = list.reduce((s,x)=>s+x.montantHT,0), tTVA=list.reduce((s,x)=>s+x.montantTVA,0), tTTC=list.reduce((s,x)=>s+x.montantTTC,0);
    const scope = S.getScope();
    return `
      ${scopeBanner()}
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div><h1 class="text-2xl font-bold text-slate-800">Registre des factures</h1>
        <p class="text-slate-500 text-sm">Dates facture · import · règlement · décaissement (banque) · mode · HT · TVA · TTC · compte</p></div>
        <div class="flex gap-2">
          <button id="btnVerifPaie" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">🏦 Vérifier paiements (${S.paiementsAVerifier()})</button>
          <button id="btnDeposeMobile" class="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium">📱 Dépôt mobile</button>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table class="w-full min-w-[1100px]">
          <thead><tr class="text-[11px] text-slate-400 text-left bg-slate-50">
            <th class="font-medium py-2 pl-3">Fournisseur / société</th><th class="font-medium py-2">N°</th>
            <th class="font-medium py-2">Date fact.</th><th class="font-medium py-2">Import</th><th class="font-medium py-2">Règlement</th><th class="font-medium py-2">Décaiss.</th>
            <th class="font-medium py-2 text-center">Mode</th>
            <th class="font-medium py-2 text-right">HT</th><th class="font-medium py-2 text-right">TVA</th><th class="font-medium py-2 text-right">TTC</th>
            <th class="font-medium py-2 text-center">Compte</th><th class="font-medium py-2 text-center">Statut</th><th class="font-medium py-2 text-center">Drive</th><th class="font-medium py-2 text-center"></th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="14" class="text-center py-8 text-slate-400">Aucune facture</td></tr>`}</tbody>
          <tfoot><tr class="border-t-2 border-slate-200 bg-slate-50 font-semibold text-sm">
            <td class="py-2.5 pl-3" colspan="7">TOTAL (${list.length} factures)</td>
            <td class="py-2.5 text-right">${U.fmtEUR(tHT)}</td><td class="py-2.5 text-right">${U.fmtEUR(tTVA)}</td><td class="py-2.5 text-right">${U.fmtEUR(tTTC)}</td><td colspan="4"></td>
          </tr></tfoot>
        </table>
      </div>
      <p class="text-xs text-slate-400 mt-2">↔ = réglé par une autre société du groupe. La date de décaissement vient du rapprochement bancaire (peut différer de la date de règlement saisie).</p>`;
  }

  /* ===================== FACTURES À RÉGLER ======================== */
  function aReglerView() {
    const list = S.aRegler().filter(S.inScope).slice().sort((a, b) => (a.echeance || "").localeCompare(b.echeance || ""));
    const total = list.reduce((s, x) => s + x.montantTTC, 0);
    const today = U.todayISO();
    const rows = list.map((x) => {
      const retard = x.echeance && x.echeance < today;
      const mp = U.modePaiementByCode(x.modePaiement);
      return `<tr class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" data-open="${x.id}">
        <td class="py-3 pl-3"><p class="text-sm font-medium text-slate-700">${e(x.fournisseur)}</p><p class="text-xs text-slate-400">${e(x.numeroFacture)}</p></td>
        <td class="py-3">${societeChip(x.societeId)}</td>
        <td class="py-3 text-sm ${retard?'text-red-600 font-semibold':'text-slate-500'}">${U.fmtDate(x.echeance)} ${retard?'<span class="text-[10px] bg-red-100 text-red-700 px-1.5 rounded-full">en retard</span>':''}</td>
        <td class="py-3 text-right text-sm font-medium">${U.fmtEUR(x.montantTTC)}</td>
        <td class="py-3 text-center">${badge(U.STATUT_PAIEMENT.a_payer.label, U.STATUT_PAIEMENT.a_payer.cls)}</td>
        <td class="py-3 text-center"><button data-open="${x.id}" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">€ Régler</button></td>
      </tr>`;
    }).join("");
    return `
      ${scopeBanner()}
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">Factures à régler</h1>
      <p class="text-slate-500 text-sm">Uniquement les factures validées marquées « à régler » (non payées sur l'app). Les factures déjà payées sont dans le registre, statut « payé · à vérifier » ou « payé · rapproché ».</p></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        ${kpiCard("Total à régler", U.fmtEUR(total), `${list.length} facture(s)`, "#dc2626", "€")}
        ${kpiCard("En retard", list.filter(x=>x.echeance && x.echeance < today).length, "échéance dépassée", "#ea580c", "!")}
      </div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table class="w-full min-w-[680px]">
          <thead><tr class="text-xs text-slate-400 text-left bg-slate-50">
            <th class="font-medium py-2.5 pl-3">Fournisseur / n°</th><th class="font-medium py-2.5">Société</th>
            <th class="font-medium py-2.5">Échéance</th><th class="font-medium py-2.5 text-right">TTC</th>
            <th class="font-medium py-2.5 text-center">Statut</th><th class="font-medium py-2.5 text-center">Action</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="text-center py-10 text-slate-400">Aucune facture à régler 🎉</td></tr>`}</tbody>
        </table>
      </div>`;
  }

  /* ===================== DOSSIERS FOURNISSEURS ===================== */
  function fournisseurs() {
    const dossiers = S.fournisseurDossiers().filter(S.inScope);
    const cards = dossiers.map((fo) => `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div class="flex items-start justify-between mb-2">
          <div class="min-w-0"><p class="font-bold text-slate-800 truncate">${e(fo.nom)}</p>
          <p class="text-xs text-slate-400">${societeChip(fo.societeId)} · ${e(fo.categorie)}</p></div>
          <span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">${fo.nbFactures} fact.</span>
        </div>
        <dl class="text-xs space-y-1 mb-3">
          <div class="flex justify-between"><dt class="text-slate-400">Compte tiers</dt><dd class="font-mono">${e(fo.compteTiers)}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-400">Compte charge</dt><dd class="font-mono">${e(fo.compteCharge)}</dd></div>
          ${fo.siren?`<div class="flex justify-between"><dt class="text-slate-400">SIREN</dt><dd class="font-mono">${e(fo.siren)}</dd></div>`:`<div class="flex justify-between"><dt class="text-slate-400">SIREN</dt><dd class="text-amber-500">non identifié</dd></div>`}
          ${fo.naf?`<div class="flex justify-between"><dt class="text-slate-400">NAF</dt><dd>${e(fo.naf)}</dd></div>`:""}
        </dl>
        <div class="flex justify-between items-center pt-2 border-t border-slate-100">
          <div><p class="text-[10px] text-slate-400">Total facturé</p><p class="font-semibold text-slate-700">${U.fmtEUR(fo.total)}</p></div>
          <div class="text-right"><p class="text-[10px] text-slate-400">Reste dû</p><p class="font-semibold ${fo.du>0?'text-red-600':'text-emerald-600'}">${U.fmtEUR(fo.du)}</p></div>
        </div>
      </div>`).join("");
    return `
      ${scopeBanner()}
      <div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">Dossiers fournisseurs</h1>
      <p class="text-slate-500 text-sm">Fiches créées automatiquement à chaque nouvelle facture · compte tiers 401 · identification data.gouv</p></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards || `<p class="text-slate-400">Aucun fournisseur.</p>`}</div>`;
  }

  /* Modale de dépôt mobile (simulation du téléphone salarié) */
  function mobileModal() {
    const optionsSoc = PNG.companies.filter((c) => S.SOLDES_INIT[c.id]).map((co) => `<option value="${co.id}">${e(co.raisonSociale)}</option>`).join("");
    return `
    <div class="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4" id="modalBack">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 class="font-bold text-slate-800">📱 Dépôt mobile — salarié</h2>
          <button id="closeModal" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div class="p-5 space-y-3">
          <p class="text-xs text-slate-500">Le salarié photographie la facture, choisit la <strong>société</strong> (boîte) et indique si elle est payée.</p>
          <div class="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400 text-sm">📷 Prendre / importer la photo<br><span class="text-xs">(simulée pour la démo)</span></div>
          <label class="block text-xs text-slate-500">Société destinataire</label>
          <select id="mobSoc" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">${optionsSoc}</select>
          <label class="block text-xs text-slate-500">Votre nom</label>
          <input id="mobSalarie" type="text" placeholder="Ex. Aïcha (Saint-Denis)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <div class="flex gap-2">
            <label class="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer"><input type="radio" name="mobPaie" value="apayer" checked> À payer</label>
            <label class="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer"><input type="radio" name="mobPaie" value="paye"> Déjà payé</label>
          </div>
          <div id="mobPaieDetails" class="hidden grid grid-cols-2 gap-2">
            <select id="mobMode" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">${modePaiementOptions("")}</select>
            <input id="mobDate" type="date" value="${U.todayISO()}" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button id="mobEnvoyer" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">Envoyer la facture</button>
          <p class="text-[10px] text-slate-400 text-center">La pré-saisie OCR + l'archivage Drive se font automatiquement à l'envoi.</p>
        </div>
      </div>
    </div>`;
  }

  /* Modale de rapprochement manuel : choisir la contrepartie d'une écriture */
  function rapproManuelModal(txId) {
    const t = S.get().transactions.find((x) => x.id === txId);
    if (!t) return "";
    const credit = t.montant >= 0;
    // candidats : factures non rapprochées (débit) ou dossiers (crédit), même société d'abord
    let cands;
    if (credit) {
      cands = S.get().dossiers.filter((d) => d.statut !== "encaisse").map((d) => ({ type: "dossier", id: d.id, label: `${d.stagiaire} · ${d.numeroDossier}`, montant: d.montant, soc: d.societeId }));
    } else {
      cands = S.get().factures.filter((f) => !f.rapproche).map((f) => ({ type: "facture", id: f.id, label: `${f.fournisseur} · ${f.numeroFacture}`, montant: f.montantTTC, soc: f.societeId }));
    }
    cands.sort((a, b) => (a.soc === t.societeId ? -1 : 1) - (b.soc === t.societeId ? -1 : 1) || Math.abs(a.montant - Math.abs(t.montant)) - Math.abs(b.montant - Math.abs(t.montant)));
    const rows = cands.map((c) => {
      const ecart = Math.abs(c.montant - Math.abs(t.montant));
      const proche = ecart < 1;
      return `<button data-rappro="${t.id}" data-ctype="${c.type}" data-cid="${c.id}" class="w-full flex items-center justify-between border ${proche?'border-emerald-200 bg-emerald-50':'border-slate-200'} hover:bg-slate-50 rounded-lg px-3 py-2 mb-1.5 text-sm text-left">
        <span><span class="${c.soc===t.societeId?'':'opacity-50'}">${c.type==='facture'?'📄':'🎓'} ${e(c.label)}</span> ${c.soc!==t.societeId?`<span class="text-[10px] text-amber-600">(autre société)</span>`:""}</span>
        <span class="flex items-center gap-2"><span class="text-slate-500">${U.fmtEUR(c.montant)}</span>${proche?badge("montant ✓","bg-emerald-100 text-emerald-700"):`<span class="text-xs text-slate-400">écart ${U.fmtEUR(ecart)}</span>`}</span>
      </button>`;
    }).join("");
    return `
    <div class="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4" id="modalBack">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-y-auto">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div><h2 class="font-bold text-slate-800">Rapprocher manuellement</h2>
          <p class="text-xs text-slate-400">${e(t.libelle)} · ${U.fmtDate(t.date)} · <span class="${credit?'text-emerald-600':'text-red-500'}">${credit?'+':''}${U.fmtEUR(t.montant)}</span></p></div>
          <button id="closeModal" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div class="p-5">
          <p class="text-xs text-slate-500 mb-3">Choisissez la ${credit?'recette (dossier de financement)':'facture'} correspondant à cette écriture :</p>
          ${rows || `<p class="text-slate-400 text-sm text-center py-6">Aucune contrepartie disponible.</p>`}
        </div>
      </div>
    </div>`;
  }

  /* Modale : enregistrer un NOUVEAU fournisseur via data.gouv.
   * Affiche un champ de recherche (pré-rempli avec le nom OCR / SIRET) et la
   * liste des entreprises trouvées ; un clic crée la fiche fournisseur. */
  function nouveauFournModal(factureId) {
    const x = S.get().factures.find((f) => f.id === factureId);
    if (!x) return "";
    const q = x.fournisseurSiret || x.fournisseurSiren || x.fournisseur || "";
    return `
    <div class="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4" id="modalBack">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-y-auto">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div><h2 class="font-bold text-slate-800">＋ Nouveau fournisseur</h2>
          <p class="text-xs text-slate-400">Recherche officielle sur data.gouv (raison sociale, SIREN, SIRET, adresse du siège)</p></div>
          <button id="closeModal" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        <div class="p-5">
          <div class="flex gap-2 mb-3">
            <input id="fournSearch" data-id="${x.id}" value="${e(q)}" placeholder="Nom, SIREN ou SIRET…" class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <button id="btnFournSearch" data-id="${x.id}" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Rechercher</button>
          </div>
          <p class="text-xs text-slate-400 mb-2">💡 Astuce : si le SIREN/SIRET est sur la facture, la raison sociale sera <strong>exacte</strong>.</p>
          <div id="fournResults" class="space-y-2"><p class="text-sm text-slate-400 text-center py-6">Lancez une recherche pour voir les résultats data.gouv.</p></div>
        </div>
      </div>
    </div>`;
  }

  // Rendu d'une liste de résultats data.gouv (appelé par app.js après fetch)
  function renderFournResults(factureId, results) {
    if (!results || !results.length) return `<p class="text-sm text-slate-400 text-center py-6">Aucune entreprise trouvée. Affinez la recherche.</p>`;
    return results.map((r) => `<button data-pickent="${factureId}" data-ent='${e(JSON.stringify(r))}' class="w-full text-left border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg px-3 py-2">
      <p class="text-sm font-medium text-slate-700">${e(r.nom || "—")}</p>
      <p class="text-xs text-slate-400">SIREN ${e(r.siren || "—")}${r.siret ? " · SIRET " + e(r.siret) : ""}${r.naf ? " · NAF " + e(r.naf) : ""}</p>
      ${r.adresse ? `<p class="text-xs text-slate-500">${e(r.adresse)}</p>` : ""}
    </button>`).join("");
  }

  /* ===================== RÉGLAGES OCR ============================= */
  function ocrSettings() {
    var cfg = (PNG.ocr && PNG.ocr.getConfig) ? PNG.ocr.getConfig() : { engine: "ocrspace", ocrspaceKey: "", mindeeKey: "" };
    var opt = function (val, label, desc) {
      var sel = cfg.engine === val;
      return '<label class="flex items-start gap-3 border-2 ' + (sel ? "border-blue-400 bg-blue-50" : "border-slate-200") + ' rounded-xl p-3 cursor-pointer mb-2">' +
        '<input type="radio" name="ocrEngine" value="' + val + '" ' + (sel ? "checked" : "") + ' class="mt-1">' +
        '<span><span class="font-medium text-slate-800">' + label + '</span><br><span class="text-xs text-slate-500">' + desc + '</span></span></label>';
    };
    return '' +
      '<div class="mb-6"><h1 class="text-2xl font-bold text-slate-800">Réglages OCR <span class="text-xs font-normal text-emerald-600">' + (PNG.VERSION || "") + '</span></h1>' +
      '<p class="text-slate-500 text-sm">Choisissez le moteur de reconnaissance des factures. Vos clés restent sur votre navigateur.</p></div>' +
      '<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 max-w-2xl">' +
        '<div class="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 mb-5">' +
          '<p class="font-bold text-emerald-800 mb-1">🧠 IA Google Gemini — GRATUIT (recommandé)</p>' +
          '<p class="text-xs text-emerald-700 mb-2">La vraie solution : une IA range automatiquement le texte dans les bonnes cases (fournisseur, destinataire, n°, HT/TVA/TTC), même sur des factures très différentes. Gratuit ~1500 factures/jour, sans carte bancaire.</p>' +
          '<label class="flex items-center gap-2 text-sm cursor-pointer font-medium text-emerald-800 mb-2">' +
            '<input type="checkbox" id="ocrUseGemini" ' + (cfg.useGemini ? "checked" : "") + '> Activer l\'IA Gemini' +
          '</label>' +
          '<label class="block text-[11px] text-emerald-700 mb-1">Clé API Gemini (gratuite sur aistudio.google.com/apikey)</label>' +
          '<input id="ocrKeyGemini" value="' + e(cfg.geminiKey || "") + '" placeholder="colle ta clé Gemini ici" class="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm" />' +
          '<div class="flex gap-2 mt-3">' +
            '<button id="btnSaveOcr" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">💾 Enregistrer</button>' +
            '<button id="btnTestGemini" class="flex-1 bg-white border border-emerald-300 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-medium">🧪 Tester l\'IA</button>' +
          '</div>' +
          '<div id="geminiTestResult" class="text-xs mt-2"></div>' +
          (cfg.geminiKey ? '<p class="text-xs text-emerald-700 mt-2">✓ Clé enregistrée. L\'IA est ' + (cfg.useGemini ? "active" : "désactivée") + '. Cliquez « Tester l\'IA » pour vérifier.</p>' : '') +
        '</div>' +
        '<h3 class="text-xs font-semibold text-slate-400 uppercase mb-3">Moteur OCR (lecture du texte)</h3>' +
        opt("ocrspace", "OCR.space — gratuit, immédiat ✅", "Fonctionne tout de suite (clé démo). Pour plus de fiabilité, collez votre clé gratuite ci-dessous (25 000 pages/mois sur ocr.space).") +
        opt("mindee", "Mindee — qualité maximale factures ⭐", "Extraction structurée (fournisseur, SIRET, n°, HT/TVA/TTC) et distingue fournisseur/client. Gratuit jusqu'à 250 factures/mois. Nécessite une clé API.") +
        opt("tesseract", "Local (Tesseract) — hors-ligne", "Aucune connexion requise, mais qualité plus faible. À utiliser en dépannage.") +
        '<h3 class="text-xs font-semibold text-slate-400 uppercase mb-2 mt-5">Clés OCR (lecture du texte)</h3>' +
        '<label class="block text-[11px] text-slate-400 mb-1">Clé OCR.space (laisser vide = clé démo)</label>' +
        '<input id="ocrKeySpace" value="' + e(cfg.ocrspaceKey || "") + '" placeholder="ex: K81234567888957" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" />' +
        '<label class="block text-[11px] text-slate-400 mb-1">Clé API Mindee (optionnel)</label>' +
        '<input id="ocrKeyMindee" value="' + e(cfg.mindeeKey || "") + '" placeholder="votre clé Mindee" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4" />' +
        '<div class="flex gap-2">' +
          '<button id="btnSaveOcr2" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">💾 Enregistrer les clés OCR</button>' +
        '</div>' +
        '<div class="mt-4 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">' +
          '<p class="font-medium text-slate-600 mb-1">Comment obtenir une clé gratuite ?</p>' +
          '<p>• <strong>Gemini (recommandé)</strong> : aistudio.google.com/apikey → connexion Google → « Create API key ». Gratuit, sans CB.</p>' +
          '<p>• <strong>OCR.space</strong> : ocr.space/ocrapi → « Register for free API key ».</p>' +
        '</div>' +
      '</div>';
  }

  return { dashboard, dashboardCharts, factures, factureModal, collecte, banque, tvaView, financements, societes, plan, fonctionnalites, registre, aReglerView, fournisseurs, mobileModal, rapproManuelModal, nouveauFournModal, renderFournResults, ocrSettings };
})();
