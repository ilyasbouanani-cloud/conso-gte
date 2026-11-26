/* Calculs — reprennent les formules du classeur « GTE » (Finance_perso.xlsx).
   Fonctions pures, sans arrondi : l'arrondi n'est fait qu'à l'affichage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Valeurs par défaut = valeurs du classeur */
  var DEFAULTS = {
    autonomieKm: 31,        // B2 (orange) : km pour un plein…
    capaciteKwh: 7,         // C2 (orange) : …de 7 kWh
    prixKwhMaison: 0.44,    // F2 (bleu)
    puissanceKw: 3.7,       // E6 (orange)
    prixMinute: 0.04,       // C6 (bleu)
    kwhARecharger: 7,       // D6 (bleu)
    carburants: {
      sp98:   { nom: 'SP98',   prixL: 1.99, l100: 6.1 }, // L2, M2
      diesel: { nom: 'Diesel', prixL: 2.10, l100: 5.3 }  // L3, M3
    }
  };

  function ok(x) { return typeof x === 'number' && isFinite(x); }
  function pos(x) { return ok(x) && x > 0; }
  function div(a, b) { return pos(b) && ok(a) ? a / b : null; }

  /* Recharge à la maison — E2, G2, H2 */
  function maison(e, s) {
    var kwh = e.kwh, prix = e.prixKwh;
    if (!ok(kwh) || !ok(prix)) return null;
    var km = ok(kwh) && pos(s.capaciteKwh) ? kwh * s.autonomieKm / s.capaciteKwh : null; // E2 = D2*B2/C2
    var cout = prix * kwh;                                                               // G2 = F2*D2
    return { kwh: kwh, km: km, prixKwh: prix, cout: cout,
             cout100: km ? cout * 100 / km : null };                                     // H2 = G2*100/E2
  }

  /* Recharge à l'extérieur — F3, H3 (kWh facultatif = ajout par rapport au classeur) */
  function exterieur(e, s) {
    var km = e.km, cout = e.cout;
    if (!ok(km) || !ok(cout) || !pos(s.autonomieKm)) return null;
    var kwhSaisi = pos(e.kwh);
    var kwh = kwhSaisi ? e.kwh : km * s.capaciteKwh / s.autonomieKm;                      // km ÷ (31/7)
    return { kwh: kwh, kwhEstime: !kwhSaisi, km: km, cout: cout,
             prixKwh: div(cout, kwh),                                                    // F3 = G3/(E3/(31/7))
             cout100: pos(km) ? cout * 100 / km : null };                                // H3 = G3*100/E3
  }

  /* Plein de carburant — nouveauté (le classeur n'a que la référence théorique) */
  function plein(e) {
    var l = e.litres, p = e.prixL;
    if (!ok(l) || !ok(p)) return null;
    var cout = l * p, km = pos(e.km) ? e.km : null;
    return { litres: l, prixL: p, cout: cout, km: km,
             l100: km ? l * 100 / km : null,
             cout100: km ? cout * 100 / km : null };
  }

  /* Référence carburant — K2, K3 : prix au litre × L/100 km */
  function refCarburant(c) {
    if (!ok(c.prixL) || !ok(c.l100)) return null;
    return c.prixL * c.l100;
  }

  /* Recharge au temps — F6, G6, H6 */
  function auTemps(p) {
    if (!ok(p.kwh) || !pos(p.kw) || !ok(p.prixMin)) return null;
    var heures = p.kwh / p.kw;          // F6 = D6/E6
    var minutes = heures * 60;          // G6 = F6*60
    var prix = minutes * p.prixMin;     // H6 = G6*C6
    return { heures: heures, minutes: minutes, prix: prix,
             prixKwh: p.kwh > 0 ? prix / p.kwh : null }; // ajout : équivalent €/kWh
  }

  /* Cumuls sur une liste d'entrées */
  function resume(entries, s) {
    var r = { nb: entries.length, coutTotal: 0,
              maison: { kwh: 0, km: 0, cout: 0, nb: 0 },
              ext:    { kwh: 0, km: 0, cout: 0, nb: 0 },
              fuel:   { litres: 0, km: 0, cout: 0, nb: 0, litresAvecKm: 0, coutAvecKm: 0 } };
    entries.forEach(function (e) {
      var c = calcEntry(e, s);
      if (!c) return;
      r.coutTotal += c.cout;
      if (e.type === 'maison') { r.maison.kwh += c.kwh; r.maison.km += c.km || 0; r.maison.cout += c.cout; r.maison.nb++; }
      else if (e.type === 'ext') { r.ext.kwh += c.kwh; r.ext.km += c.km || 0; r.ext.cout += c.cout; r.ext.nb++; }
      else if (e.type === 'plein') {
        r.fuel.litres += c.litres; r.fuel.cout += c.cout; r.fuel.nb++;
        if (c.km) { r.fuel.km += c.km; r.fuel.litresAvecKm += c.litres; r.fuel.coutAvecKm += c.cout; }
      }
    });
    var elecKm = r.maison.km + r.ext.km, elecCout = r.maison.cout + r.ext.cout;
    r.elec = { km: elecKm, cout: elecCout, kwh: r.maison.kwh + r.ext.kwh,
               cout100: elecKm > 0 ? elecCout * 100 / elecKm : null };
    r.maison.cout100 = r.maison.km > 0 ? r.maison.cout * 100 / r.maison.km : null;
    r.ext.cout100 = r.ext.km > 0 ? r.ext.cout * 100 / r.ext.km : null;
    r.fuel.l100 = r.fuel.km > 0 ? r.fuel.litresAvecKm * 100 / r.fuel.km : null;
    r.fuel.cout100 = r.fuel.km > 0 ? r.fuel.coutAvecKm * 100 / r.fuel.km : null;
    return r;
  }

  function calcEntry(e, s) {
    if (e.type === 'maison') return maison(e, s);
    if (e.type === 'ext') return exterieur(e, s);
    if (e.type === 'plein') return plein(e);
    return null;
  }

  return { DEFAULTS: DEFAULTS, maison: maison, exterieur: exterieur, plein: plein,
           refCarburant: refCarburant, auTemps: auTemps, resume: resume, calcEntry: calcEntry };
});
