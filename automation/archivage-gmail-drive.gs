/**
 * ============================================================================
 *  Compta PNG — Archivage AUTOMATIQUE 24h/24 des factures Gmail vers Drive
 * ----------------------------------------------------------------------------
 *  Tourne chez Google (script.google.com), meme ordinateur/logiciel fermes.
 *  Toutes les X minutes : lit la boite de collecte, identifie via l'IA Gemini
 *  la societe destinataire (parmi vos 40 entites) + le fournisseur, puis range
 *  CHAQUE piece jointe dans le Drive partage :
 *        Racine > Societe > Annee (exercice) > Fournisseur > facture
 *  Les emails traites recoivent un libelle pour ne jamais etre retraites.
 *
 *  AUCUN mot de passe. L'autorisation se fait par votre compte Google.
 *  Installation : voir README.md fourni a cote de ce script.
 * ============================================================================
 */

/* ============================ A CONFIGURER ================================ */
var CONFIG = {
  // Cle API Gemini (la meme que dans le logiciel — https://aistudio.google.com/apikey)
  GEMINI_KEY: "COLLEZ_VOTRE_CLE_GEMINI_ICI",

  // Drive partage du Groupe (extrait de votre lien). Laissez tel quel si c'est le bon.
  DRIVE_ID: "0ACMCgnt8fT87Uk9PVA",

  // Dossier racine (cree dans le Drive partage) sous lequel tout est range.
  RACINE: "Factures",

  // Quels emails traiter (syntaxe Gmail). On exclut ceux deja archives.
  GMAIL_QUERY: "has:attachment newer_than:30d",

  // Libelle pose sur les emails traites (cree automatiquement).
  LABEL: "PNG-Archive",

  // Nombre de fils de discussion lus par execution (50 = large).
  MAX_THREADS: 50
};

/* ===================== VOS SOCIETES (destinataires) ====================== */
var SOCIETES = [
  {"id":"defis","code":"PNG","nom":"DENIZ FINANCES ET SERVICES (DEFIS)","siren":"849397161"},
  {"id":"pnfb","code":"AFPEC","nom":"AFPEC","siren":"913471793"},
  {"id":"cflss","code":"CFLSS","nom":"CFLSS","siren":"904704863"},
  {"id":"dbs","code":"DBS","nom":"DIGITAL BUSINESS SCHOOL (DBS / CMV)","siren":"815091764"},
  {"id":"elfe","code":"ELFE","nom":"ELFE","siren":"895365690"},
  {"id":"france-acces","code":"FRANCE ACCES","nom":"FRANCE ACCES","siren":"941425464"},
  {"id":"france-diplome","code":"FRANCE DIPLOME","nom":"FRANCE DIPLOME","siren":"921854600"},
  {"id":"ma-pizza-bio","code":"MA PIZZA BIO","nom":"MA PIZZA BIO","siren":"903451631"},
  {"id":"mycenes","code":"MYCENES","nom":"MYCENES CONSEIL","siren":"899105696"},
  {"id":"onel","code":"ONEL","nom":"ONEL (Association)","siren":"883674574"},
  {"id":"pba","code":"PBA","nom":"PARIS BEAUTY ACADEMY","siren":"449651694"},
  {"id":"pnbs-marseille","code":"PNBS","nom":"PNBS MARSEILLE","siren":"940987498"},
  {"id":"pnbs-paris","code":"PNBS","nom":"PNBS SUSANOO","siren":"883135154"},
  {"id":"pnbs-rouen","code":"PNBS","nom":"PNBS ROUEN","siren":"949377824"},
  {"id":"pnff","code":"PNFF","nom":"EXCELSIOR PNFF","siren":"982283202"},
  {"id":"pnbs-atlantique","code":"POLITICA","nom":"PNBS ATLANTIQUE (Politica)","siren":"899518880"},
  {"id":"poly-franchises","code":"POLY FRANCHISES","nom":"POLY LANGUES FRANCHISES","siren":"978216695"},
  {"id":"polylangues","code":"POLYLANGUES","nom":"POLY LANGUES (SARL)","siren":"519607808"},
  {"id":"qualifforma","code":"QUALIFFORMA","nom":"QUALIFFORMA","siren":"914329198"},
  {"id":"zurich-institut","code":"ZURICH INSTITUT","nom":"ZURICH INSTITUT","siren":"949601306"},
  {"id":"formalsace","code":"FORMALSACE","nom":"FORM ALSACE","siren":"879460707"},
  {"id":"ouest-formation","code":"OUEST FORMATION","nom":"OUEST FORMATION","siren":"901234187"},
  {"id":"edu-sync","code":"EDU SYNC","nom":"EDU SYNC","siren":"984796078"},
  {"id":"u-teach-me","code":"U TEACH ME","nom":"U TEACH ME","siren":"949370217"},
  {"id":"care-conseil-rh","code":"CARE CONSEIL RH","nom":"CARE CONSEIL RH","siren":"901888883"},
  {"id":"pnbs-lille","code":"PNBS","nom":"PNBS LILLE","siren":"988725818"},
  {"id":"idc","code":"IDC","nom":"IDC","siren":"930556808"},
  {"id":"pnbs-sud","code":"PNBS","nom":"PNBS LYON","siren":"989353339"},
  {"id":"ilef","code":"ILEF","nom":"ILEF","siren":"984198259"},
  {"id":"equipform","code":"EQUIPFORM","nom":"EQUIPFORM","siren":"992896415"},
  {"id":"mypersonali","code":"MYPERSONALI","nom":"MYPERSONALI","siren":"888643459"},
  {"id":"orcea","code":"ORCEA","nom":"ORCEA","siren":"452361330"},
  {"id":"pna","code":"PNA","nom":"PARIS NORD ALTERNANCE (PNA)","siren":"100541861"},
  {"id":"pnls","code":"PNLS","nom":"PARIS NORD LANGUES ET SERVICES (PNLS)","siren":"100504661"},
  {"id":"aimenglish","code":"AIMENGLISH","nom":"AIMENGLISH","siren":"848141966"},
  {"id":"chiffractif","code":"CHIFFR'ACTIF","nom":"CHIFFR'ACTIF","siren":"993750298"},
  {"id":"pnbs-toulouse","code":"PNBS","nom":"PNBS TOULOUSE","siren":""},
  {"id":"pnbs-montpellier","code":"PNBS","nom":"PNBS MONTPELLIER","siren":""},
  {"id":"activ-permis","code":"ACTIV PERMIS","nom":"ACTIV PERMIS","siren":""},
  {"id":"bodi-formation","code":"BODI FORMATION","nom":"BODI FORMATION","siren":""}
];

