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
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Tableau de bord</h1>
        <p class="text-slate-500 text-sm">KPI quotidiens — Groupe Paris Nord · ${U.fmtDate(today)}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${kpiCard("Trésorerie groupe", U.fmtEUR(tx), `${PNG.companies.filter(c=>S.SOLDES_INIT[c.id]).length} sociétés`, "#2563eb", "€")}
        ${kpiCard("Encaissements du jour", U.fmtEUR(f.enc), U.fmtDate(today), "#059669", "↑")}
        ${kpiCard("Décaissements du jour", U.fmtEUR(f.dec), U.fmtDate(today), "#dc2626", "↓")}
        ${kpiCard("Rapprochement bancaire", U.fmtPct(taux), `${nonRappro} écriture(s) à traiter`, "#7c3aed", "⇄")}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${kpiCard("Factures à traiter", aValider, `${S.emailsEnAttente()} email(s) · ${S.doublonsCount()} doublon(s)`, "#ea580c", "▦")}
        ${kpiCard("À payer (fournisseurs)", U.fmtEUR(S.totalAPayer()), `${S.aPayer().length} facture(s) non réglée(s)`, "#dc2626", "€")}
        ${kpiCard("TVA collectée", U.fmtEUR(tva.collectee), "Mois en cours", "#16a34a", "T")}
        ${kpiCard("TVA déductible", U.fmtEUR(tva.deductible), `À ${tva.aDecaisser>=0?'décaisser':'récupérer'} : ${U.fmtEUR(Math.abs(tva.aDecaisser))}`, "#db2777", "T")}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${kpiCard("Chiffre d'affaires", U.fmtEUR(caTotal), "Dossiers facturés", "#0ea5e9", "▲")}
        ${kpiCard("Collecte email", S.emailsEnAttente(), "facture(s) en attente d'OCR", "#7c3aed", "✉")}
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
  function factures(filter) {
    const f = filter || "tous";
    const list = S.get().factures.filter((x) => f === "tous" ? true : x.statut === f);
    const counts = {
      tous: S.get().factures.length,
      ocr: S.get().factures.filter((x) => x.statut === "ocr").length,
      a_valider: S.get().factures.filter((x) => x.statut === "a_valider").length,
      brouillon: S.get().factures.filter((x) => x.statut === "brouillon").length,
      comptabilise: S.get().factures.filter((x) => x.statut === "comptabilise").length,
    };
    const tab = (key, label) => `<button data-filter="${key}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${f === key ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}">${label} <span class="opacity-70">${counts[key]}</span></button>`;

    const srcIcon = { email: "✉️", upload: "⬆︎", scan: "📷" };
    const rows = list.map((x) => {
      const st = U.STATUT_FACTURE[x.statut];
      const lowConf = x.societeConfiance < 0.75;
      return `<tr class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" data-open="${x.id}">
        <td class="py-3 pl-2"><div class="flex items-center gap-2"><span class="text-slate-400" title="${e(x.source||'upload')}">${srcIcon[x.source]||"📄"}</span><div><p class="text-sm font-medium text-slate-700">${e(x.fournisseur)} ${x.doublonDe ? `<span class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full align-middle">DOUBLON</span>` : ""}</p><p class="text-xs text-slate-400">${e(x.fichier)}</p></div></div></td>
        <td class="py-3">${societeChip(x.societeId)} ${lowConf ? `<span class="ml-1 text-xs text-red-500" title="Confiance faible">⚠︎</span>` : ""}</td>
        <td class="py-3 text-sm text-slate-600">${e(x.numeroFacture)}</td>
        <td class="py-3 text-sm text-slate-500">${U.fmtDate(x.dateFacture)}</td>
        <td class="py-3 text-right text-sm font-medium text-slate-700">${U.fmtEUR(x.montantTTC)}</td>
        <td class="py-3 text-center">${confBadge(x.ocrConfiance)}</td>
        <td class="py-3 text-center">${badge(st.label, st.cls)} ${x.paye ? `<span class="ml-1 text-emerald-500" title="Payée">€✓</span>` : ""}</td>
      </tr>`;
    }).join("");

    const enAttente = S.emailsEnAttente();

    return `
      <div class="flex items-center justify-between mb-6">
        <div><h1 class="text-2xl font-bold text-slate-800">Factures fournisseurs</h1>
        <p class="text-slate-500 text-sm">Collecte (email / upload) · OCR · reconnaissance société · pré-saisie · affectation au plan comptable</p></div>
        <div class="flex gap-2">
          <button id="btnSimEmail" class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm flex items-center gap-2">✉️ Simuler une facture reçue par email</button>
          <button id="btnScan" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm flex items-center gap-2">⬆︎ Déposer une facture</button>
        </div>
      </div>

      <!-- Bandeau collecte par email (cœur Pennylane / Yooz) -->
      <div class="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-2xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
        <div class="text-sm">
          <p class="font-semibold text-slate-700">📨 Collecte automatique par email</p>
          <p class="text-slate-500">Transférez vos factures à <code class="bg-white px-1.5 py-0.5 rounded border border-violet-200 text-violet-700">factures+<i>société</i>@parisnordgroupe.fr</code> → la <strong>pré-saisie OCR</strong> se fait automatiquement à la réception. <span class="text-amber-600">(Adresses à activer sur votre messagerie.)</span></p>
        </div>
        ${enAttente ? `<button id="btnTraiterMails" class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap">⚙︎ Traiter ${enAttente} email(s) en attente</button>` : `<a href="#collecte" class="text-violet-700 text-sm font-medium whitespace-nowrap hover:underline">Voir la boîte de collecte →</a>`}
      </div>

      <div class="flex flex-wrap gap-2 mb-4">${tab("tous","Toutes")}${tab("ocr","OCR en cours")}${tab("a_valider","À valider")}${tab("brouillon","Brouillon")}${tab("comptabilise","Comptabilisé")}</div>
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table class="w-full">
          <thead><tr class="text-xs text-slate-400 text-left bg-slate-50">
            <th class="font-medium py-2.5 pl-2">Fournisseur / fichier</th><th class="font-medium py-2.5">Société reconnue</th>
            <th class="font-medium py-2.5">N° facture</th><th class="font-medium py-2.5">Date</th>
            <th class="font-medium py-2.5 text-right">TTC</th><th class="font-medium py-2.5 text-center">OCR</th><th class="font-medium py-2.5 text-center">Statut</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="7" class="text-center py-8 text-slate-400">Aucune facture</td></tr>`}</tbody>
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
    const optionsCpt = PNG.planComptable.filter((p) => p.type === "Charge").map((p) => `<option value="${p.num}" ${p.num === x.compteCharge ? "selected" : ""}>${p.num} — ${e(p.libelle)}</option>`).join("");
    const st = U.STATUT_FACTURE[x.statut];
    const champ = (lbl, val, conf) => `<div class="flex items-center justify-between py-1.5 border-b border-slate-100"><span class="text-xs text-slate-400">${lbl}</span><span class="text-sm font-medium text-slate-700">${val} ${conf != null ? confBadge(conf) : ""}</span></div>`;

    return `
    <div class="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4" id="modalBack">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div><h2 class="font-bold text-slate-800">${e(x.fournisseur)} · ${e(x.numeroFacture)}</h2><p class="text-xs text-slate-400">${e(x.fichier)} · ${x.source === "email" ? `reçu par email (${e(x.sourceEmail||"")})` : x.source === "scan" ? "scan" : "dépôt manuel"}</p></div>
          <button id="closeModal" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>
        ${x.doublonDe ? `<div class="bg-red-50 border-b border-red-100 px-6 py-2.5 text-sm text-red-700">⚠︎ <strong>Doublon potentiel détecté</strong> : une facture du même fournisseur avec le même montant/numéro existe déjà. Vérifiez avant de comptabiliser.</div>` : ""}
        <div class="grid md:grid-cols-2 gap-0">
          <!-- Aperçu document simulé -->
          <div class="p-6 bg-slate-50 border-r border-slate-100">
            <div class="bg-white border border-slate-200 rounded-lg p-5 shadow-sm text-sm">
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
            </div>
            <p class="text-xs text-slate-400 mt-3">Confiance OCR globale : ${confBadge(x.ocrConfiance)}${(x.ocrIndices && x.ocrIndices.length) ? ` · Indices : ${e(x.ocrIndices.join(", "))}` : ""}</p>
          </div>
          <!-- Champs extraits + écriture -->
          <div class="p-6">
            <div class="mb-4">${badge(st.label, st.cls)}</div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2">Données extraites (OCR)</h3>
            ${champ("Fournisseur", e(x.fournisseur), x.ocrConfiance)}
            ${champ("N° facture", e(x.numeroFacture), x.ocrConfiance)}
            ${champ("Date", U.fmtDate(x.dateFacture), x.ocrConfiance)}
            ${champ("Échéance", U.fmtDate(x.echeance), null)}
            ${champ("Montant TTC", U.fmtEUR(x.montantTTC), x.ocrConfiance)}

            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2 mt-5">Affectation</h3>
            <label class="block text-xs text-slate-500 mb-1">Société ${x.societeConfiance < 0.75 ? `<span class="text-red-500">— à confirmer (${Math.round(x.societeConfiance*100)}%)</span>` : ""}</label>
            <select id="selSoc" data-id="${x.id}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">${optionsSoc}</select>
            <label class="block text-xs text-slate-500 mb-1">Compte de charge</label>
            <select id="selCpt" data-id="${x.id}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4">${optionsCpt}</select>

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
            <button data-paye="${x.id}" data-val="${x.paye ? "0" : "1"}" class="w-full mt-2 ${x.paye ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"} border px-4 py-2 rounded-xl text-sm font-medium">${x.paye ? "€ ✓ Payée — annuler le paiement" : "€ Marquer comme payée"}</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ======================= BANQUE / RAPPROCHEMENT ================== */
  function banque() {
    const txs = S.get().transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
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
            </div>`
          : `<div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">Aucune contrepartie automatique trouvée — à classer manuellement.</div>`}
      </div>`;
    };

    return `
      <div class="flex items-center justify-between mb-6">
        <div><h1 class="text-2xl font-bold text-slate-800">Banque & rapprochement</h1>
        <p class="text-slate-500 text-sm">Écritures bancaires quotidiennes · encaissements / décaissements · lettrage automatique</p></div>
        <button id="btnAutoRappro" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm">⇄ Rapprochement automatique</button>
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
    const list = S.get().dossiers.filter((d) => f === "tous" ? true : d.financeurCode === f);
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

  return { dashboard, dashboardCharts, factures, factureModal, collecte, banque, tvaView, financements, societes, plan, fonctionnalites };
})();
