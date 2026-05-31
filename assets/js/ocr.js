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

  /* Rend la 1re page d'un PDF dans un canvas -> dataURL image */
  async function pdfToImage(file) {
    setupPdf();
    if (!window.pdfjsLib) throw new Error("PDF.js indisponible");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
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

  /* OCR d'une image (dataURL) -> texte brut. onProgress(0..1) optionnel */
  async function imageToText(dataURL, onProgress) {
    if (!window.Tesseract) throw new Error("Tesseract indisponible");
    const res = await window.Tesseract.recognize(dataURL, "fra+eng", {
      logger: (m) => { if (m.status === "recognizing text" && onProgress) onProgress(m.progress); },
    });
    return res.data.text || "";
  }

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

  function parseFacture(texte) {
    const t = texte.replace(/\u00A0/g, " ");
    const upper = t.toUpperCase();

    // Fournisseur : 1re ligne "significative" du document (en-tête)
    let fournisseur = "";
    const lignes = t.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 2);
    for (const l of lignes) {
      if (/facture|invoice|devis|n[°o]\b|siret|siren|tva|date|client|adresse/i.test(l)) continue;
      if (/^[\d\s.,€%-]+$/.test(l)) continue;
      if (!/[A-Za-zÀ-ÿ]{2}/.test(l)) continue;
      fournisseur = reparerEspaces(l).slice(0, 60); break;
    }

    // N° de facture — après "N°" (avec ou sans "facture") c'est presque
    // toujours le numéro. On essaie du plus précis au plus général.
    let numeroFacture = "";
    const VAL = "([A-Za-z0-9][A-Za-z0-9\\-\\/\\._]{1,})";
    const numPatterns = [
      new RegExp("n[°o]\\s*(?:de\\s*)?facture\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("num[ée]ro\\s*(?:de\\s*)?facture\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("facture\\s*(?:n[°o]|num[ée]ro)?\\s*[:#]?\\s*" + VAL, "i"),
      new RegExp("invoice\\s*(?:n[°o]|number|#|:)?\\s*[:#]?\\s*" + VAL, "i"),
      // "N°" seul suivi d'une valeur (cas le plus fréquent)
      new RegExp("\\bn[°o]\\s*[:#]?\\s*" + VAL, "i"),
    ];
    const stop = /^(date|tva|ttc|ht|du|le|la|de|et|siret|siren)$/i;
    for (const re of numPatterns) {
      const m = t.match(re);
      if (m && m[1] && !stop.test(m[1]) && /\d/.test(m[1])) { numeroFacture = m[1].replace(/[.\s,;]+$/, ""); break; }
    }

    // SIREN/SIRET : priorité au SIRET (14) ; SIREN explicite ou dérivé du SIRET
    const compact = upper.replace(/[ .]/g, "");
    const siretM = compact.match(/(?:SIRET[:\s]*)?(\d{14})/);
    let sirenVal = "";
    const sirenLabel = compact.match(/SIREN[:\s]*(\d{9})/);
    if (sirenLabel) sirenVal = sirenLabel[1];
    else if (siretM) sirenVal = siretM[1].slice(0, 9);
    const sirenM = sirenVal ? [null, sirenVal] : null;

    // Montants (TVA en € : on exige des décimales pour éviter de capter le taux)
    let ttc = montantApresMot(t, "total\\s*ttc|net\\s*[àa]\\s*payer|montant\\s*ttc|total\\s*t\\.?t\\.?c");
    let ht = montantApresMot(t, "total\\s*ht|montant\\s*ht|total\\s*h\\.?t");
    let tva = montantApresMot(t, "t\\.?v\\.?a\\.?|montant\\s*tva", true);
    // Taux de TVA
    const tauxM = t.match(/(\d{1,2}(?:[.,]\d)?)\s*%/);
    let taux = tauxM ? parseMontant(tauxM[1]) : 20;

    // Déductions si valeurs manquantes
    const montants = tousMontants(t).sort((a, b) => a - b);
    if (ttc == null && montants.length) ttc = montants[montants.length - 1];
    if (ht == null && ttc != null) ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
    if (tva == null && ht != null && ttc != null) tva = Math.round((ttc - ht) * 100) / 100;
    if (ht != null && taux) {
      const tvaCalc = Math.round((ht * taux / 100) * 100) / 100;
      if (tva == null) tva = tvaCalc;
    }

    const dates = findDates(t);

    return {
      fournisseur, numeroFacture,
      siret: siretM ? siretM[1] : "",
      siren: sirenM ? sirenM[1] : "",
      dateFacture: dates[0] || null,
      montantHT: ht, montantTVA: tva, montantTTC: ttc, tauxTva: taux,
      texteBrut: t.slice(0, 4000),
    };
  }

  /* Pipeline complet : fichier -> aperçu + texte + champs extraits */
  async function analyser(file, onProgress) {
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    if (onProgress) onProgress(0.05, isPdf ? "Lecture du PDF…" : "Lecture de l'image…");
    const imgURL = isPdf ? await pdfToImage(file) : await fileToDataURL(file);
    if (onProgress) onProgress(0.2, "Océrisation en cours…");
    const texte = await imageToText(imgURL, (p) => onProgress && onProgress(0.2 + p * 0.7, "Océrisation… " + Math.round(p * 100) + "%"));
    if (onProgress) onProgress(0.95, "Analyse des champs…");
    const champs = parseFacture(texte);
    if (onProgress) onProgress(1, "Terminé");
    return { apercu: imgURL, champs };
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
