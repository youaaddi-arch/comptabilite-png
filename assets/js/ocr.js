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

  function parseFacture(texte, mots, W, H) {
    const t = texte.replace(/ /g, " ");
    const upper = t.toUpperCase();
    const lignes = t.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 2);

    // ----- SIRET : sépare le nôtre (destinataire) du fournisseur -----
    const compact = upper.replace(/[ .]/g, "");
    const sirets = (compact.match(/\d{14}/g) || []);
    const nos = nosSirets();
    let siretFournisseur = "", siretNous = "";
    sirets.forEach((s) => {
      if (nos.has(s) || nos.has(s.slice(0, 9))) { if (!siretNous) siretNous = s; }
      else if (!siretFournisseur) siretFournisseur = s;
    });
    // SIREN explicite éventuel
    const sirenLabel = compact.match(/SIREN[:\s]*(\d{9})/);
    let sirenFournisseur = siretFournisseur ? siretFournisseur.slice(0, 9) : "";
    if (!sirenFournisseur && sirenLabel && !nos.has(sirenLabel[1])) sirenFournisseur = sirenLabel[1];

    // ----- Fournisseur : position d'abord, sinon heuristique texte -----
    let fournisseur = fournisseurParPosition(mots, W, H);
    if (!fournisseur) {
      for (const l of lignes) {
        if (/facture|invoice|devis|n[°o]\b|siret|siren|tva|date|client|adresse|@/i.test(l)) continue;
        if (/^[\d\s.,€%-]+$/.test(l)) continue;
        if (!/[A-Za-zÀ-ÿ]{2}/.test(l)) continue;
        if (estNotreSociete(l)) continue;          // ne prend jamais notre société
        fournisseur = reparerEspaces(l).slice(0, 60); break;
      }
    }

    // ----- N° de facture -----
    let numeroFacture = "";
    const VAL = "([A-Za-z0-9][A-Za-z0-9\\-\\/\\._]{1,})";
    const numPatterns = [
      new RegExp("n[°o]\\s*(?:de\\s*)?facture\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("num[ée]ro\\s*(?:de\\s*)?facture\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("facture\\s*(?:n[°o]|num[ée]ro)?\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("invoice\\s*(?:n[°o]|number|#|:)?\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("\\bn[°o]\\s*[:#]?\\s*" + VAL, "i"),
    ];
    const stop = /^(date|tva|ttc|ht|du|le|la|de|et|siret|siren)$/i;
    for (const re of numPatterns) {
      const m = t.match(re);
      if (m && m[1] && !stop.test(m[1]) && /\d/.test(m[1])) { numeroFacture = m[1].replace(/[.\s,;]+$/, ""); break; }
    }

    // ----- Montants -----
    let ttc = montantApresMot(t, "total\\s*ttc|net\\s*[àa]\\s*payer|montant\\s*ttc|total\\s*t\\.?t\\.?c");
    let ht = montantApresMot(t, "total\\s*ht|montant\\s*ht|total\\s*h\\.?t|sous[- ]?total");
    let tva = montantApresMot(t, "t\\.?v\\.?a\\.?|montant\\s*tva", true);
    const tauxM = t.match(/(\d{1,2}(?:[.,]\d)?)\s*%/);
    let taux = tauxM ? parseMontant(tauxM[1]) : 20;
    const montants = tousMontants(t).sort((a, b) => a - b);
    if (ttc == null && montants.length) ttc = montants[montants.length - 1];
    if (ht == null && ttc != null) ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
    if (tva == null && ht != null && ttc != null) tva = Math.round((ttc - ht) * 100) / 100;
    if (ht != null && taux && tva == null) tva = Math.round((ht * taux / 100) * 100) / 100;

    const dates = findDates(t);

    return {
      fournisseur, numeroFacture,
      siret: siretFournisseur,
      siren: sirenFournisseur,
      siretDestinataire: siretNous,
      dateFacture: dates[0] || null,
      montantHT: ht, montantTVA: tva, montantTTC: ttc, tauxTva: taux,
      texteBrut: t.slice(0, 4000),
    };
  }

  /* Pipeline complet : fichier -> aperçu + texte + champs extraits */
  async function analyser(file, onProgress) {
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    if (onProgress) onProgress(0.05, isPdf ? "Lecture du PDF…" : "Lecture de l'image…");
    const rawURL = isPdf ? await pdfToImage(file) : await fileToDataURL(file);
    if (onProgress) onProgress(0.12, "Amélioration de l'image…");
    const procURL = await preprocess(rawURL);
    if (onProgress) onProgress(0.2, "Océrisation en cours…");
    const data = await imageToData(procURL, (p) => onProgress && onProgress(0.2 + p * 0.7, "Océrisation… " + Math.round(p * 100) + "%"));
    if (onProgress) onProgress(0.95, "Analyse des champs…");
    const champs = parseFacture(data.texte, data.mots, data.largeur, data.hauteur);
    if (onProgress) onProgress(1, "Terminé");
    // aperçu = image d'origine (lisible), pas la version prétraitée
    return { apercu: rawURL, champs };
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

  return { dispo, analyser, parseFacture, pdfToImage, imageToText, ocrZone };
})();
