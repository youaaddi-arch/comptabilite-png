/* =====================================================================
 * Compta PNG — Données de référence (Groupe Paris Nord)
 * Plateforme comptable type Pennylane / Yooz
 * Référentiel officiel des sociétés du groupe (SIREN/SIRET, représentant
 * légal, adresses, assujettissement TVA) fourni par le groupe.
 * ===================================================================== */
window.PNG = window.PNG || {};
PNG.VERSION = "v-datagouv-adresse";

/* Helper concis pour décrire un établissement */
function ETS(siret, adresse, type) { return { siret: siret, adresse: adresse, type: type || "ETS" }; }

/* ---------------------------------------------------------------------
 * SOCIÉTÉS DU GROUPE (40 entités juridiques)
 * id stables pour les 8 sociétés utilisées par le jeu de démo.
 * tvaAssujetti : true (OUI) / false (NON) / null (à confirmer)
 * ------------------------------------------------------------------- */
PNG.companies = [
  { id: "defis", num: "000", code: "PNG", marque: "Paris Nord Groupe",
    raisonSociale: "DENIZ FINANCES ET SERVICES (DEFIS)", formeJuridique: "—",
    representant: "Emir", siren: "849397161", siret: "84939716100035",
    tvaAssujetti: false, couleur: "#1e3a8a",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("84939716100035", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis (siège)"] },

  { id: "pnfb", num: "001", code: "AFPEC", marque: "AFPEC (ex-PNFB)",
    raisonSociale: "AFPEC", formeJuridique: "SAS",
    representant: "Keziban Denis", siren: "913471793", siret: "91347179300012",
    tvaAssujetti: true, couleur: "#ea580c", nda: "11770784477", opco: "Constructys",
    cursus: ["TP DB", "TP EB", "TP MAC", "TP APH"],
    siege: "36 rue Pascal, 77100 Meaux",
    etablissements: [ETS("91347179300012", "36 rue Pascal, 77100 Meaux", "SIEGE"),
                     ETS("91347179300012", "221 avenue du Président Wilson, 93210 Saint-Denis")],
    campuses: ["36 rue Pascal, 77100 Meaux", "221 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "cflss", num: "002", code: "CFLSS", marque: "CFLSS",
    raisonSociale: "CFLSS", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "904704863", siret: "90470486300029",
    tvaAssujetti: true, couleur: "#475569",
    siege: "12 rue de la Part-Dieu, 69003 Lyon",
    etablissements: [ETS("90470486300029", "12 rue de la Part-Dieu, 69003 Lyon", "SIEGE")],
    campuses: ["12 rue de la Part-Dieu, 69003 Lyon"] },

  { id: "dbs", num: "003", code: "DBS", marque: "Digital Business School",
    raisonSociale: "DIGITAL BUSINESS SCHOOL (DBS / CMV)", formeJuridique: "SASU",
    representant: "Deniz Finances Services", siren: "815091764", siret: "81509176400044",
    tvaAssujetti: true, couleur: "#7c3aed", nda: "11756974875", opco: "AKTO",
    cursus: ["TP CC", "TP NTC", "TP REM", "MASTER MBU"],
    siege: "24 rue de Clichy, 75009 Paris",
    etablissements: [ETS("81509176400044", "24 rue de Clichy, 75009 Paris", "SIEGE"),
                     ETS("81509176400085", "59 boulevard Vivier Merle, 69003 Lyon"),
                     ETS("81509176400077", "2 Faubourg des Postes, 59000 Lille"),
                     ETS("81509176400069", "9 bis rue Jacques Réattu, 13009 Marseille"),
                     ETS("81509176400051", "Toulouse")],
    campuses: ["24 rue de Clichy, 75009 Paris", "59 bd Vivier Merle, 69003 Lyon",
               "2 Faubourg des Postes, 59000 Lille", "9 bis rue Jacques Réattu, 13009 Marseille", "Toulouse"] },

  { id: "elfe", num: "004", code: "ELFE", marque: "ELFE",
    raisonSociale: "ELFE", formeJuridique: "—",
    representant: "Nausicaa Maloum", siren: "895365690", siret: "89536569000018",
    tvaAssujetti: true, couleur: "#0d9488",
    siege: "39 bd de la Muette, 95140 Garges-lès-Gonesse",
    etablissements: [ETS("89536569000018", "39 bd de la Muette, 95140 Garges-lès-Gonesse", "SIEGE"),
                     ETS("EN COURS", "34 cours Blaise Pascal, 91000 Évry-Courcouronnes")],
    campuses: ["39 bd de la Muette, 95140 Garges-lès-Gonesse", "34 cours Blaise Pascal, 91000 Évry-Courcouronnes"] },

  { id: "france-acces", num: "005", code: "FRANCE ACCES", marque: "France Accès",
    raisonSociale: "FRANCE ACCES", formeJuridique: "—",
    representant: "Delphine Pavis", siren: "941425464", siret: "94142546400018",
    tvaAssujetti: false, couleur: "#0891b2",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("94142546400018", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "france-diplome", num: "006", code: "FRANCE DIPLOME", marque: "France Diplôme",
    raisonSociale: "FRANCE DIPLOME", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "921854600", siret: "92185460000027",
    tvaAssujetti: false, couleur: "#0e7490",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("92185460000027", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "ma-pizza-bio", num: "007", code: "MA PIZZA BIO", marque: "Ma Pizza Bio",
    raisonSociale: "MA PIZZA BIO", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "903451631", siret: "90345163100019",
    tvaAssujetti: false, couleur: "#65a30d",
    siege: "39 rue Paul Bert, 93400 Saint-Ouen",
    etablissements: [ETS("90345163100019", "39 rue Paul Bert, 93400 Saint-Ouen", "SIEGE")],
    campuses: ["39 rue Paul Bert, 93400 Saint-Ouen"] },

  { id: "mycenes", num: "008", code: "MYCENES", marque: "Mycènes Conseil",
    raisonSociale: "MYCENES CONSEIL", formeJuridique: "—",
    representant: "Keziban Denis", siren: "899105696", siret: "89910569600038",
    tvaAssujetti: false, couleur: "#9333ea",
    siege: "16 rue de la Poterie, 93200 Saint-Denis",
    etablissements: [ETS("89910569600038", "16 rue de la Poterie, 93200 Saint-Denis", "SIEGE"),
                     ETS("89910569600020", "113 avenue du Président Wilson, 93210 Saint-Denis")],
    campuses: ["16 rue de la Poterie, 93200 Saint-Denis", "113 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "onel", num: "009", code: "ONEL", marque: "ONEL",
    raisonSociale: "ONEL (Association)", formeJuridique: "Association",
    representant: "Yann Furet", siren: "883674574", siret: "88367457400024",
    tvaAssujetti: true, couleur: "#c026d3",
    siege: "39 rue de la Gare de Reuilly, 75012 Paris",
    etablissements: [ETS("88367457400024", "39 rue de la Gare de Reuilly, 75012 Paris", "SIEGE")],
    campuses: ["39 rue de la Gare de Reuilly, 75012 Paris"] },

  { id: "pba", num: "010", code: "PBA", marque: "Paris Beauty Academy",
    raisonSociale: "PARIS BEAUTY ACADEMY", formeJuridique: "SARL",
    representant: "Gweltaz Frigout", siren: "449651694", siret: "44965169400027",
    tvaAssujetti: false, couleur: "#db2777", nda: "11921753592", opco: "OPCO Santé",
    cursus: ["CAP AP", "CAP ECP"],
    siege: "22 rue des Vénets, 92000 Nanterre",
    etablissements: [ETS("44965169400027", "22 rue des Vénets, 92000 Nanterre", "SIEGE"),
                     ETS("44965169400035", "30 bd de Douaumont, 75017 Paris")],
    campuses: ["22 rue des Vénets, 92000 Nanterre", "30 bd de Douaumont, 75017 Paris"] },

  { id: "pnbs-marseille", num: "011", code: "PNBS", marque: "PNBS Marseille",
    raisonSociale: "PNBS MARSEILLE", formeJuridique: "—",
    representant: "Cherifa Mekki", siren: "940987498", siret: "94098749800018",
    tvaAssujetti: false, couleur: "#0ea5e9",
    siege: "9 bis rue Jacques Réattu, 13009 Marseille",
    etablissements: [ETS("94098749800018", "9 bis rue Jacques Réattu, 13009 Marseille", "SIEGE")],
    campuses: ["9 bis rue Jacques Réattu, 13009 Marseille"] },

  { id: "pnbs-paris", num: "012", code: "PNBS", marque: "PNBS Susanoo",
    raisonSociale: "PNBS SUSANOO", formeJuridique: "SAS",
    representant: "Melina Cohen Setton", siren: "883135154", siret: "88313515400028",
    tvaAssujetti: true, couleur: "#2563eb", nda: "11756157375", opco: "OPCO EP",
    cursus: ["TP CC", "TP NTC", "TP REM", "MASTER MBU"],
    siege: "60 rue de la Jonquière, 75017 Paris",
    etablissements: [ETS("88313515400028", "60 rue de la Jonquière, 75017 Paris", "SIEGE"),
                     ETS("88313515400036", "16 rue de la Poterie, 93200 Saint-Denis"),
                     ETS("88313515400044", "34 cours Blaise Pascal, 91000 Évry-Courcouronnes")],
    campuses: ["60 rue de la Jonquière, 75017 Paris", "16 rue de la Poterie, 93200 Saint-Denis",
               "34 cours Blaise Pascal, 91000 Évry-Courcouronnes"] },

  { id: "pnbs-rouen", num: "013", code: "PNBS", marque: "PNBS Rouen",
    raisonSociale: "PNBS ROUEN", formeJuridique: "SASU",
    representant: "Deniz Finances Services", siren: "949377824", siret: "94937782400022",
    tvaAssujetti: null, couleur: "#38bdf8", nda: "",
    cursus: ["TP CC", "TP NTC", "TP REM", "MASTER MBU"],
    siege: "86 rue Lafayette, 76100 Rouen",
    etablissements: [ETS("94937782400022", "86 rue Lafayette, 76100 Rouen", "SIEGE"),
                     ETS("94937782400014", "113 avenue du Président Wilson, 93210 Saint-Denis"),
                     ETS("EN COURS", "13 rue Malouet, 76100 Rouen")],
    campuses: ["86 rue Lafayette, 76100 Rouen", "113 avenue du Président Wilson, 93210 Saint-Denis", "13 rue Malouet, 76100 Rouen"] },

  { id: "pnff", num: "014", code: "PNFF", marque: "Excelsior PNFF",
    raisonSociale: "EXCELSIOR PNFF", formeJuridique: "SASU",
    representant: "Hervé Zilber", siren: "982283202", siret: "98228320200017",
    tvaAssujetti: true, couleur: "#059669", nda: "11922686892", opco: "ATLAS",
    cursus: ["TP CC", "TP EPR"],
    siege: "14 rue Beffroy, 92200 Neuilly-sur-Seine",
    etablissements: [ETS("98228320200017", "14 rue Beffroy, 92200 Neuilly-sur-Seine", "SIEGE"),
                     ETS("98228320200025", "113 avenue du Président Wilson, 93210 Saint-Denis"),
                     ETS("98228320200033", "221 avenue du Président Wilson, 93210 Saint-Denis")],
    campuses: ["14 rue Beffroy, 92200 Neuilly-sur-Seine", "113 avenue du Président Wilson, 93210 Saint-Denis",
               "221 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "pnbs-atlantique", num: "015", code: "POLITICA", marque: "PNBS Atlantique",
    raisonSociale: "PNBS ATLANTIQUE (Politica)", formeJuridique: "—",
    representant: "Salah Kirane", siren: "899518880", siret: "89951888000021",
    tvaAssujetti: true, couleur: "#1d4ed8",
    siege: "17 bd de Berlin, 44000 Nantes",
    etablissements: [ETS("89951888000021", "17 bd de Berlin, 44000 Nantes", "SIEGE"),
                     ETS("89951888000039", "221 avenue du Président Wilson, 93210 Saint-Denis")],
    campuses: ["17 bd de Berlin, 44000 Nantes", "221 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "poly-franchises", num: "016", code: "POLY FRANCHISES", marque: "Poly Langues Franchises",
    raisonSociale: "POLY LANGUES FRANCHISES", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "978216695", siret: "97821669500012",
    tvaAssujetti: null, couleur: "#4338ca",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("97821669500012", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "polylangues", num: "017", code: "POLYLANGUES", marque: "Poly Langues",
    raisonSociale: "POLY LANGUES (SARL)", formeJuridique: "SARL",
    representant: "Emir (gérant)", siren: "519607808", siret: "51960780800028",
    tvaAssujetti: false, couleur: "#6366f1",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("51960780800028", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE"),
                     ETS("51960780800051", "23 bis rue Marx Dormoy, 91000 Massy"),
                     ETS("51960780800044", "3 rue Danielle Casanova, 93210 Saint-Denis"),
                     ETS("51960780800036", "47 bd de Chanzy, 93100 Montreuil")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis", "23 bis rue Marx Dormoy, 91000 Massy",
               "3 rue Danielle Casanova, 93210 Saint-Denis", "47 bd de Chanzy, 93100 Montreuil"] },

  { id: "qualifforma", num: "018", code: "QUALIFFORMA", marque: "Qualifforma",
    raisonSociale: "QUALIFFORMA", formeJuridique: "—",
    representant: "Keziban Denis", siren: "914329198", siret: "91432919800016",
    tvaAssujetti: true, couleur: "#7e22ce",
    siege: "96 rue de Paradis, 13006 Marseille",
    etablissements: [ETS("91432919800016", "96 rue de Paradis, 13006 Marseille", "SIEGE")],
    campuses: ["96 rue de Paradis, 13006 Marseille"] },

  { id: "zurich-institut", num: "019", code: "ZURICH INSTITUT", marque: "Zürich Institut",
    raisonSociale: "ZURICH INSTITUT", formeJuridique: "—",
    representant: "Emir", siren: "949601306", siret: "94960130300010",
    tvaAssujetti: null, couleur: "#a21caf",
    siege: "30 bd de Douaumont, 75017 Paris",
    etablissements: [ETS("94960130300010", "30 bd de Douaumont, 75017 Paris", "SIEGE")],
    campuses: ["30 bd de Douaumont, 75017 Paris"] },

  { id: "formalsace", num: "020", code: "FORMALSACE", marque: "Form Alsace",
    raisonSociale: "FORM ALSACE", formeJuridique: "—",
    representant: "Stéphane Hryhorowicz", siren: "879460707", siret: "87946070700018",
    tvaAssujetti: null, couleur: "#be123c",
    siege: "Bâtiment Sxb1, 16 avenue de l'Europe, 67300 Schiltigheim",
    etablissements: [ETS("87946070700018", "Bâtiment Sxb1, 16 avenue de l'Europe, 67300 Schiltigheim", "SIEGE"),
                     ETS("87946070700026", "221 avenue du Président Wilson, 93210 Saint-Denis")],
    campuses: ["Bâtiment Sxb1, 16 av de l'Europe, 67300 Schiltigheim", "221 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "ouest-formation", num: "021", code: "OUEST FORMATION", marque: "Ouest Formation",
    raisonSociale: "OUEST FORMATION", formeJuridique: "—",
    representant: "Marion Cozic", siren: "901234187", siret: "90123418700010",
    tvaAssujetti: true, couleur: "#0369a1",
    siege: "34 place de la Gare, 53000 Laval",
    etablissements: [ETS("90123418700010", "34 place de la Gare, 53000 Laval", "SIEGE"),
                     ETS("90123418700028", "221 avenue du Président Wilson, 93210 Saint-Denis")],
    campuses: ["34 place de la Gare, 53000 Laval", "221 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "edu-sync", num: "022", code: "EDU SYNC", marque: "Edu Sync",
    raisonSociale: "EDU SYNC", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "984796078", siret: "98479607800017",
    tvaAssujetti: null, couleur: "#0f766e",
    siege: "1T Chemin de la Mare aux Biches, 78650 Saulx-Marchais",
    etablissements: [ETS("98479607800017", "1T Chemin de la Mare aux Biches, 78650 Saulx-Marchais", "SIEGE")],
    campuses: ["1T Chemin de la Mare aux Biches, 78650 Saulx-Marchais"] },

  { id: "u-teach-me", num: "023", code: "U TEACH ME", marque: "U Teach Me",
    raisonSociale: "U TEACH ME", formeJuridique: "—",
    representant: "Le Quoc Linda", siren: "949370217", siret: "94937021700026",
    tvaAssujetti: null, couleur: "#15803d",
    siege: "14 route de Wintershouse, 67500 Haguenau",
    etablissements: [ETS("94937021700026", "14 route de Wintershouse, 67500 Haguenau", "SIEGE")],
    campuses: ["14 route de Wintershouse, 67500 Haguenau"] },

  { id: "care-conseil-rh", num: "024", code: "CARE CONSEIL RH", marque: "Care Conseil RH",
    raisonSociale: "CARE CONSEIL RH", formeJuridique: "—",
    representant: "Damien Renault", siren: "901888883", siret: "90188888300013",
    tvaAssujetti: null, couleur: "#b45309",
    siege: "5 rue du Tunnel, 75019 Paris",
    etablissements: [ETS("90188888300013", "5 rue du Tunnel, 75019 Paris", "SIEGE")],
    campuses: ["5 rue du Tunnel, 75019 Paris"] },

  { id: "pnbs-lille", num: "025", code: "PNBS", marque: "PNBS Lille",
    raisonSociale: "PNBS LILLE", formeJuridique: "SASU",
    representant: "Mekki-Daouadji Cherifa", siren: "988725818", siret: "98872581800013",
    tvaAssujetti: null, couleur: "#3b82f6", nda: "32591402259", opco: "OPCO EP",
    cursus: ["TP CC", "TP NTC", "TP REM", "MASTER MBU"],
    siege: "rue du Faubourg des Postes, CC Lillenium, 59000 Lille",
    etablissements: [ETS("98872581800013", "rue du Faubourg des Postes, CC Lillenium, 59000 Lille", "SIEGE")],
    campuses: ["rue du Faubourg des Postes, CC Lillenium, 59000 Lille"] },

  { id: "idc", num: "026", code: "IDC", marque: "IDC",
    raisonSociale: "IDC", formeJuridique: "—",
    representant: "Nouvelle Étoile Capital", siren: "930556808", siret: "93055680800010",
    tvaAssujetti: null, couleur: "#52525b",
    siege: "153 avenue Jean Lolive, 93500 Pantin",
    etablissements: [ETS("93055680800010", "153 avenue Jean Lolive, 93500 Pantin", "SIEGE")],
    campuses: ["153 avenue Jean Lolive, 93500 Pantin"] },

  { id: "pnbs-sud", num: "027", code: "PNBS", marque: "PNBS Lyon",
    raisonSociale: "PNBS LYON", formeJuridique: "SASU",
    representant: "Mekki-Daouadji Cherifa", siren: "989353339", siret: "98935333900017",
    tvaAssujetti: null, couleur: "#0284c7", nda: "84692555469", opco: "OPCO EP",
    cursus: ["TP CC", "TP NTC", "TP REM", "MASTER MBU"],
    siege: "59 boulevard Marius Vivier Merle, 69003 Lyon",
    etablissements: [ETS("98935333900017", "59 boulevard Marius Vivier Merle, 69003 Lyon", "SIEGE"),
                     ETS("98935333900025", "9 bis rue Jacques Réattu, 13009 Marseille")],
    campuses: ["59 boulevard Marius Vivier Merle, 69003 Lyon", "9 bis rue Jacques Réattu, 13009 Marseille"] },

  { id: "ilef", num: "028", code: "ILEF", marque: "ILEF",
    raisonSociale: "ILEF", formeJuridique: "—",
    representant: "Salah Kirane", siren: "984198259", siret: "98419825900017",
    tvaAssujetti: true, couleur: "#9f1239",
    siege: "36 rue Pascal, 77100 Meaux",
    etablissements: [ETS("98419825900017", "36 rue Pascal, 77100 Meaux", "SIEGE")],
    campuses: ["36 rue Pascal, 77100 Meaux"] },

  { id: "equipform", num: "029", code: "EQUIPFORM", marque: "Equipform",
    raisonSociale: "EQUIPFORM", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "992896415", siret: "99289641500013",
    tvaAssujetti: null, couleur: "#3f6212",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("99289641500013", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "mypersonali", num: "030", code: "MYPERSONALI", marque: "MyPersonali",
    raisonSociale: "MYPERSONALI", formeJuridique: "—",
    representant: "Le Guilly Ambre", siren: "888643459", siret: "88864345900017",
    tvaAssujetti: null, couleur: "#a16207",
    siege: "7 allée des Berges, 77400 Lagny-sur-Marne",
    etablissements: [ETS("88864345900017", "7 allée des Berges, 77400 Lagny-sur-Marne", "SIEGE")],
    campuses: ["7 allée des Berges, 77400 Lagny-sur-Marne"] },

  { id: "orcea", num: "031", code: "ORCEA", marque: "ORCEA",
    raisonSociale: "ORCEA", formeJuridique: "—",
    representant: "Rochelle Catherine", siren: "452361330", siret: "45236133000031",
    tvaAssujetti: null, couleur: "#64748b",
    siege: "1 boulevard Baraban, 80000 Amiens",
    etablissements: [ETS("45236133000031", "1 boulevard Baraban, 80000 Amiens", "SIEGE")],
    campuses: ["1 boulevard Baraban, 80000 Amiens"] },

  { id: "pna", num: "032", code: "PNA", marque: "Paris Nord Alternance",
    raisonSociale: "PARIS NORD ALTERNANCE (PNA)", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "100541861", siret: "10054186100017",
    tvaAssujetti: null, couleur: "#1e40af",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("10054186100017", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "pnls", num: "033", code: "PNLS", marque: "Paris Nord Langues et Services",
    raisonSociale: "PARIS NORD LANGUES ET SERVICES (PNLS)", formeJuridique: "—",
    representant: "Deniz Finances Services", siren: "100504661", siret: "10050466100016",
    tvaAssujetti: null, couleur: "#4f46e5",
    siege: "113 avenue du Président Wilson, 93210 Saint-Denis",
    etablissements: [ETS("10050466100016", "113 avenue du Président Wilson, 93210 Saint-Denis", "SIEGE")],
    campuses: ["113 avenue du Président Wilson, 93210 Saint-Denis"] },

  { id: "aimenglish", num: "034", code: "AIMENGLISH", marque: "AimEnglish",
    raisonSociale: "AIMENGLISH", formeJuridique: "—",
    representant: "Rodolphe", siren: "848141966", siret: "84814196600020",
    tvaAssujetti: null, couleur: "#0e7490",
    siege: "3 rue de Genève, 69006 Lyon",
    etablissements: [ETS("84814196600020", "3 rue de Genève, 69006 Lyon", "ETS")],
    campuses: ["3 rue de Genève, 69006 Lyon"] },

  { id: "chiffractif", num: "035", code: "CHIFFR'ACTIF", marque: "Chiffr'Actif",
    raisonSociale: "CHIFFR'ACTIF", formeJuridique: "—",
    representant: "Gür Mervé", siren: "993750298", siret: "99375029800016",
    tvaAssujetti: null, couleur: "#166534",
    siege: "156 rue des Déportés Internes de la Résistance, 45200 Montargis",
    etablissements: [ETS("99375029800016", "156 rue des Déportés Internes de la Résistance, 45200 Montargis", "SIEGE")],
    campuses: ["156 rue des Déportés Internes de la Résistance, 45200 Montargis"] },

  { id: "pnbs-toulouse", num: "036", code: "PNBS", marque: "PNBS Toulouse",
    raisonSociale: "PNBS TOULOUSE", formeJuridique: "—",
    representant: "—", siren: "", siret: "", tvaAssujetti: null, couleur: "#60a5fa",
    siege: "", etablissements: [], campuses: [] },

  { id: "pnbs-montpellier", num: "037", code: "PNBS", marque: "PNBS Montpellier",
    raisonSociale: "PNBS MONTPELLIER", formeJuridique: "—",
    representant: "—", siren: "", siret: "EN COURS", tvaAssujetti: null, couleur: "#93c5fd",
    siege: "", etablissements: [], campuses: [] },

  { id: "activ-permis", num: "038", code: "ACTIV PERMIS", marque: "Activ Permis",
    raisonSociale: "ACTIV PERMIS", formeJuridique: "—",
    representant: "—", siren: "", siret: "", tvaAssujetti: null, couleur: "#f59e0b",
    siege: "", etablissements: [], campuses: [] },

  { id: "bodi-formation", num: "039", code: "BODI FORMATION", marque: "Bodi Formation",
    raisonSociale: "BODI FORMATION", formeJuridique: "—",
    representant: "—", siren: "", siret: "", tvaAssujetti: null, couleur: "#84cc16",
    siege: "", etablissements: [], campuses: [] },
];

/* ---------------------------------------------------------------------
 * PLAN COMPTABLE (PCG France — comptes utiles à un organisme de formation)
 * ------------------------------------------------------------------- */
PNG.planComptable = [
  { num: "401000", libelle: "Fournisseurs", type: "Passif" },
  { num: "411000", libelle: "Clients", type: "Actif" },
  { num: "512000", libelle: "Banque", type: "Actif" },
  { num: "530000", libelle: "Caisse", type: "Actif" },
  { num: "606300", libelle: "Fournitures d'entretien et petit équipement", type: "Charge" },
  { num: "606400", libelle: "Fournitures administratives", type: "Charge" },
  { num: "606800", libelle: "Autres matières et fournitures", type: "Charge" },
  { num: "613200", libelle: "Locations immobilières (loyers campus)", type: "Charge" },
  { num: "615000", libelle: "Entretien et réparations", type: "Charge" },
  { num: "616000", libelle: "Primes d'assurance", type: "Charge" },
  { num: "618000", libelle: "Documentation / abonnements", type: "Charge" },
  { num: "622600", libelle: "Honoraires (comptable, avocat)", type: "Charge" },
  { num: "623100", libelle: "Annonces et insertions (publicité)", type: "Charge" },
  { num: "625100", libelle: "Voyages et déplacements", type: "Charge" },
  { num: "626100", libelle: "Frais de télécommunications", type: "Charge" },
  { num: "626200", libelle: "Internet / hébergement", type: "Charge" },
  { num: "628000", libelle: "Logiciels & services en ligne (SaaS)", type: "Charge" },
  { num: "641000", libelle: "Rémunérations du personnel (formateurs)", type: "Charge" },
  { num: "706000", libelle: "Prestations de formation (ventes)", type: "Produit" },
  { num: "708000", libelle: "Produits des activités annexes", type: "Produit" },
  { num: "445660", libelle: "TVA déductible sur autres biens et services", type: "Actif" },
  { num: "445620", libelle: "TVA déductible sur immobilisations", type: "Actif" },
  { num: "445710", libelle: "TVA collectée", type: "Passif" },
  { num: "445510", libelle: "TVA à décaisser", type: "Passif" },
];

/* ---------------------------------------------------------------------
 * FOURNISSEURS connus + règle d'affectation automatique (mémoire compta)
 * ------------------------------------------------------------------- */
PNG.fournisseurs = [
  { nom: "Orange Business", categorie: "Télécom", compteCharge: "626100", tauxTva: 20 },
  { nom: "SFR Business", categorie: "Télécom", compteCharge: "626100", tauxTva: 20 },
  { nom: "EDF Entreprises", categorie: "Énergie", compteCharge: "606800", tauxTva: 20 },
  { nom: "Engie", categorie: "Énergie", compteCharge: "606800", tauxTva: 20 },
  { nom: "OVHcloud", categorie: "Hébergement", compteCharge: "626200", tauxTva: 20 },
  { nom: "Google Workspace", categorie: "SaaS", compteCharge: "628000", tauxTva: 20 },
  { nom: "Microsoft France", categorie: "SaaS", compteCharge: "628000", tauxTva: 20 },
  { nom: "Canva Pty", categorie: "SaaS", compteCharge: "628000", tauxTva: 20 },
  { nom: "OpenAI LLC", categorie: "SaaS", compteCharge: "628000", tauxTva: 20 },
  { nom: "LinkedIn Ireland", categorie: "Publicité / Recrutement", compteCharge: "623100", tauxTva: 20 },
  { nom: "Meta Platforms Ireland", categorie: "Publicité", compteCharge: "623100", tauxTva: 20 },
  { nom: "Google Ads", categorie: "Publicité", compteCharge: "623100", tauxTva: 20 },
  { nom: "Manutan", categorie: "Fournitures", compteCharge: "606400", tauxTva: 20 },
  { nom: "Bureau Vallée", categorie: "Fournitures", compteCharge: "606400", tauxTva: 20 },
  { nom: "Amazon Business", categorie: "Fournitures", compteCharge: "606400", tauxTva: 20 },
  { nom: "SCI Foncière Poterie", categorie: "Loyer", compteCharge: "613200", tauxTva: 0 },
  { nom: "SCI Lillenium Invest", categorie: "Loyer", compteCharge: "613200", tauxTva: 0 },
  { nom: "AXA Entreprises", categorie: "Assurance", compteCharge: "616000", tauxTva: 0 },
  { nom: "Cabinet Expertise & Co", categorie: "Honoraires", compteCharge: "622600", tauxTva: 20 },
  { nom: "Veolia Propreté", categorie: "Entretien", compteCharge: "615000", tauxTva: 10 },
];

/* ---------------------------------------------------------------------
 * FINANCEURS (côté ERP / encaissements ventes)
 * ------------------------------------------------------------------- */
PNG.financeurs = [
  { code: "CPF", libelle: "CPF — Caisse des Dépôts (Mon Compte Formation)", couleur: "#2563eb" },
  { code: "OPCO", libelle: "OPCO (prise en charge entreprise)", couleur: "#7c3aed" },
  { code: "FT", libelle: "France Travail — POEI / AIF", couleur: "#059669" },
  { code: "REGION", libelle: "Conseil Régional", couleur: "#ea580c" },
  { code: "ENTREPRISE", libelle: "Financement direct entreprise", couleur: "#db2777" },
  { code: "PERSO", libelle: "Financement personnel", couleur: "#64748b" },
];

PNG.opcoList = ["OPCO EP", "AKTO", "ATLAS", "Constructys", "OPCO Santé", "OPCO 2i", "Uniformation"];

/* ---------------------------------------------------------------------
 * ADRESSE DE COLLECTE PAR EMAIL (comme Pennylane / Yooz)
 * Chaque société dispose d'une adresse dédiée : toute facture transférée
 * (en pièce jointe) y est capturée puis océrisée automatiquement.
 * ⚠️ Format PROPOSÉ pour la démo — à activer sur votre domaine / votre
 * fournisseur (Pennylane, Yooz…). Ces boîtes ne reçoivent pas de mail tant
 * qu'elles ne sont pas configurées côté serveur de messagerie.
 * ------------------------------------------------------------------- */
PNG.emailCapture = (companyId) => `factures+${companyId}@parisnordgroupe.fr`;

/* ---------------------------------------------------------------------
 * MODES DE PAIEMENT (saisis par le salarié, vérifiés ensuite en banque)
 * ------------------------------------------------------------------- */
PNG.modesPaiement = [
  { code: "virement",    libelle: "Virement",            icon: "🏦", bankRegex: /VIR|VIREMENT/i },
  { code: "prelevement", libelle: "Prélèvement",         icon: "🔁", bankRegex: /PRLV|PRELEVEMENT|PRÉLÈVEMENT/i },
  { code: "cb",          libelle: "Carte bancaire",      icon: "💳", bankRegex: /CB |CARTE|PAIEMENT CB/i },
  { code: "cheque",      libelle: "Chèque",              icon: "🧾", bankRegex: /CHQ|CHEQUE|CHÈQUE/i },
  { code: "especes",     libelle: "Espèces",             icon: "💶", bankRegex: /ESPECES|ESPÈCES|CAISSE/i },
];

/* ---------------------------------------------------------------------
 * API ENTREPRISE — data.gouv (gratuite, sans clé)
 * Recherche d'entreprises : nom -> SIREN/SIRET/NAF/adresse.
 * Doc : https://recherche-entreprises.api.gouv.fr
 * ------------------------------------------------------------------- */
PNG.dataGouv = {
  base: "https://recherche-entreprises.api.gouv.fr/search",
  // construit l'URL de recherche
  url: (q) => `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=1`,
  urlMulti: (q, n) => `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=${n || 6}`,
};

/* ---------------------------------------------------------------------
 * ARCHIVAGE DRIVE — chemin/lien généré par société et fournisseur.
 * ⚠️ Lien simulé pour la démo : l'archivage réel nécessite de connecter
 * un Google Drive (OAuth) ou un coffre-fort (à brancher).
 * ------------------------------------------------------------------- */
PNG.drive = {
  base: "https://drive.google.com/drive/u/0/folders/PNG-FACTURES",
  path: (societeId, fournisseur, fichier) =>
    `https://drive.google.com/drive/u/0/folders/PNG-FACTURES/${societeId}/${(fournisseur||"divers").replace(/[^A-Za-z0-9]+/g, "-")}/${encodeURIComponent(fichier||"facture.pdf")}`,
};

/* ---------------------------------------------------------------------
 * MATRICE DE FONCTIONNALITÉS — référence factuelle Pennylane / Yooz
 * statut : "fait" (implémenté dans le prototype, données simulées),
 *          "partiel", "abrancher" (architecture prête, intégration à venir)
 * ------------------------------------------------------------------- */
PNG.featureMatrix = [
  { cat: "Collecte des factures", items: [
    { f: "Email de collecte dédié par société", penny: true, yooz: true, statut: "fait" },
    { f: "Upload / glisser-déposer de fichiers", penny: true, yooz: true, statut: "fait" },
    { f: "Scan mobile (photo de facture)", penny: true, yooz: true, statut: "abrancher" },
    { f: "Connecteurs Drive / Dropbox", penny: true, yooz: true, statut: "abrancher" },
    { f: "Factur-X / e-invoicing (réforme 2026)", penny: true, yooz: true, statut: "abrancher" },
  ]},
  { cat: "Reconnaissance & pré-saisie (OCR / IA)", items: [
    { f: "Extraction OCR des données de facture", penny: true, yooz: true, statut: "fait" },
    { f: "Reconnaissance du fournisseur", penny: true, yooz: true, statut: "fait" },
    { f: "Reconnaissance de la société destinataire", penny: true, yooz: true, statut: "fait" },
    { f: "Détection des doublons", penny: true, yooz: true, statut: "fait" },
    { f: "Pré-comptabilisation (compte + TVA)", penny: true, yooz: true, statut: "fait" },
    { f: "Ventilation analytique (par campus)", penny: true, yooz: true, statut: "partiel" },
  ]},
  { cat: "Workflow & paiement fournisseur", items: [
    { f: "Circuit de validation / approbation", penny: true, yooz: true, statut: "partiel" },
    { f: "Échéancier fournisseur (à payer)", penny: true, yooz: true, statut: "fait" },
    { f: "Rapprochement bon de commande (3 voies)", penny: false, yooz: true, statut: "abrancher" },
    { f: "Paiement fournisseur (virement SEPA)", penny: true, yooz: true, statut: "abrancher" },
  ]},
  { cat: "Banque & trésorerie", items: [
    { f: "Synchronisation bancaire (agrégation)", penny: true, yooz: false, statut: "abrancher" },
    { f: "Rapprochement bancaire automatique", penny: true, yooz: false, statut: "fait" },
    { f: "Lettrage des écritures", penny: true, yooz: false, statut: "fait" },
    { f: "Trésorerie temps réel", penny: true, yooz: false, statut: "fait" },
    { f: "Trésorerie prévisionnelle", penny: true, yooz: false, statut: "abrancher" },
  ]},
  { cat: "Ventes & encaissements", items: [
    { f: "Dossiers de financement (OPCO/CPF/FT)", penny: false, yooz: false, statut: "fait" },
    { f: "Facturation clients / devis", penny: true, yooz: false, statut: "partiel" },
    { f: "Relances clients", penny: true, yooz: false, statut: "abrancher" },
  ]},
  { cat: "Comptabilité & fiscal", items: [
    { f: "Écriture comptable en brouillon", penny: true, yooz: true, statut: "fait" },
    { f: "Déclaration de TVA (calcul CA3)", penny: true, yooz: false, statut: "fait" },
    { f: "Export FEC / journaux comptables", penny: true, yooz: true, statut: "abrancher" },
    { f: "Archivage à valeur probante (coffre-fort)", penny: true, yooz: true, statut: "abrancher" },
    { f: "Piste d'audit (historique)", penny: true, yooz: true, statut: "partiel" },
  ]},
  { cat: "Multi-sociétés & pilotage", items: [
    { f: "Gestion multi-sociétés (40 entités)", penny: true, yooz: true, statut: "fait" },
    { f: "Tableau de bord & KPI", penny: true, yooz: true, statut: "fait" },
    { f: "Collaboration avec l'expert-comptable", penny: true, yooz: false, statut: "abrancher" },
  ]},
];