/* ============================================================================
 *  FONCTION PRINCIPALE — c'est elle que le declencheur appelle.
 * ========================================================================== */
function archiverFactures() {
  if (!CONFIG.GEMINI_KEY || CONFIG.GEMINI_KEY.indexOf("COLLEZ") === 0) {
    throw new Error("Renseignez d'abord CONFIG.GEMINI_KEY en haut du script.");
  }
  var label = GmailApp.getUserLabelByName(CONFIG.LABEL) || GmailApp.createLabel(CONFIG.LABEL);
  var query = CONFIG.GMAIL_QUERY + " -label:" + CONFIG.LABEL;
  var threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS);
  Logger.log(threads.length + " fil(s) a examiner.");

  var nbFichiers = 0;
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    for (var m = 0; m < messages.length; m++) {
      var pjs = messages[m].getAttachments({ includeInlineImages: false, includeAttachments: true });
      for (var p = 0; p < pjs.length; p++) {
        var blob = pjs[p];
        var nom = blob.getName();
        var type = (blob.getContentType() || "").toLowerCase();
        var estPDF = type.indexOf("pdf") >= 0 || /\.pdf$/i.test(nom);
        var estImg = type.indexOf("image/") === 0 || /\.(png|jpe?g|tiff?|webp|heic)$/i.test(nom);
        if (!estPDF && !estImg) continue;
        if (estImg && blob.getBytes().length < 15000) continue; // ignore logos de signature
        try {
          var infos = analyserAvecGemini(blob, type, estPDF);
          var soc = trouverSociete(infos.destinataireId);
          var societeNom = soc ? (soc.code + " - " + soc.nom) : "_A_TRIER";
          var annee = (infos.dateFacture && /^\d{4}/.test(infos.dateFacture))
            ? infos.dateFacture.substring(0, 4) : ((new Date()).getFullYear() + "");
          var fournisseur = nettoyer(infos.fournisseur) || "_Fournisseur_inconnu";

          var dossier = assurerChemin(nettoyer(societeNom), annee, fournisseur);
          televerser(blob, dossier);
          nbFichiers++;
          Logger.log("OK  " + societeNom + " > " + annee + " > " + fournisseur + " > " + nom);
        } catch (e) {
          Logger.log("ERR " + nom + " : " + e.message);
        }
      }
    }
    thread.addLabel(label); // marque comme traite
  }
  Logger.log("Termine : " + nbFichiers + " fichier(s) archive(s).");
}

