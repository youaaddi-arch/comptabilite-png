/* =====================================================================
 * Compta PNG — OCR réel (Tesseract.js + PDF.js)
 * Charge un vrai PDF ou une image, en extrait le texte, puis devine
 * fournisseur / n° / dates / montants HT-TVA-TTC. Tout se passe dans le
 * navigateur (gratuit, aucune donnée envoyée à un serveur tiers, hormis
 * l'identification SIREN via data.gouv déclenchée ensuite).
 * ===================================================================== */
window.PNG = window.PNG || {};

PNG.ocr = (function () {
  // Configure le worker PDF.js si présent
  function setupPdf() {
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js";
    }
  }

  const dispo = () => !!(window.Tesseract);

  /* Prétraitement image : niveaux de gris + renforcement de contraste.
   * Améliore nettement la lecture Tesseract. Renvoie un dataURL. */
  function preprocess(dataURL) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function () {
        // upscale si l'image est petite (meilleure reconnaissance)
        const target = 1800;
        let scale = 1;
        if (img.naturalWidth < target) scale = Math.min(2.5, target / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const d = ctx.getImageData(0, 0, w, h);
          const a = d.data;
          for (let i = 0; i < a.length; i += 4) {
            // niveaux de gris pondérés
            let g = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
            // contraste (sigmoïde simple autour de 140)
            g = g < 140 ? g * 0.6 : 128 + (g - 140) * 1.6;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            a[i] = a[i + 1] = a[i + 2] = g;
          }
          ctx.putImageData(d, 0, 0);
        } catch (e) { /* canvas tainted : on garde l'image telle quelle */ }
        resolve(cv.toDataURL("image/png"));
      };
      img.onerror = () => resolve(dataURL);
      img.src = dataURL;
    });
  }

  /* Rend la 1re page d'un PDF dans un canvas -> dataURL image (haute résolution) */
  /* Extrait le TEXTE NATIF d'un PDF numérique (couche texte) — exact à 100%,
   * sans OCR. Renvoie "" si le PDF est un scan (pas de couche texte). */
  async function pdfExtractText(file) {
    setupPdf();
    if (!window.pdfjsLib) return "";
    try {
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let out = "";
      const nb = Math.min(pdf.numPages, 8); // jusqu'à 8 pages (factures multi-pages)
      for (let p = 1; p <= nb; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        // items avec position (x), base verticale (y), largeur et hauteur
        const items = tc.items.filter((it) => it.str != null).map((it) => ({
          x: it.transform[4], y: it.transform[5],
          w: it.width || 0, h: Math.abs(it.transform[3]) || 8,
          s: it.str,
        }));
        if (!items.length) continue;
        // tolérance verticale = moitié de la hauteur de police médiane
        const hs = items.map((i) => i.h).sort((a, b) => a - b);
        const hMed = hs[Math.floor(hs.length / 2)] || 8;
        const tol = Math.max(2, hMed * 0.6);
        // regroupe en lignes
        const lignes = [];
        items.sort((a, b) => b.y - a.y || a.x - b.x);
        items.forEach((it) => {
          let l = lignes.find((g) => Math.abs(g.y - it.y) <= tol);
          if (!l) { l = { y: it.y, items: [] }; lignes.push(l); }
          l.items.push(it);
        });
        lignes.sort((a, b) => b.y - a.y);
        lignes.forEach((l) => {
          l.items.sort((a, b) => a.x - b.x);
          let ligne = "";
          let prev = null;
          l.items.forEach((it) => {
            if (prev) {
              const gap = it.x - (prev.x + prev.w);
              const espace = prev.h * 0.25; // seuil d'espace selon taille police
              // gros écart = séparateur (tabulation) ; petit écart = mot collé
              if (gap > prev.h * 2) ligne += "   ";
              else if (gap > espace) ligne += " ";
            }
            ligne += it.s;
            prev = it;
          });
          // recolle les lettres isolées issues d'une police perso ("O S M A N I")
          ligne = ligne.replace(/\b(?:[A-Za-zÀ-ÿ]\s){2,}[A-Za-zÀ-ÿ]\b/g, (m) => m.replace(/\s+/g, ""));
          ligne = ligne.replace(/\s{4,}/g, "   ").replace(/[ \t]{2,}/g, " ").trim();
          if (ligne) out += ligne + "\n";
        });
        out += "\n";
      }
      return out.trim();
    } catch (e) { return ""; }
  }

  // Rend la 1re page (aperçu). onlyFirst=true par défaut.
  async function pdfToImage(file) {
    setupPdf();
    if (!window.pdfjsLib) throw new Error("PDF.js indisponible");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 3 });   // 3x : plus net pour l'OCR
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas.toDataURL("image/png");
  }

  // Rend chaque page en image séparée -> tableau de dataURL (pour l'aperçu navigable).
  async function pdfToImagesArray(file, maxPages) {
    setupPdf();
    if (!window.pdfjsLib) return [];
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const nb = Math.min(pdf.numPages, maxPages || 8);
    const imgs = [];
    for (let p = 1; p <= nb; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 2.2 });
      const cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      imgs.push(cv.toDataURL("image/png"));
    }
    return imgs;
  }

  // Rend TOUTES les pages empilées verticalement -> 1 image (pour OCR multi-pages).
  async function pdfToImagesStacked(file, maxPages) {
    setupPdf();
    if (!window.pdfjsLib) throw new Error("PDF.js indisponible");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const nb = Math.min(pdf.numPages, maxPages || 8);
    const scale = 2.2;
    const pages = [];
    let totalH = 0, maxW = 0;
    for (let p = 1; p <= nb; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale });
      const cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      pages.push(cv); totalH += cv.height; maxW = Math.max(maxW, cv.width);
    }
    if (pages.length === 1) return pages[0].toDataURL("image/png");
    const big = document.createElement("canvas");
    big.width = maxW; big.height = totalH;
    const ctx = big.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, maxW, totalH);
    let y = 0;
    pages.forEach((cv) => { ctx.drawImage(cv, 0, y); y += cv.height; });
    return big.toDataURL("image/png");
  }

  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  /* OCR d'une image (dataURL) -> { texte, mots[] } avec positions (bbox).
   * onProgress(0..1) optionnel. */
  async function imageToData(dataURL, onProgress) {
    if (!window.Tesseract) throw new Error("Tesseract indisponible");
    const res = await window.Tesseract.recognize(dataURL, "fra+eng", {
      logger: (m) => { if (m.status === "recognizing text" && onProgress) onProgress(m.progress); },
    });
    const d = res.data || {};
    const mots = (d.words || []).map((w) => ({
      text: w.text, x: w.bbox ? w.bbox.x0 : 0, y: w.bbox ? w.bbox.y0 : 0,
      x1: w.bbox ? w.bbox.x1 : 0, y1: w.bbox ? w.bbox.y1 : 0,
    }));
    return { texte: d.text || "", mots, largeur: (d.width || 0), hauteur: (d.height || 0) };
  }
  // compat
  async function imageToText(dataURL, onProgress) { return (await imageToData(dataURL, onProgress)).texte; }

  /* ---- Analyse du texte OCR : extraction des champs facture --------- */
  const moisFR = { janvier:"01",février:"02",fevrier:"02",mars:"03",avril:"04",mai:"05",juin:"06",juillet:"07",août:"08",aout:"08",septembre:"09",octobre:"10",novembre:"11",décembre:"12",decembre:"12" };

  function toISO(d, m, y) {
    if (String(y).length === 2) y = "20" + y;
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  function findDates(t) {
    const out = [];
    let m;
    const re1 = /\b(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})\b/g;
    while ((m = re1.exec(t))) out.push(toISO(m[1], m[2], m[3]));
    const re2 = new RegExp("\\b(\\d{1,2})\\s+(" + Object.keys(moisFR).join("|") + ")\\s+(\\d{4})\\b", "gi");
    while ((m = re2.exec(t))) out.push(toISO(m[1], moisFR[m[2].toLowerCase()], m[3]));
    return out;
  }

  // Convertit "1 234,56" / "1.234,56" / "1234.56" -> nombre
  function parseMontant(s) {
    if (!s) return null;
    s = s.replace(/\s/g, "").replace(/€|EUR/gi, "");
    if (s.indexOf(",") > -1 && s.indexOf(".") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.indexOf(",") > -1) s = s.replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  function montantApresMot(t, motsRegex, decimalesObligatoires) {
    // capture un nombre après le mot-clé ; ignore un éventuel "20 %" placé juste après
    const re = new RegExp("(?:" + motsRegex + ")\\s*(?:\\d{1,2}[.,]?\\d?\\s*%)?[^0-9\\-]{0,15}(-?\\d[\\d\\s]*[.,]\\d{2}|-?\\d[\\d\\s]*\\d|\\d)", "i");
    const m = t.match(re);
    if (!m) return null;
    if (decimalesObligatoires && !/[.,]\d{2}/.test(m[1])) return null;
    return parseMontant(m[1]);
  }
  function tousMontants(t) {
    const out = [];
    const re = /(\d[\d\s]*[.,]\d{2})\s*(?:€|EUR)?/gi;
    let m; while ((m = re.exec(t))) { const v = parseMontant(m[1]); if (v != null) out.push(v); }
    return out;
  }

  // Corrige les espaces parasites de l'OCR : "GOOG LE" -> "GOOGLE",
  // "M I C R O S O F T" -> "MICROSOFT" (garde les vrais espaces, ex "Paris Nord").
  function reparerEspaces(s) {
    if (!s) return s;
    s = s.replace(/\b(?:[A-Za-zÀ-ÿ]\s){2,}[A-Za-zÀ-ÿ]\b/g, (m) => m.replace(/\s+/g, ""));
    s = s.replace(/\b([A-Za-zÀ-ÿ]{2,})\s([A-Za-zà-ÿ]{1,2})\b/g, (m, a, b) => (a + b).length <= 12 ? a + b : m);
    return s.replace(/\s{2,}/g, " ").trim();
  }

  // Récupère les SIRET de NOS sociétés (siège + établissements) pour
  // distinguer le destinataire (nous) du fournisseur.
  function nosSirets() {
    const set = new Set();
    (window.PNG && PNG.companies || []).forEach((c) => {
      if (c.siret) set.add(c.siret.replace(/\D/g, ""));
      (c.etablissements || []).forEach((e) => { if (e.siret && e.siret !== "EN COURS") set.add(e.siret.replace(/\D/g, "")); });
      if (c.siren) set.add(c.siren.replace(/\D/g, ""));
    });
    return set;
  }
  function estNotreSociete(ligne) {
    const L = (ligne || "").toUpperCase();
    return (window.PNG && PNG.companies || []).some((c) => {
      if (c.raisonSociale && L.includes(c.raisonSociale.toUpperCase())) return true;
      if (c.marque && c.marque.length > 3 && L.includes(c.marque.toUpperCase())) return true;
      return false;
    });
  }

  // Choisit le fournisseur via la position (haut-droite + pied de page),
  // en EXCLUANT nos sociétés (destinataire). mots = bbox Tesseract.
  function fournisseurParPosition(mots, W, H) {
    if (!mots || !mots.length || !W || !H) return "";
    // regroupe les mots par ligne (même y approx)
    const lignes = [];
    mots.forEach((m) => {
      if (!m.text || !m.text.trim()) return;
      let g = lignes.find((l) => Math.abs(l.y - m.y) < (H * 0.012));
      if (!g) { g = { y: m.y, mots: [] }; lignes.push(g); }
      g.mots.push(m);
    });
    const candidates = [];
    lignes.forEach((l) => {
      l.mots.sort((a, b) => a.x - b.x);
      const txt = l.mots.map((w) => w.text).join(" ").trim();
      if (txt.length < 3 || !/[A-Za-zÀ-ÿ]{2}/.test(txt)) return;
      if (/facture|invoice|devis|^n[°o]|siret|siren|tva|^date|client|adresse|téléphone|tel|email|@/i.test(txt)) return;
      if (estNotreSociete(txt)) return;                       // exclut le destinataire
      const xCenter = l.mots.reduce((s, w) => s + (w.x + w.x1) / 2, 0) / l.mots.length;
      const top = l.y < H * 0.28, bottom = l.y > H * 0.80, right = xCenter > W * 0.55;
      let score = 0;
      if (top && right) score += 5;        // haut-droite : très probable
      else if (top) score += 3;            // haut-gauche : possible
      if (bottom) score += 2;              // pied de page : raison sociale
      if (/\b(SARL|SAS|SASU|SA|EURL|SCI|SNC)\b/i.test(txt)) score += 2;
      if (/[A-Z]{3,}/.test(txt)) score += 1;
      if (score > 0) candidates.push({ txt, score, y: l.y });
    });
    candidates.sort((a, b) => b.score - a.score || a.y - b.y);
    return candidates.length ? reparerEspaces(candidates[0].txt).slice(0, 60) : "";
  }

  // Nettoie un nom de société : coupe avant l'adresse / le SIRET / la virgule
  function nettoyerNomFournisseur(l) {
    var v = reparerEspaces(l || "");
    // retire un libellé en tête ("Émetteur :", "Fournisseur :", "De :"…)
    v = v.replace(/^\s*(?:[ée]metteur|fournisseur|vendeur|raison\s*sociale|soci[ée]t[ée]|de|exp[ée]diteur)\s*[:#-]\s*/i, "");
    v = v.split(/\s+\d{1,4}\s+(?:rue|av|avenue|bld|boulevard|chemin|sentier|impasse|place|route|all[ée]e|quai)\b/i)[0];
    v = v.split(/\b(?:SIRET|SIREN|APE|RCS|TVA|IBAN|BIC|RIB|T[ée]l|www|http|capital)\b/i)[0];
    v = v.split(/,/)[0];
    return v.replace(/\s{2,}/g, " ").replace(/[\s,;:-]+$/, "").trim().slice(0, 60);
  }

  function U_companyName(id) {
    var c = (window.PNG && PNG.companies || []).find(function (x) { return x.id === id; });
    return c ? c.raisonSociale : "";
  }

  function parseFacture(texte, mots, W, H) {
    const t = (texte || "").replace(/ /g, " ");
    const upper = t.toUpperCase();
    let lignes = t.split(/\n/).map((l) => l.replace(/\s{2,}/g, " ").trim()).filter((l) => l.length > 1);

    // mots/noms techniques à ignorer (polices, métadonnées PDF)
    const JUNK = /\b(arial|helvetica|times|calibri|montserrat|identity|adobe|ucs|tahoma|verdana|cid|truetype|type0|fontello|roboto)\b/i;

    // ============ FOURNISSEUR vs DESTINATAIRE (par position) ============
    // Le FOURNISSEUR est en en-tête (1res lignes). Le DESTINATAIRE (client)
    // est souvent introduit par "Client / Facturé à / Adressé à / À".
    // Une société du groupe PEUT être fournisseur d'une autre : on ne s'appuie
    // donc PAS sur "est-ce une de nos sociétés" pour exclure le fournisseur.
    const compact = upper.replace(/[ .]/g, "");
    const upNoSp = upper.replace(/\s+/g, "");
    const nos = nosSirets();

    // Tous les SIRET présents, dans l'ordre d'apparition
    const siretsOrdre = [];
    let mm; const reSiret = /\d{14}/g;
    while ((mm = reSiret.exec(compact))) siretsOrdre.push({ siret: mm[0], pos: mm.index });

    // Repère l'index (dans le texte) du marqueur "client/destinataire"
    const mClient = upper.search(/CLIENT|FACTUR[ÉE]\s*[ÀA]|ADRESS[ÉE]\s*[ÀA]|[ÀA]\s+L'?ATTENTION|DESTINATAIRE|DOIT\b/);
    const posClient = mClient >= 0 ? mClient : Infinity;

    // Position d'une de NOS sociétés par signal FORT uniquement
    // (SIRET/SIREN présent, ou raison sociale exacte). Pas par code postal seul,
    // sinon faux positifs. Renvoie Infinity si pas de signal fort.
    function positionSociete(c) {
      let best = Infinity;
      const ids = [c.siret].concat((c.etablissements || []).map((e) => e.siret)).filter(Boolean).map((x) => String(x).replace(/\D/g, ""));
      if (c.siren) ids.push(String(c.siren).replace(/\D/g, ""));
      ids.forEach((id) => { if (id && id.length >= 9) { const p = compact.indexOf(id); if (p >= 0 && p < best) best = p; } });
      if (c.raisonSociale && c.raisonSociale.length > 4) { const p = upper.indexOf(c.raisonSociale.toUpperCase()); if (p >= 0 && p < best) best = p; }
      if (c.marque && c.marque.length > 4) { const p = upNoSp.indexOf(c.marque.toUpperCase().replace(/\s+/g, "")); if (p >= 0 && p < best) best = p; }
      return best;
    }

    // Score de présence d'une de nos sociétés (sert à choisir le destinataire)
    function scoreSociete(c, posCible) {
      let sc = 0;
      const ids = [c.siret].concat((c.etablissements || []).map((e) => e.siret)).filter(Boolean).map((x) => String(x).replace(/\D/g, ""));
      if (c.siren) ids.push(String(c.siren).replace(/\D/g, ""));
      ids.forEach((id) => { if (id && id.length >= 9 && compact.indexOf(id) >= 0) sc += 10; });
      if (c.raisonSociale && c.raisonSociale.length > 3 && upper.indexOf(c.raisonSociale.toUpperCase()) >= 0) sc += 6;
      const adrs = [c.siege].concat((c.etablissements || []).map((e) => e.adresse)).concat(c.campuses || []).filter(Boolean);
      adrs.forEach((a) => {
        const A = a.toUpperCase();
        const cp = (A.match(/\b(\d{5})\b/) || [])[1];
        const motRue = (A.match(/(?:RUE|AVENUE|AV|BD|BLD|BOULEVARD|IMPASSE|PLACE|CHEMIN|ROUTE|ALL[ÉE]E|QUAI)\s+(?:DE\s+|DU\s+|DES\s+|LA\s+|LE\s+)?([A-ZÀ-Ÿ]{4,})/) || [])[1];
        if (cp && upper.indexOf(cp) >= 0) { sc += 2; if (motRue && upper.indexOf(motRue) >= 0) sc += 3; }
      });
      if (c.marque && c.marque.length > 4 && upNoSp.indexOf(c.marque.toUpperCase().replace(/\s+/g, "")) >= 0) sc += 2;
      // bonus si la société apparaît APRÈS le marqueur "client" (= destinataire)
      if (posCible < Infinity && posCible >= posClient) sc += 4;
      return sc;
    }

    // Liste de nos sociétés présentes avec leur position
    const presentes = (window.PNG && PNG.companies || [])
      .map((c) => ({ c, pos: positionSociete(c) }))
      .filter((o) => o.pos < Infinity)
      .sort((a, b) => a.pos - b.pos);

    // FOURNISSEUR membre du groupe = une de nos sociétés présente AVANT le
    // marqueur "client" (donc en en-tête). Sinon le fournisseur est externe.
    let societeFournisseur = null;
    if (presentes.length && presentes[0].pos < posClient) societeFournisseur = presentes[0].c;

    // DESTINATAIRE = la nôtre la mieux scorée, en privilégiant celle après "client"
    // et en évitant de reprendre le fournisseur si une autre est présente.
    let societeHint = null, bestScore = 0;
    (window.PNG && PNG.companies || []).forEach((c) => {
      const pos = positionSociete(c);
      let sc = scoreSociete(c, pos);
      // si c'est aussi le fournisseur en en-tête et qu'une autre société existe, on pénalise
      if (societeFournisseur && c.id === societeFournisseur.id && presentes.length > 1) sc -= 8;
      if (sc > bestScore) { bestScore = sc; societeHint = c.id; }
    });
    if (bestScore < 4) societeHint = null;

    // ---- SIRET fournisseur vs destinataire ----
    let siretFournisseur = "", siretNous = "";
    // si on a identifié notre destinataire, son SIRET = le nôtre
    sirets_loop:
    for (const o of siretsOrdre) {
      const x = o.siret;
      if (nos.has(x) || nos.has(x.slice(0, 9))) { if (!siretNous) siretNous = x; }
    }
    // fournisseur : 1er SIRET qui n'est pas celui du destinataire reconnu
    for (const o of siretsOrdre) {
      if (o.siret !== siretNous) { siretFournisseur = o.siret; break; }
    }
    const sirenLabel = compact.match(/SIREN[:\s]*(\d{9})/) || compact.match(/RCS[A-Z\s]*?(\d{9})/);
    let sirenFournisseur = siretFournisseur ? siretFournisseur.slice(0, 9) : "";
    if (!sirenFournisseur && sirenLabel) sirenFournisseur = sirenLabel[1];

    // ---- Fournisseur (NOM) ----
    let fournisseur = "";
    // 1) fournisseur = membre du groupe SEULEMENT s'il est distinct du destinataire
    //    ET prouvé par son SIRET/SIREN dans le texte (évite faux positifs).
    if (societeFournisseur && societeFournisseur.id !== societeHint) {
      const fid = String(societeFournisseur.siren || "").replace(/\D/g, "");
      const fSirets = [societeFournisseur.siret].concat((societeFournisseur.etablissements || []).map((e) => e.siret)).filter(Boolean).map((x) => String(x).replace(/\D/g, ""));
      const prouve = (fid && compact.indexOf(fid) >= 0) || fSirets.some((s) => compact.indexOf(s) >= 0);
      if (prouve) fournisseur = societeFournisseur.raisonSociale;
    }
    // 1bis) valeur explicite après "Émetteur / Fournisseur / Vendeur / De :"
    if (!fournisseur) {
      const mEm = t.match(/(?:[ée]metteur|fournisseur|vendeur|raison\s*sociale|soci[ée]t[ée])\s*[:#]?\s*([^\n]{2,60})/i)
               || t.match(/\bde\s*[:#]\s*([A-Za-zÀ-ÿ][^\n]{2,60})/i);
      if (mEm && mEm[1] && !/^(facture|client|date|tva)/i.test(mEm[1].trim())) {
        fournisseur = nettoyerNomFournisseur(mEm[1]);
      }
    }
    // 2) sinon, position (bbox) ou 1re ligne d'en-tête plausible
    if (!fournisseur) fournisseur = fournisseurParPosition(mots, W, H);
    if (!fournisseur) {
      const nomDest = societeHint ? (U_companyName(societeHint) || "") : "";
      // mots qui sont des LIBELLÉS (à ne jamais prendre comme nom)
      const LABEL = /^(\s*)?([ée]metteur|fournisseur|vendeur|destinataire|client|factur[ée]\s*[àa]|adress[ée]\s*[àa]|exp[ée]diteur|de|[àa]|objet|d[ée]signation|r[ée]f[ée]rence|coordonn[ée]es)\s*[:#]?\s*$/i;
      const candidate = lignes.filter((l) => {
        if (JUNK.test(l)) return false;
        if (LABEL.test(l)) return false;                                  // libellé seul -> ignoré
        if (nomDest && l.toUpperCase().indexOf(nomDest.toUpperCase()) >= 0) return false; // pas le destinataire
        if (/facture|invoice|devis|^date|^n[°o]\b|siret|siren|tva|iban|bic|rib|t[ée]l|@|www|http|^code|page|\bque?\b|client|factur[ée]\s*[àa]|^[ée]metteur|^destinataire/i.test(l)) return false;
        if (/\bcapital\b|\brcs\b|\bnaf\b|\bape\b|au capital|r\.c\.s|p[ée]nalit|escompte|condition|r[èe]glement|\bd[ée]lai\b|si[èe]ge|tva intra|identifiant/i.test(l)) return false;
        if (/^\d/.test(l)) return false;
        if (/^[\d\s.,€%\/-]+$/.test(l)) return false;
        if (!/[A-Za-zÀ-ÿ]{3}/.test(l)) return false;
        return true;
      });
      const best = candidate[0];
      fournisseur = best ? nettoyerNomFournisseur(best) : "";
    }
    // garde-fou : si le nom retenu est juste un libellé, on le vide
    if (/^([ée]metteur|fournisseur|vendeur|client|destinataire|facture|de|[àa])$/i.test((fournisseur || "").trim())) fournisseur = "";

    // ---- N° de facture : UNIQUEMENT après une mention explicite ----
    let numeroFacture = "";
    const VAL = "([A-Za-z0-9][A-Za-z0-9\\-\\/\\._ ]{1,})";
    const numPatterns = [
      new RegExp("r[\u00e9e]f[\u00e9e]rence\\s*(?:de\\s*)?facture\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("num[\u00e9e]ro\\s*(?:de\\s*)?facture\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("n[\u00b0\u00bao]\\s*(?:de\\s*)?facture\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("facture\\s*n[\u00b0\u00bao]?\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("facture\\s*[:#]\\s*" + VAL, "i"),
      new RegExp("invoice\\s*(?:n[\u00b0\u00bao]?|number|#)\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("\\bn[\u00b0\u00ba]\\s*[:#]?\\s*([0-9][0-9\\-\\/\\. ]{1,})", "i"),
    ];
    const stop = /^(date|tva|ttc|ht|du|le|la|de|et|siret|siren|euro|eur)$/i;
    for (const re of numPatterns) {
      const m = t.match(re);
      if (m && m[1]) {
        let val = m[1].replace(/\s+/g, "").replace(/[.\-\/]+$/, "");
        val = val.replace(/^[nN][\u00b0\u00bao]?(?=\d)/, "");
        if (val && !stop.test(val) && /\d/.test(val) && val.length >= 2) { numeroFacture = val.slice(0, 24); break; }
      }
    }

    // ---- TVA / montants ---- (on PIOCHE dans le texte brut)
    const tvaNonAppl = /tva\s+non\s+applicable|art(?:icle)?\.?\s*293\s*b|exon[ée]ration\s+de\s+tva|non\s+assujetti/i.test(t);
    let ttc = montantApresMot(t, "total\\s*ttc|net\\s*[àa]\\s*payer|montant\\s*ttc|total\\s*t\\.?t\\.?c|total\\s*[àa]\\s*payer");
    let ht  = montantApresMot(t, "total\\s*ht|montant\\s*ht|total\\s*h\\.?t|sous[- ]?total|base\\s*ht");
    let tva = montantApresMot(t, "total\\s*tva|montant\\s*(?:de\\s*)?tva|t\\.?v\\.?a\\.?\\s*\\(?\\s*\\d", true);
    // taux : "TVA 20%" / "TVA (20%)" / "(20 %)" / "20,00%"
    const tauxM = t.match(/t\.?v\.?a\.?[^%\d]{0,10}(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i) || t.match(/\((\d{1,2}(?:[.,]\d{1,2})?)\s*%\)/) || t.match(/(\d{1,2}(?:[.,]\d)?)\s*%/);
    let taux = tvaNonAppl ? 0 : (tauxM ? parseMontant(tauxM[1]) : 20);

    const montants = tousMontants(t).sort((a, b) => a - b);
    if (ttc == null && montants.length) ttc = montants[montants.length - 1];

    // valeurs détectées telles quelles (pour le contrôle de cohérence)
    const detHT = ht, detTVA = tva, detTTC = ttc;

    if (tvaNonAppl) {
      if (ht == null && ttc != null) ht = ttc;
      if (ttc == null && ht != null) ttc = ht;
      tva = 0;
    } else {
      if (ht == null && ttc != null && tva != null) ht = Math.round((ttc - tva) * 100) / 100;
      if (ht == null && ttc != null) ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
      if (tva == null && ht != null && ttc != null) tva = Math.round((ttc - ht) * 100) / 100;
      if (tva == null && ht != null) tva = Math.round((ht * taux / 100) * 100) / 100;
      if (ttc == null && ht != null) ttc = Math.round((ht + (tva || 0)) * 100) / 100;
    }

    // ---- CONTRÔLE DE COHÉRENCE : HT + TVA = TTC, et TVA ≈ HT*taux ----
    const alertes = [];
    const r2 = (x) => Math.round((x || 0) * 100) / 100;
    if (ht != null && tva != null && ttc != null) {
      const sommeTTC = r2(ht + tva);
      if (Math.abs(sommeTTC - ttc) > 0.02) {
        alertes.push("Incohérence : HT (" + r2(ht) + ") + TVA (" + r2(tva) + ") = " + sommeTTC + " ≠ TTC détecté (" + r2(ttc) + ")");
      }
      if (!tvaNonAppl && taux) {
        const tvaTheo = r2(ht * taux / 100);
        if (Math.abs(tvaTheo - tva) > 0.02) {
          alertes.push("TVA détectée (" + r2(tva) + ") ≠ TVA calculée " + taux + "% (" + tvaTheo + ")");
        }
      }
      // si une valeur a été détectée ET diffère du recalcul, on le signale
      if (detTTC != null && Math.abs(detTTC - ttc) > 0.02) alertes.push("TTC : détecté " + r2(detTTC) + " vs retenu " + r2(ttc));
      if (detHT != null && Math.abs(detHT - ht) > 0.02) alertes.push("HT : détecté " + r2(detHT) + " vs retenu " + r2(ht));
    }

    const dates = findDates(t);

    return {
      fournisseur, numeroFacture,
      siret: siretFournisseur,
      siren: sirenFournisseur,
      siretDestinataire: siretNous,
      societeHint: societeHint,
      dateFacture: dates[0] || null,
      montantHT: ht, montantTVA: tva, montantTTC: ttc, tauxTva: taux,
      alerteMontants: alertes.length ? alertes : null,
      texteBrut: t.slice(0, 4000),
    };
  }

  /* ============================ MOTEURS OCR ===========================
   * Réglages persistants : moteur choisi + clés API (stockés sur le navigateur).
   *  - "ocrspace"  : OCR.space (gratuit, marche sans inscription via la clé démo)
   *  - "mindee"    : Mindee (extraction structurée factures, clé gratuite requise)
   *  - "tesseract" : OCR local (secours, sans réseau)
   * ------------------------------------------------------------------- */
  const CFG_KEY = "compta-png-ocr-cfg";
  function getConfig() {
    var def = { engine: "ocrspace", ocrspaceKey: "", mindeeKey: "", geminiKey: "", useGemini: true };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); }
    catch (e) { return def; }
  }
  function setConfig(c) {
    var cur = getConfig();
    try { localStorage.setItem(CFG_KEY, JSON.stringify(Object.assign(cur, c))); } catch (e) {}
  }

  /* ---- IA Gemini (GRATUIT) : range le texte brut dans les bonnes cases -----
   * On envoie le texte OCR + la liste de NOS sociétés ; l'IA renvoie un JSON
   * structuré (fournisseur, destinataire, n°, dates, HT/TVA/TTC). */
  async function geminiStructurer(texteBrut, onProgress) {
    var cfg = getConfig();
    if (!cfg.geminiKey) return null;            // pas de clé -> on n'utilise pas l'IA
    if (!texteBrut || texteBrut.replace(/\s/g, "").length < 20) return null;
    if (onProgress) onProgress(0.9, "Analyse par l'IA (Gemini)…");

    var nos = (window.PNG && PNG.companies || []).map(function (c) {
      return { id: c.id, nom: c.raisonSociale, siren: c.siren || "", siret: c.siret || "" };
    });
    // plan comptable (comptes de charge) fourni à l'IA pour qu'elle choisisse
    var comptes = (window.PNG && PNG.planComptable || [])
      .filter(function (p) { return p.type === "Charge"; })
      .map(function (p) { return { compte: p.num, libelle: p.libelle }; });

    var prompt =
      "Tu es un expert-comptable français. Voici le TEXTE BRUT d'une facture fournisseur (océrisé).\n" +
      "Extrais les informations et renvoie UNIQUEMENT un JSON valide, sans texte autour, au format :\n" +
      '{"fournisseur":"","fournisseurSiren":"","fournisseurSiret":"","numeroFacture":"","dateFacture":"AAAA-MM-JJ","montantHT":0,"montantTVA":0,"montantTTC":0,"tauxTva":0,"destinataireId":"","destinataireNom":"","categorie":"","compteCharge":""}\n\n' +
      "RÈGLES :\n" +
      "- 'fournisseur' = celui qui ÉMET la facture (en-tête / pied de page), JAMAIS un libellé comme 'Émetteur'.\n" +
      "- 'destinataire' = le CLIENT facturé. Compare-le à NOS SOCIÉTÉS ci-dessous : si c'est l'une d'elles, mets son id dans 'destinataireId'.\n" +
      "- Une de nos sociétés PEUT être le fournisseur d'une autre : base-toi sur la POSITION (émetteur vs client), pas sur 'c'est une de nos sociétés'.\n" +
      "- Montants en nombres (point décimal). Si 'TVA non applicable' (art. 293B), montantTVA=0 et tauxTva=0.\n" +
      "- 'categorie' = type de dépense en 1-3 mots selon le CONTENU/désignation de la facture (ex: 'Télécom', 'Loyer', 'Publicité', 'Honoraires', 'Fournitures', 'Logiciel/SaaS', 'Formation', 'Énergie', 'Assurance', 'Entretien', 'Transport').\n" +
      "- 'compteCharge' = le NUMÉRO DE COMPTE le plus adapté, choisi STRICTEMENT dans le PLAN COMPTABLE ci-dessous (renvoie uniquement le numéro, ex '626100'). Si rien ne correspond, mets '606800'.\n" +
      "- Si une info est absente, mets \"\" ou 0. Ne devine pas un SIREN.\n\n" +
      "PLAN COMPTABLE (comptes de charge autorisés) : " + JSON.stringify(comptes) + "\n\n" +
      "NOS SOCIÉTÉS : " + JSON.stringify(nos) + "\n\n" +
      "TEXTE BRUT DE LA FACTURE :\n" + texteBrut.slice(0, 8000);

    // Modèles essayés dans l'ordre : Flash-Lite (plus gros quota gratuit) ->
    // 2.5 Flash-Lite -> 1.5 Flash -> 2.0 Flash. Réessai si 429 (limite débit).
    var modeles = (cfg.geminiModel ? [cfg.geminiModel] : [])
      .concat(["gemini-2.0-flash-lite", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-2.0-flash"]);
    var body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var dernierStatut = 0, data = null, detail = "", modelKO = "";

    for (var mi = 0; mi < modeles.length && !data; mi++) {
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modeles[mi] + ":generateContent?key=" + encodeURIComponent(cfg.geminiKey);
      for (var att = 0; att < 2; att++) {
        var resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body });
        if (resp.ok) { data = await resp.json(); break; }
        dernierStatut = resp.status; modelKO = modeles[mi];
        // lit le message détaillé de Google
        try { var ej = await resp.json(); detail = (ej && ej.error && ej.error.message) ? ej.error.message : ""; } catch (e) { detail = ""; }
        if (resp.status === 429) {
          // si la quota est journalière (PerDay), inutile de réessayer ce modèle -> suivant
          if (/per day|PerDay|daily/i.test(detail)) break;
          if (onProgress) onProgress(0.92, "IA occupée, nouvel essai…");
          await sleep(3000 * (att + 1)); continue;
        }
        if (resp.status === 404) break;
        if (resp.status === 400 || resp.status === 403) throw new Error("Gemini HTTP " + resp.status + " : " + (detail || "clé invalide ou API non activée"));
        break;
      }
    }
    if (!data) {
      var court = detail ? detail.split(". ")[0].slice(0, 180) : "";
      throw new Error("Gemini HTTP " + dernierStatut + (modelKO ? " [" + modelKO + "]" : "") + (court ? " — " + court : ""));
    }

    var txt = data && data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text;
    if (!txt) return null;
    var j;
    try { j = JSON.parse(txt); } catch (e) {
      var m = txt.match(/\{[\s\S]*\}/); if (!m) return null; j = JSON.parse(m[0]);
    }
    return j;
  }

  // Fusionne le résultat IA dans les champs (l'IA prime si renseignée)
  function appliquerGemini(champs, j) {
    if (!j) return champs;
    var num = function (x) { var n = parseFloat(String(x).replace(",", ".")); return isNaN(n) ? null : Math.round(n * 100) / 100; };
    if (j.fournisseur) champs.fournisseur = String(j.fournisseur).trim();
    if (j.fournisseurSiren) champs.siren = String(j.fournisseurSiren).replace(/\D/g, "");
    if (j.fournisseurSiret) champs.siret = String(j.fournisseurSiret).replace(/\D/g, "");
    if (j.numeroFacture) champs.numeroFacture = String(j.numeroFacture).trim();
    if (j.dateFacture && /\d{4}-\d{2}-\d{2}/.test(j.dateFacture)) champs.dateFacture = j.dateFacture;
    if (num(j.montantHT) != null) champs.montantHT = num(j.montantHT);
    if (num(j.montantTVA) != null) champs.montantTVA = num(j.montantTVA);
    if (num(j.montantTTC) != null) champs.montantTTC = num(j.montantTTC);
    if (num(j.tauxTva) != null) champs.tauxTva = num(j.tauxTva);
    if (j.destinataireId) champs.societeHint = j.destinataireId;
    if (j.categorie) champs.categorie = String(j.categorie).trim();
    // compte de charge proposé par l'IA, validé contre le plan comptable
    if (j.compteCharge) {
      var cc = String(j.compteCharge).replace(/\D/g, "");
      var existe = (window.PNG && PNG.planComptable || []).some(function (p) { return p.num === cc; });
      if (cc && existe) { champs.compteCharge = cc; champs.compteParIA = true; }
    }
    champs.moteur = (champs.moteur || "OCR") + " + IA Gemini";
    return champs;
  }

  function fileToBase64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result)); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  /* ---- OCR.space : renvoie du texte, puis parseFacture l'analyse -------- */
  async function ocrspaceText(file, onProgress, imageDataURL) {
    var cfg = getConfig();
    var key = cfg.ocrspaceKey || "helloworld"; // clé démo si aucune fournie
    if (onProgress) onProgress(0.2, "Envoi à OCR.space…");
    var fd = new FormData();
    fd.append("apikey", key);
    fd.append("language", "fre");
    fd.append("OCREngine", "2");
    fd.append("scale", "true");
    fd.append("isTable", "true");
    // Pour un PDF on envoie l'IMAGE rendue (1re page) : OCR.space lit alors les
    // pixels, ce qui contourne les couches texte cassées (polices perso).
    if (imageDataURL) {
      fd.append("base64Image", imageDataURL);
      fd.append("filetype", "PNG");
    } else {
      fd.append("file", file);
    }
    var resp = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: fd });
    if (!resp.ok) throw new Error("OCR.space HTTP " + resp.status);
    var data = await resp.json();
    if (data.IsErroredOnProcessing) throw new Error((data.ErrorMessage && data.ErrorMessage[0]) || "Erreur OCR.space");
    if (onProgress) onProgress(0.9, "Analyse des champs…");
    // concatène le texte de TOUTES les pages (factures multi-pages)
    var parts = (data.ParsedResults || []).map(function (r) { return r.ParsedText || ""; });
    return parts.join("\n");
  }

  /* ---- Mindee : extraction STRUCTURÉE des champs de facture ------------- */
  function mindeeVal(f) { return f && (f.value != null ? f.value : (f.content != null ? f.content : null)); }
  async function mindeeAnalyse(file, onProgress) {
    var cfg = getConfig();
    if (!cfg.mindeeKey) throw new Error("Clé API Mindee manquante (réglages OCR)");
    if (onProgress) onProgress(0.2, "Envoi à Mindee…");
    var fd = new FormData();
    fd.append("document", file);
    var resp = await fetch("https://api.mindee.net/v1/products/mindee/invoices/v4/predict", {
      method: "POST",
      headers: { "Authorization": "Token " + cfg.mindeeKey },
      body: fd,
    });
    if (resp.status === 401) throw new Error("Clé Mindee invalide");
    if (!resp.ok) throw new Error("Mindee HTTP " + resp.status);
    var data = await resp.json();
    var p = data && data.document && data.document.inference && data.document.inference.prediction;
    if (!p) throw new Error("Réponse Mindee inattendue");
    if (onProgress) onProgress(0.92, "Lecture des champs…");

    // SIRET / n° TVA fournisseur
    var siret = "", siren = "";
    (p.supplier_company_registrations || []).forEach(function (r) {
      if (r.type === "SIRET" && r.value) siret = String(r.value).replace(/\D/g, "");
      if (r.type === "SIREN" && r.value && !siren) siren = String(r.value).replace(/\D/g, "");
    });
    if (!siren && siret) siren = siret.slice(0, 9);

    var taxes = p.taxes || [];
    var tva = taxes.length ? taxes.reduce(function (s, t) { return s + (t.value || 0); }, 0) : null;
    var taux = taxes.length && taxes[0].rate ? taxes[0].rate : 20;
    var ht = mindeeVal(p.total_net);
    var ttc = mindeeVal(p.total_amount);
    if (tva == null && p.total_tax) tva = mindeeVal(p.total_tax);

    // date au format ISO déjà fourni par Mindee
    var dateF = mindeeVal(p.date) || mindeeVal(p.invoice_date) || null;

    var champs = {
      fournisseur: mindeeVal(p.supplier_name) || "",
      numeroFacture: mindeeVal(p.invoice_number) || "",
      siret: siret, siren: siren,
      siretDestinataire: "",                 // Mindee donne aussi customer, non nécessaire ici
      dateFacture: dateF,
      montantHT: ht, montantTVA: tva, montantTTC: ttc,
      tauxTva: taux,
      clientNom: mindeeVal(p.customer_name) || "",
      texteBrut: "",
      moteur: "Mindee",
    };
    if (champs.montantHT == null && champs.montantTTC != null) champs.montantHT = Math.round((champs.montantTTC / (1 + taux / 100)) * 100) / 100;
    if (champs.montantTVA == null && champs.montantHT != null && champs.montantTTC != null) champs.montantTVA = Math.round((champs.montantTTC - champs.montantHT) * 100) / 100;
    return champs;
  }

  /* Pipeline complet : fichier -> aperçu + texte + champs extraits */
  /* Le texte natif d'un PDF est-il PROPRE (vrais mots) ou cassé (police perso) ?
   * On exige des mots-clés de facture ET une faible proportion de fragments
   * d'1-2 lettres isolées (symptôme du texte éclaté "OSMAN I QEN DRIM"). */
  function texteNatifFiable(t) {
    if (!t) return false;
    var clean = t.replace(/\s+/g, " ").trim();
    if (clean.replace(/\s/g, "").length < 80) return false;
    var hasKw = /(facture|total|tva|montant|ttc|\bht\b|client|date)/i.test(clean);
    if (!hasKw) return false;
    var mots = clean.split(/\s+/);
    var courts = mots.filter(function (m) { return /^[A-Za-zÀ-ÿ]{1,2}$/.test(m); }).length;
    var ratio = courts / Math.max(1, mots.length);
    return ratio < 0.30; // moins de 30% de fragments isolés = texte propre
  }

  // Applique l'IA Gemini (si clé) sur le texte, puis recontrôle la cohérence.
  async function affinerIA(champs, onProgress) {
    var cfg = getConfig();
    if (cfg.useGemini && cfg.geminiKey && champs && champs.texteBrut) {
      try {
        var j = await geminiStructurer(champs.texteBrut, onProgress);
        if (j) {
          appliquerGemini(champs, j);
          // recalcule l'alerte de cohérence sur les nouveaux montants
          var r2 = function (x) { return Math.round((x || 0) * 100) / 100; };
          var al = [];
          if (champs.montantHT != null && champs.montantTVA != null && champs.montantTTC != null) {
            if (Math.abs(r2(champs.montantHT + champs.montantTVA) - champs.montantTTC) > 0.02)
              al.push("HT (" + r2(champs.montantHT) + ") + TVA (" + r2(champs.montantTVA) + ") = " + r2(champs.montantHT + champs.montantTVA) + " != TTC (" + r2(champs.montantTTC) + ")");
          }
          champs.alerteMontants = al.length ? al : null;
        }
      } catch (e) {
        champs.moteur = (champs.moteur || "OCR") + " (IA échec)";
        champs.geminiErreur = (e && e.message) ? e.message : String(e);
      }
    }
    return champs;
  }

  // Test direct de la clé Gemini (réglages) : renvoie {ok, message}
  async function testerGemini() {
    var cfg = getConfig();
    if (!cfg.geminiKey) return { ok: false, message: "Aucune clé Gemini saisie." };
    try {
      var j = await geminiStructurer("FACTURE\nACME SARL\nN° 123\nTotal HT 100,00\nTVA 20% 20,00\nTotal TTC 120,00", null);
      if (j && (j.fournisseur || j.montantTTC)) return { ok: true, message: "✓ IA OK — fournisseur lu : " + (j.fournisseur || "?") + ", TTC : " + (j.montantTTC || "?") };
      return { ok: false, message: "Réponse vide de l'IA." };
    } catch (e) {
      return { ok: false, message: (e && e.message) ? e.message : String(e) };
    }
  }

  async function analyser(file, onProgress) {
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    if (onProgress) onProgress(0.05, isPdf ? "Lecture du PDF…" : "Lecture de l'image…");
    // aperçu affichable (image) — pour PDF on rend la 1re page
    const apercu = isPdf ? await pdfToImage(file) : await fileToDataURL(file);
    let apercus = null;
    if (isPdf) { try { apercus = await pdfToImagesArray(file, 8); } catch (e) { apercus = null; } }
    if (!apercus || !apercus.length) apercus = [apercu];
    const cfg = getConfig();
    const engine = cfg.engine || "ocrspace";

    // 0) PDF NUMÉRIQUE PROPRE uniquement : couche texte native (exact, sans OCR).
    //    Si le texte est cassé (police perso), on passe à OCR.space (lit l'image).
    if (isPdf && engine !== "mindee") {
      if (onProgress) onProgress(0.15, "Analyse du texte du PDF…");
      const texteNatif = await pdfExtractText(file);
      if (texteNatifFiable(texteNatif)) {
        let champs = parseFacture(texteNatif, null, 0, 0);
        champs.moteur = "PDF texte (exact)";
        champs = await affinerIA(champs, onProgress);
        if (onProgress) onProgress(1, "Terminé");
        return { apercu: apercu, apercus: apercus, champs: champs, moteur: champs.moteur };
      }
      // sinon : texte cassé -> on continue vers OCR.space (image)
    }

    // 1) Mindee : extraction structurée directe
    if (engine === "mindee") {
      try {
        const champs = await mindeeAnalyse(file, onProgress);
        if (onProgress) onProgress(1, "Terminé");
        return { apercu: apercu, apercus: apercus, champs: champs, moteur: "Mindee" };
      } catch (e) {
        if (onProgress) onProgress(0.3, "Mindee indisponible, secours OCR.space…");
        // bascule vers OCR.space
      }
    }

    // 2) OCR.space : texte -> parseFacture
    if (engine === "ocrspace" || engine === "mindee") {
      try {
        // Multi-pages : on rend toutes les pages empilées en 1 image (sinon
        // l'envoi direct du PDF est limité à ~3 pages sur l'offre gratuite).
        let img = null;
        if (isPdf) {
          if (onProgress) onProgress(0.18, "Préparation des pages…");
          try { img = await pdfToImagesStacked(file, 8); } catch (e2) { img = apercu; }
        }
        const texte = await ocrspaceText(file, onProgress, img);
        if (texte && texte.trim().length > 0) {
          let champs = parseFacture(texte, null, 0, 0);
          champs.moteur = "OCR.space";
          champs = await affinerIA(champs, onProgress);
          if (onProgress) onProgress(1, "Terminé");
          return { apercu: apercu, apercus: apercus, champs: champs, moteur: champs.moteur };
        }
      } catch (e) {
        if (onProgress) onProgress(0.3, "OCR.space indisponible, secours local…");
      }
    }

    // 3) Secours : Tesseract local
    if (onProgress) onProgress(0.35, "Amélioration de l'image…");
    const procURL = await preprocess(apercu);
    if (onProgress) onProgress(0.4, "Océrisation locale…");
    const data = await imageToData(procURL, (p) => onProgress && onProgress(0.4 + p * 0.55, "Océrisation locale… " + Math.round(p * 100) + "%"));
    let champs = parseFacture(data.texte, data.mots, data.largeur, data.hauteur);
    champs.moteur = "Local (Tesseract)";
    champs = await affinerIA(champs, onProgress);
    if (onProgress) onProgress(1, "Terminé");
    return { apercu: apercu, apercus: apercus, champs: champs, moteur: champs.moteur };
  }

  /* OCR d'une ZONE de l'aperçu. imgEl = <img>, rect = {x,y,w,h} en pixels
   * relatifs à l'image AFFICHÉE. Recadre en pleine résolution puis océrise.
   * mode "amount" garde surtout les chiffres, "text" nettoie la casse. */
  async function ocrZone(imgEl, rect, mode) {
    if (!window.Tesseract) throw new Error("Tesseract indisponible");
    const scaleX = imgEl.naturalWidth / imgEl.clientWidth;
    const scaleY = imgEl.naturalHeight / imgEl.clientHeight;
    const sx = Math.max(0, rect.x * scaleX), sy = Math.max(0, rect.y * scaleY);
    const sw = Math.max(4, rect.w * scaleX), sh = Math.max(4, rect.h * scaleY);
    const canvas = document.createElement("canvas");
    const up = 2; // sur-échantillonnage pour mieux lire les petits caractères
    canvas.width = sw * up; canvas.height = sh * up;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const res = await window.Tesseract.recognize(canvas.toDataURL("image/png"), "fra+eng");
    let txt = (res.data.text || "").replace(/\n+/g, " ").trim();
    if (mode === "amount") {
      const m = txt.replace(/[^0-9.,]/g, " ").match(/\d[\d\s.,]*\d|\d/);
      txt = m ? parseMontant(m[0]) : txt;
    } else {
      txt = reparerEspaces(txt).replace(/\s{2,}/g, " ").trim();
    }
    return txt;
  }

  return { dispo, analyser, parseFacture, pdfToImage, imageToText, ocrZone, getConfig, setConfig, pdfExtractText, geminiStructurer, testerGemini };
})();