/* ===================== IA Gemini : lit la facture ======================== */
function analyserAvecGemini(blob, mimeType, estPDF) {
  var liste = SOCIETES.map(function (c) { return { id: c.id, nom: c.nom, siren: c.siren }; });
  var prompt =
    "Tu es expert-comptable. Analyse cette facture (image/PDF). Renvoie UNIQUEMENT un JSON " +
    '{"fournisseur":"","destinataireId":"","dateFacture":"AAAA-MM-JJ"}. ' +
    "fournisseur = la societe qui EMET la facture (en-tete / pied de page). " +
    "destinataireId = l'id de NOTRE societe CLIENT (destinataire) parmi cette liste, sinon vide : " +
    JSON.stringify(liste) + ". " +
    "dateFacture = date de la facture au format AAAA-MM-JJ.";

  var data = Utilities.base64Encode(blob.getBytes());
  var body = {
    contents: [{ parts: [
      { inline_data: { mime_type: estPDF ? "application/pdf" : mimeType, data: data } },
      { text: prompt }
    ] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" }
  };
  var modeles = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
  var derniereErreur = "";
  for (var k = 0; k < modeles.length; k++) {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modeles[k] +
              ":generateContent?key=" + encodeURIComponent(CONFIG.GEMINI_KEY);
    var resp = UrlFetchApp.fetch(url, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 200) {
      var j = JSON.parse(resp.getContentText());
      var txt = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
                j.candidates[0].content.parts[0].text;
      var obj = JSON.parse(txt);
      return {
        fournisseur: obj.fournisseur || "",
        destinataireId: obj.destinataireId || "",
        dateFacture: obj.dateFacture || ""
      };
    }
    derniereErreur = "Gemini HTTP " + code + " (" + modeles[k] + ")";
    if (code !== 429 && code !== 503) break;
    Utilities.sleep(2000);
  }
  throw new Error(derniereErreur || "Gemini indisponible");
}

function trouverSociete(id) {
  if (!id) return null;
  for (var i = 0; i < SOCIETES.length; i++) if (SOCIETES[i].id === id) return SOCIETES[i];
  return null;
}
function nettoyer(s) {
  return String(s || "").replace(/[\/\\]+/g, "-").replace(/\s{2,}/g, " ").trim().substring(0, 120);
}

/* ===================== Drive (compatible Drive partage) ================== */
function driveHeaders() { return { Authorization: "Bearer " + ScriptApp.getOAuthToken() }; }

function trouverDossier(nom, parentId) {
  var q = 'mimeType="application/vnd.google-apps.folder" and trashed=false and name="' +
          nom.replace(/"/g, '\\"') + '" and "' + parentId + '" in parents';
  var url = "https://www.googleapis.com/drive/v3/files?fields=files(id,name)" +
            "&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=" +
            encodeURIComponent(CONFIG.DRIVE_ID) + "&q=" + encodeURIComponent(q);
  var r = UrlFetchApp.fetch(url, { headers: driveHeaders(), muteHttpExceptions: true });
  var j = JSON.parse(r.getContentText());
  return (j.files && j.files[0]) ? j.files[0].id : null;
}
function creerDossier(nom, parentId) {
  var r = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id", {
    method: "post", contentType: "application/json", headers: driveHeaders(),
    payload: JSON.stringify({ name: nom, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText()).id;
}
var _cache = {};
function assurerDossier(nom, parentId) {
  var cle = parentId + "/" + nom;
  if (_cache[cle]) return _cache[cle];
  var id = trouverDossier(nom, parentId) || creerDossier(nom, parentId);
  _cache[cle] = id;
  return id;
}
function assurerChemin(societeNom, annee, fournisseur) {
  var racine = assurerDossier(CONFIG.RACINE, CONFIG.DRIVE_ID);
  var s = assurerDossier(societeNom, racine);
  var a = assurerDossier(annee, s);
  return assurerDossier(fournisseur, a);
}
function televerser(blob, folderId) {
  var meta = { name: blob.getName(), parents: [folderId] };
  var boundary = "compta_png_" + Date.now();
  var data = blob.getBytes();
  var pre = Utilities.newBlob(
    "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(meta) + "\r\n--" + boundary + "\r\nContent-Type: " +
    blob.getContentType() + "\r\n\r\n").getBytes();
  var post = Utilities.newBlob("\r\n--" + boundary + "--").getBytes();
  var payload = pre.concat(data).concat(post);
  var r = UrlFetchApp.fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    { method: "post", contentType: "multipart/related; boundary=" + boundary,
      payload: payload, headers: driveHeaders(), muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) throw new Error("Drive upload HTTP " + r.getResponseCode() + " " + r.getContentText());
  return JSON.parse(r.getContentText()).id;
}

/* ===================== Installer le declencheur (1 min) ================== */
function installerDeclencheur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "archiverFactures") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("archiverFactures").timeBased().everyMinutes(1).create();
  Logger.log("Declencheur installe : archiverFactures toutes les 1 minute.");
}
