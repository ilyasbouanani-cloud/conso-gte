
/* Conso GTE — application locale (aucune donnée n'est envoyée nulle part). */
(function () {
  'use strict';

  var KEY = 'conso-gte:v1';
  var APP_ID = 'conso-gte';
  var TYPES = ['maison', 'ext', 'plein'];

  /* ---------- Utilitaires ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function nf(n, d) {
    if (n == null || !isFinite(n)) return '—';
    d = d == null ? 2 : d;
    return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function eur(n, d) { return n == null ? '—' : nf(n, d) + ' €'; }
  function signed(n, d) { return (n > 0 ? '+' : n < 0 ? '−' : '') + nf(Math.abs(n), d); }
  function num(v) {
    if (v == null) return null;
    var s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }
  function plain(n) { return n == null ? '' : String(n).replace('.', ','); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(s) { return parseDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }

  var ICONS = {
    maison: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    ext: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    plein: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h10M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h4"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>'
  };
  function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }

  /* ---------- Données ---------- */
  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    var s = clone(Calc.DEFAULTS), ds = d.settings || {};
    Object.keys(s).forEach(function (k) {
      if (k === 'carburants') {
        /* valeurs de référence carburant : fixes, jamais lues depuis les données */
      } else if (typeof ds[k] === 'number' && isFinite(ds[k]) && ds[k] >= 0) s[k] = ds[k];
    });
    var entries = (Array.isArray(d.entries) ? d.entries : []).map(cleanEntry).filter(Boolean);
    return { app: APP_ID, version: 1, settings: s, entries: entries,
             lastBackup: typeof d.lastBackup === 'string' ? d.lastBackup : null,
             ui: { installDismissed: !!(d.ui && d.ui.installDismissed) } };
  }
  function cleanEntry(e) {
    if (!e || typeof e !== 'object' || TYPES.indexOf(e.type) < 0) return null;
    if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
    var f = function (k) { var n = e[k]; return typeof n === 'number' && isFinite(n) && n >= 0 ? n : null; };
    var o = { id: String(e.id || uid()), type: e.type, date: e.date,
              note: String(e.note || '').slice(0, 200), createdAt: Number(e.createdAt) || Date.now() };
    if (e.type === 'maison') { o.kwh = f('kwh'); o.prixKwh = f('prixKwh'); if (o.kwh == null || o.prixKwh == null) return null; }
    if (e.type === 'ext') { o.km = f('km'); o.cout = f('cout'); o.kwh = f('kwh'); if (o.km == null || o.cout == null) return null; }
    if (e.type === 'plein') {
      o.carburant = e.carburant === 'diesel' ? 'diesel' : 'sp98';
      o.litres = f('litres'); o.prixL = f('prixL'); o.km = f('km');
      if (o.litres == null || o.prixL == null) return null;
    }
    return o;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) {}
    return normalize({});
  }
  var db = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast('Enregistrement impossible : stockage bloqué ou plein.'); return false; }
  }
  var S = function () { return db.settings; };

  /* ---------- État de l'interface ---------- */
  var state = { tab: 'home', period: 'all', filter: 'all', addType: 'maison', editId: null, addDate: null };
  var TITLES = {
    home: ['Vue d’ensemble', 'Électrique ou essence : ce que ça coûte vraiment'],
    history: ['Historique', 'Recharges et pleins'],
    add: ['Nouvelle entrée', 'Après une recharge ou un plein'],
    sim: ['Recharge au temps', 'Durée et prix d’une recharge facturée à la minute'],
    settings: ['Réglages', 'Valeurs de référence, sauvegarde, installation']
  };

  /* ---------- Rendu général ---------- */
  function render(resetScroll) {
    var t = TITLES[state.tab];
    var title = state.tab === 'add' && state.editId ? 'Modifier l’entrée' : t[0];
    $('#title').textContent = title;
    $('#sub').textContent = t[1];
    document.querySelectorAll('.tabbar button').forEach(function (b) {
      if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var html = { home: viewHome, history: viewHistory, add: viewAdd, sim: viewSim, settings: viewSettings }[state.tab]();
    $('#view').innerHTML = html;
    if (state.tab === 'add') updatePreview();
    if (state.tab === 'sim') updateSim();
    if (resetScroll) window.scrollTo(0, 0);
  }
  function go(tab) { state.tab = tab; if (tab !== 'add') state.editId = null; render(true); }

  /* ---------- Calculs partagés ---------- */
  function refs() {
    var c = S().carburants;
    return { sp98: Calc.refCarburant(c.sp98), diesel: Calc.refCarburant(c.diesel) };
  }
  function inPeriod(e) {
    if (state.period === 'all') return true;
    return (Date.now() - parseDate(e.date).getTime()) / 864e5 <= Number(state.period);
  }
  function sorted(list) {
    return list.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt; });
  }
  function entryTitle(e) {
    if (e.type === 'maison') return 'Recharge maison';
    if (e.type === 'ext') return 'Recharge extérieure';
    return 'Plein ' + S().carburants[e.carburant].nom;
  }
  function entryDetail(e, c) {
    if (e.type === 'maison') return nf(e.kwh) + ' kWh · ' + nf(e.prixKwh) + ' €/kWh';
    if (e.type === 'ext') return nf(e.km, 0) + ' km' + (c && c.kwh ? ' · ' + nf(c.kwh) + ' kWh' + (c.kwhEstime ? ' (est.)' : '') : '');
    return nf(e.litres) + ' L · ' + nf(e.prixL) + ' €/L' + (e.km ? ' · ' + nf(e.km, 0) + ' km' : '');
  }

  /* ---------- Accueil ---------- */
  function viewHome() {
    var chips = [['all', 'Tout'], ['365', '12 mois'], ['30', '30 jours']].map(function (p) {
      return '<button class="chip" data-act="period" data-p="' + p[0] + '" aria-pressed="' + (state.period === p[0]) + '">' + p[1] + '</button>';
    }).join('');

    if (!db.entries.length) {
      return '<div class="card empty">' + svg('box') +
        '<h2>Aucune entrée pour le moment</h2>' +
        '<p class="muted">Ajoute ta première recharge ou ton premier plein pour voir apparaître ici tes coûts et la comparaison électrique / essence.</p>' +
        '<div class="btns"><button class="btn" data-act="tab" data-tab="add">Ajouter une entrée</button>' +
        '<button class="btn alt sm" data-act="samples">Charger les exemples du classeur</button></div></div>' +
        installBanner();
    }

    var list = sorted(db.entries.filter(inPeriod));
    var out = '<div class="chips" role="group" aria-label="Période">' + chips + '</div>';
    if (!list.length) return out + '<div class="card muted">Aucune entrée sur cette période.</div>' + installBanner();

    var r = Calc.resume(list, S()), ref = refs();
    var cmp = r.elec.cout100;

    /* Héros */
    out += '<section class="card hero"><div class="label">Coût moyen aux 100 km · électrique</div>' +
      '<div class="big">' + (cmp == null ? '—' : nf(cmp)) + '<small>€ / 100 km</small></div>';
    if (cmp != null && ref.sp98) {
      var diff = ref.sp98 - cmp, pct = diff / ref.sp98 * 100;
      out += '<span class="pill ' + (diff >= 0 ? 'good' : 'bad') + '"><svg viewBox="0 0 24 24">' + ICONS[diff >= 0 ? 'down' : 'up'] + '</svg>' +
        nf(Math.abs(diff)) + ' € de ' + (diff >= 0 ? 'moins' : 'plus') + ' que le SP98 (' + signed(-pct, 0) + ' %)</span>';
      out += '<p class="saving">Sur ' + nf(r.elec.km, 0) + ' km électriques : ' + (diff >= 0 ? 'économie' : 'surcoût') +
        ' estimé de <b>' + eur(Math.abs(diff) * r.elec.km / 100) + '</b> par rapport au SP98 de référence.</p>';
    } else if (cmp == null) {
      out += '<p class="saving">Ajoute une recharge pour calculer le coût aux 100 km.</p>';
    }
    out += '</section>';

    /* Comparaison */
    var rows = [];
    if (r.maison.cout100 != null) rows.push({ l: 'Électrique · maison', v: r.maison.cout100, k: 'elec' });
    if (r.ext.cout100 != null) rows.push({ l: 'Électrique · extérieur', v: r.ext.cout100, k: 'elec2' });
    if (r.maison.cout100 != null && r.ext.cout100 != null) rows.push({ l: 'Électrique · moyenne', v: cmp, k: 'avg', cls: 'avg' });
    if (r.fuel.cout100 != null) rows.push({ l: 'Carburant · réel (tes pleins)', v: r.fuel.cout100, k: 'fuel' });
    rows.push({ l: 'SP98 · référence', v: ref.sp98, k: 'fuel' });
    rows.push({ l: 'Diesel · référence', v: ref.diesel, k: 'fuel' });
    rows = rows.filter(function (x) { return x.v != null; });
    rows.forEach(function (x) { if (x.k !== 'fuel' && ref.sp98 != null && x.v > ref.sp98) { x.k = 'over'; x.over = true; } });
    var max = Math.max.apply(null, rows.map(function (x) { return x.v; })) || 1;
    out += '<section class="card"><h2>Comparaison · € aux 100 km</h2><div class="bars">' + rows.map(function (x) {
      return '<div class="bar-row ' + (x.cls || '') + '"><div class="top-line"><span>' + x.l + '</span><b>' + eur(x.v) + '</b></div>' +
        '<div class="bar-track"><div class="bar ' + x.k + '" style="width:' + Math.max(2, x.v / max * 100).toFixed(1) + '%"></div></div></div>';
    }).join('') + '</div><div class="legend"><span><i class="dot" style="background:var(--primary)"></i>Électrique</span>' +
      '<span><i class="dot" style="background:var(--fuel)"></i>Carburant</span></div>' +
      '<p class="hint">Référence carburant = prix au litre × L/100 km (valeurs fixes du classeur). En rouge ▲ : plus cher que le SP98.</p></section>';

    /* Chiffres clés */
    var estim = list.some(function (e) { return e.type === 'ext' && !(e.kwh > 0); });
    out += '<section class="card"><h2>Chiffres clés</h2><div class="stats">' +
      stat(eur(r.coutTotal), 'Dépenses totales') +
      stat(nf(r.elec.km, 0) + '<small>km</small>', 'Km électriques (estimés)') +
      stat(nf(r.elec.kwh, 1) + '<small>kWh</small>', 'Énergie rechargée' + (estim ? ' (dont estimée)' : '')) +
      stat(r.elec.kwh > 0 ? nf(r.elec.cout / r.elec.kwh) + '<small>€/kWh</small>' : '—', 'Prix moyen du kWh');
    if (r.fuel.nb) {
      out += stat(nf(r.fuel.litres, 1) + '<small>L</small>', 'Carburant acheté', 'fuel') +
        stat(r.fuel.l100 != null ? nf(r.fuel.l100, 1) + '<small>L/100 km</small>' : '—', 'Conso. réelle (pleins avec km)', 'fuel');
    }
    out += '</div>' + (estim ? '<p class="hint">Sans kWh saisi, l’énergie d’une recharge extérieure est estimée : km × ' + nf(S().capaciteKwh, 0) + ' ÷ ' + nf(S().autonomieKm, 0) + '.</p>' : '') + '</section>';

    /* Dépenses mensuelles */
    out += monthsCard();

    /* Dernières entrées */
    out += '<section class="card"><h2>Dernières entrées</h2><ul class="list">' + sorted(db.entries).slice(0, 3).map(itemHtml).join('') +
      '</ul><div class="btns"><button class="btn alt sm" data-act="tab" data-tab="history">Voir tout l’historique</button></div></section>';

    out += backupBanner() + installBanner();
    return out;
  }
  function stat(v, l, cls) { return '<div class="stat ' + (cls || '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; }

  function monthsCard() {
    var now = new Date(), m = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      m.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
               lab: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), e: 0, f: 0 });
    }
    db.entries.forEach(function (e) {
      var c = Calc.calcEntry(e, S()); if (!c) return;
      var slot = m.filter(function (x) { return x.key === e.date.slice(0, 7); })[0];
      if (slot) { if (e.type === 'plein') slot.f += c.cout; else slot.e += c.cout; }
    });
    var max = Math.max.apply(null, m.map(function (x) { return x.e + x.f; }));
    if (!(max > 0)) return '';
    return '<section class="card"><h2>Dépenses · 6 derniers mois</h2><div class="months">' + m.map(function (x) {
      var tot = x.e + x.f, h = tot / max * 88;
      return '<div class="mcol"><span class="mv">' + (tot > 0 ? nf(tot, 0) + ' €' : '') + '</span>' +
        '<div class="stack" style="height:' + (tot > 0 ? Math.max(4, h) : 0) + 'px">' +
        (x.e > 0 ? '<div class="seg-e" style="height:' + (x.e / tot * 100) + '%"></div>' : '') +
        (x.f > 0 ? '<div class="seg-f" style="height:' + (x.f / tot * 100) + '%"></div>' : '') +
        '</div><span class="ml">' + x.lab + '</span></div>';
    }).join('') + '</div><div class="legend"><span><i class="dot" style="background:var(--primary)"></i>Électrique</span>' +
      '<span><i class="dot" style="background:var(--fuel)"></i>Carburant</span></div></section>';
  }

  function isStandalone() { return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function installBanner() {
    if (isStandalone() || db.ui.installDismissed) return '';
    return '<div class="banner"><div>Installe l’app sur ton écran d’accueil pour l’utiliser hors connexion. ' +
      '<button class="lnk" data-act="guide">Voir comment faire</button></div><button class="x" data-act="dismissInstall" aria-label="Masquer">×</button></div>';
  }
  function backupBanner() {
    if (db.entries.length < 5) return '';
    var old = !db.lastBackup || (Date.now() - new Date(db.lastBackup).getTime()) > 30 * 864e5;
    if (!old) return '';
    return '<div class="banner"><div>Pense à faire une sauvegarde : les données ne sont que sur cet iPhone. ' +
      '<button class="lnk" data-act="goBackup">Sauvegarder</button></div></div>';
  }

  /* ---------- Historique ---------- */
  function itemHtml(e) {
    var c = Calc.calcEntry(e, S());
    var sub = fmtDate(e.date) + ' · ' + entryDetail(e, c);
    var right = c && c.cout100 != null ? nf(c.cout100) + ' €/100 km' : (e.type === 'plein' ? 'km non saisis' : '');
    var ref = refs().sp98, over = e.type !== 'plein' && c && c.cout100 != null && ref != null && c.cout100 > ref;
    if (over) right = '▲ ' + right;
    return '<li><button class="item" data-act="open" data-id="' + esc(e.id) + '">' +
      '<span class="ico ' + (e.type === 'plein' ? 'fuel' : '') + '">' + svg(e.type) + '</span>' +
      '<span class="mid"><div class="t">' + esc(entryTitle(e)) + '</div><div class="s">' + esc(sub) + '</div></span>' +
      '<span class="r"><b>' + (c ? eur(c.cout) : '—') + '</b><span class="' + (over ? 'bad' : '') + '">' + right + '</span></span></button></li>';
  }
  function viewHistory() {
    var filters = [['all', 'Tout'], ['maison', 'Maison'], ['ext', 'Extérieur'], ['plein', 'Pleins']];
    var chips = '<div class="chips" role="group" aria-label="Filtre">' + filters.map(function (f) {
      return '<button class="chip" data-act="filter" data-f="' + f[0] + '" aria-pressed="' + (state.filter === f[0]) + '">' + f[1] + '</button>';
    }).join('') + '</div>';
    var list = sorted(db.entries.filter(function (e) { return state.filter === 'all' || e.type === state.filter; }));
    if (!list.length) {
      return chips + '<div class="card empty">' + svg('box') + '<h2>Rien à afficher</h2><p class="muted">Aucune entrée dans cette catégorie.</p>' +
        '<div class="btns"><button class="btn" data-act="tab" data-tab="add">Ajouter une entrée</button></div></div>';
    }
    var out = chips, cur = '';
    list.forEach(function (e) {
      var g = parseDate(e.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (g !== cur) { if (cur) out += '</ul></section>'; out += '<div class="group">' + g + '</div><section class="card"><ul class="list">'; cur = g; }
      out += itemHtml(e);
    });
    out += '</ul></section>';
    var t = Calc.resume(list, S());
    return out + '<p class="hint" style="text-align:center">' + list.length + ' entrée' + (list.length > 1 ? 's' : '') + ' · ' + eur(t.coutTotal) + '</p>';
  }

  function computedRows(type, c) {
    if (!c) return [];
    var ref = refs().sp98, rows = [];
    var over = type !== 'plein' && c.cout100 != null && ref != null && c.cout100 > ref ? ' bad' : '';
    if (type === 'maison') {
      rows.push(['Km rechargés (estimés)', nf(c.km, 1), 'km']);
      rows.push(['Coût de la recharge', nf(c.cout), '€']);
      rows.push(['Coût aux 100 km', nf(c.cout100), '€', 'main' + over]);
    } else if (type === 'ext') {
      rows.push(['Énergie rechargée' + (c.kwhEstime ? ' (estimée)' : ''), nf(c.kwh), 'kWh']);
      rows.push(['Prix du kWh', nf(c.prixKwh), '€/kWh']);
      rows.push(['Coût aux 100 km', nf(c.cout100), '€', 'main' + over]);
    } else {
      rows.push(['Coût du plein', nf(c.cout), '€']);
      rows.push(['Consommation', c.l100 == null ? '—' : nf(c.l100, 1), 'L/100 km']);
      rows.push(['Coût aux 100 km', c.cout100 == null ? '—' : nf(c.cout100), '€', 'main']);
    }
    if (type !== 'plein' && c.cout100 != null && ref) {
      var d = c.cout100 - ref;
      rows.push(['Écart vs SP98 (réf.)', signed(d), '€/100 km', 'delta ' + (d <= 0 ? 'good' : 'bad')]);
    }
    return rows;
  }
  function rowsHtml(rows) {
    return rows.map(function (r) {
      var cls = r[3] ? ' ' + r[3].split(' ')[0] : '', vcls = r[3] && r[3].indexOf('good') > -1 ? 'good' : r[3] && r[3].indexOf('bad') > -1 ? 'bad' : '';
      return '<div class="row' + cls + '"><span class="k">' + r[0] + '</span><span class="v ' + vcls + '">' + r[1] + ' <small>' + r[2] + '</small></span></div>';
    }).join('');
  }

  /* ---------- Formulaire d'ajout / modification ---------- */
  function field(o) {
    return '<label class="field"><span class="lab"><span>' + o.label + '</span>' + (o.opt ? '<em>facultatif</em>' : '') + '</span>' +
      '<span class="inp"><input name="' + o.name + '" ' + (o.type ? 'type="' + o.type + '"' : 'type="text" inputmode="decimal" autocomplete="off"') +
      ' value="' + esc(o.value) + '"' + (o.ph ? ' placeholder="' + o.ph + '"' : '') + '>' +
      (o.unit ? '<span class="unit">' + o.unit + '</span>' : '') + '</span>' + (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</label>';
  }
  function lastOf(type, key) {
    var l = sorted(db.entries.filter(function (e) { return e.type === type; }))[0];
    return l ? l[key] : null;
  }
  function viewAdd() {
    var ed = state.editId ? db.entries.filter(function (e) { return e.id === state.editId; })[0] : null;
    if (ed) state.addType = ed.type;
    var t = state.addType, date = ed ? ed.date : (state.addDate || todayStr()), f = '';
    var segs = [['maison', 'Maison'], ['ext', 'Extérieur'], ['plein', 'Plein']];
    var seg = ed ? '' : '<div class="seg" role="group" aria-label="Type d’entrée">' + segs.map(function (s) {
      return '<button data-act="addType" data-t="' + s[0] + '" aria-pressed="' + (t === s[0]) + '">' + s[1] + '</button>';
    }).join('') + '</div>';

    f += field({ label: 'Date', name: 'date', type: 'date', value: date });
    if (t === 'maison') {
      f += field({ label: 'Énergie rechargée', name: 'kwh', unit: 'kWh', value: ed ? plain(ed.kwh) : '', ph: '5' });
      f += field({ label: 'Prix du kWh', name: 'prixKwh', unit: '€/kWh', value: plain(ed ? ed.prixKwh : (lastOf('maison', 'prixKwh') != null ? lastOf('maison', 'prixKwh') : S().prixKwhMaison)) });
    } else if (t === 'ext') {
      f += field({ label: 'Kilomètres rechargés', name: 'km', unit: 'km', value: ed ? plain(ed.km) : '', ph: '23', hint: 'Autonomie gagnée affichée par la voiture.' });
      f += field({ label: 'Coût de la recharge', name: 'cout', unit: '€', value: ed ? plain(ed.cout) : '', ph: '4,95' });
      f += field({ label: 'Énergie rechargée', name: 'kwh', unit: 'kWh', opt: true, value: ed ? plain(ed.kwh) : '', hint: 'Si laissé vide : estimée à partir des km (' + nf(S().autonomieKm / S().capaciteKwh, 2) + ' km/kWh, comme à la maison).' });
    } else {
      var carb = ed ? ed.carburant : 'sp98';
      var opts = Object.keys(S().carburants).map(function (k) { return '<option value="' + k + '"' + (k === carb ? ' selected' : '') + '>' + S().carburants[k].nom + '</option>'; }).join('');
      f += '<label class="field"><span class="lab"><span>Carburant</span></span><span class="inp"><select name="carburant">' + opts + '</select></span></label>';
      f += field({ label: 'Litres mis', name: 'litres', unit: 'L', value: ed ? plain(ed.litres) : '', ph: '38,5' });
      f += field({ label: 'Prix au litre', name: 'prixL', unit: '€/L', value: plain(ed ? ed.prixL : (lastOf('plein', 'prixL') != null ? lastOf('plein', 'prixL') : S().carburants.sp98.prixL)) });
      f += field({ label: 'Km depuis le plein précédent', name: 'km', unit: 'km', opt: true, value: ed ? plain(ed.km) : '', hint: 'Permet de calculer la consommation réelle en L/100 km.' });
    }
    f += field({ label: 'Note', name: 'note', type: 'text', opt: true, value: ed ? ed.note : '' });

    return '<form id="addForm" class="card" novalidate>' + seg + f +
      '<div class="res" id="preview"></div><p class="err" id="formErr" hidden></p>' +
      '<div class="btns' + (ed ? ' two' : '') + '"><button type="submit" class="btn" data-act="save">' + (ed ? 'Enregistrer' : 'Ajouter') + '</button>' +
      (ed ? '<button type="button" class="btn alt" data-act="cancelEdit">Annuler</button>' : '') + '</div></form>';
  }
  function readAdd() {
    var f = $('#addForm'); if (!f) return null;
    var g = function (n) { return f.elements[n] ? num(f.elements[n].value) : null; };
    var base = { type: state.addType, date: f.elements.date.value, note: (f.elements.note.value || '').trim() };
    if (base.type === 'maison') { base.kwh = g('kwh'); base.prixKwh = g('prixKwh'); }
    else if (base.type === 'ext') { base.km = g('km'); base.cout = g('cout'); base.kwh = g('kwh'); }
    else { base.carburant = f.elements.carburant.value; base.litres = g('litres'); base.prixL = g('prixL'); base.km = g('km'); }
    return base;
  }
  function updatePreview() {
    var e = readAdd(), box = $('#preview'); if (!e || !box) return;
    var c = Calc.calcEntry(e, S());
    box.innerHTML = '<h3>Résultats <span class="tag calc">Calculé</span></h3>' +
      (c ? rowsHtml(computedRows(e.type, c)) : '<p class="muted small" style="margin:0">Renseigne les champs pour voir les résultats.</p>');
  }
  function saveEntry() {
    var e = readAdd(), err = $('#formErr'), bad = [];
    var req = { maison: ['kwh', 'prixKwh'], ext: ['km', 'cout'], plein: ['litres', 'prixL'] }[e.type];
    req.forEach(function (k) { if (e[k] == null || e[k] < 0) bad.push(k); });
    if ((e.type === 'maison' && e.kwh === 0) || (e.type === 'ext' && e.km === 0) || (e.type === 'plein' && e.litres === 0)) bad.push(req[0]);
    ['kwh', 'km'].forEach(function (k) { if (e[k] != null && e[k] < 0) bad.push(k); });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) bad.push('date');
    document.querySelectorAll('.inp.bad').forEach(function (n) { n.classList.remove('bad'); });
    if (bad.length) {
      bad.forEach(function (k) { var i = $('#addForm [name="' + k + '"]'); if (i) i.closest('.inp').classList.add('bad'); });
      err.textContent = 'Vérifie les champs en rouge : valeurs numériques positives attendues.'; err.hidden = false; return;
    }
    err.hidden = true;
    var clean = cleanEntry(Object.assign({}, e, { id: state.editId || uid() }));
    if (!clean) { err.textContent = 'Entrée invalide.'; err.hidden = false; return; }
    if (state.editId) {
      var old = db.entries.filter(function (x) { return x.id === state.editId; })[0];
      clean.createdAt = old ? old.createdAt : clean.createdAt;
      db.entries = db.entries.map(function (x) { return x.id === state.editId ? clean : x; });
    } else db.entries.push(clean);
    if (!save()) return;
    var wasEdit = !!state.editId;
    state.editId = null; state.addDate = null;
    toast(wasEdit ? 'Entrée modifiée' : 'Entrée ajoutée');
    go(wasEdit ? 'history' : 'home');
  }

  /* ---------- Simulateur : recharge au temps ---------- */
  function viewSim() {
    var s = S();
    return '<form class="card" onsubmit="return false" novalidate>' +
      simField('Énergie à recharger', 'kwhARecharger', 'kWh', s.kwhARecharger, 'saisie') +
      simField('Puissance de recharge', 'puissanceKw', 'kW', s.puissanceKw, 'fixe') +
      simField('Prix à la minute', 'prixMinute', '€/min', s.prixMinute, 'saisie') +
      '<div class="res" id="simRes"></div></form>' +
      '<p class="hint" style="padding:0 6px">Mêmes calculs que le classeur : durée = kWh ÷ kW, minutes = durée × 60, prix = minutes × €/min. Les valeurs saisies sont conservées.</p>';
  }
  function simField(label, path, unit, val, tag) {
    return '<label class="field"><span class="lab"><span>' + label + '<span class="tag ' + tag + '">' + (tag === 'fixe' ? 'Fixe' : 'Saisie') + '</span></span></span>' +
      '<span class="inp"><input type="text" inputmode="decimal" autocomplete="off" data-set="' + path + '" value="' + plain(val) + '"><span class="unit">' + unit + '</span></span></label>';
  }
  function updateSim() {
    var s = S(), box = $('#simRes'); if (!box) return;
    var r = Calc.auTemps({ kwh: s.kwhARecharger, kw: s.puissanceKw, prixMin: s.prixMinute });
    if (!r) { box.innerHTML = '<p class="muted small" style="margin:0">Renseigne une puissance supérieure à 0.</p>'; return; }
    var h = Math.floor(r.minutes / 60), m = Math.round(r.minutes - h * 60);
    if (m === 60) { h++; m = 0; }
    var maison = s.kwhARecharger * s.prixKwhMaison;
    box.innerHTML = '<h3>Résultats <span class="tag calc">Calculé</span></h3>' +
      '<div class="row"><span class="k">Durée</span><span class="v">' + nf(r.heures) + ' <small>h</small></span></div>' +
      '<div class="row"><span class="k">Minutes de recharge</span><span class="v">' + nf(r.minutes) + ' <small>min · ' + h + ' h ' + String(m).padStart(2, '0') + '</small></span></div>' +
      '<div class="row main"><span class="k">Prix de la recharge</span><span class="v">' + nf(r.prix) + ' <small>€</small></span></div>' +
      '<div class="row"><span class="k">Équivalent au kWh</span><span class="v">' + nf(r.prixKwh) + ' <small>€/kWh</small></span></div>' +
      '<div class="row"><span class="k">Même énergie à la maison</span><span class="v">' + nf(maison) + ' <small>€</small></span></div>';
  }

  /* ---------- Réglages ---------- */
  function setField(label, path, unit, val, tag, hint) {
    return '<label class="field"><span class="lab"><span>' + label + '<span class="tag ' + tag + '">' + (tag === 'fixe' ? 'Fixe' : 'Saisie') + '</span></span></span>' +
      '<span class="inp"><input type="text" inputmode="decimal" autocomplete="off" data-set="' + path + '" value="' + plain(val) + '"><span class="unit">' + unit + '</span></span>' +
      (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>';
  }
  function viewSettings() {
    var s = S(), c = s.carburants;
    var last = db.lastBackup ? 'Dernière sauvegarde : ' + new Date(db.lastBackup).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Aucune sauvegarde effectuée pour l’instant.';
    return '<section class="card"><h2>Sauvegarde</h2>' +
      '<p class="muted small" style="margin-top:0">Tes données restent sur cet iPhone. Exporte un fichier pour les conserver ou les transférer, sans passer par un service en ligne.</p>' +
      '<p class="small"><b>' + db.entries.length + ' entrée' + (db.entries.length > 1 ? 's' : '') + '</b> · ' + last + '</p>' +
      '<div class="btns"><button class="btn" data-act="export">Exporter la sauvegarde (.json)</button>' +
      '<button class="btn alt" data-act="import">Importer une sauvegarde…</button>' +
      '<button class="btn alt sm" data-act="exportCsv">Exporter en tableau (.csv)</button></div></section>' +

      '<section class="card"><h2>Valeurs fixes du véhicule</h2>' +
      setField('Autonomie électrique du plein', 'autonomieKm', 'km', s.autonomieKm, 'fixe', 'Classeur B2 : 31 km pour un plein de 7 kWh.') +
      setField('Capacité du plein', 'capaciteKwh', 'kWh', s.capaciteKwh, 'fixe', 'Classeur C2. Sert à convertir kWh → km à la maison (31 ÷ 7 = ' + nf(s.autonomieKm / s.capaciteKwh) + ' km/kWh).') +
      setField('Puissance de recharge', 'puissanceKw', 'kW', s.puissanceKw, 'fixe', 'Classeur E6.') + '</section>' +

      '<section class="card"><h2>Tarifs par défaut</h2>' +
      setField('Prix du kWh à la maison', 'prixKwhMaison', '€/kWh', s.prixKwhMaison, 'saisie', 'Proposé à chaque nouvelle recharge maison (la dernière valeur saisie est reprise).') +
      setField('Prix à la minute (borne)', 'prixMinute', '€/min', s.prixMinute, 'saisie') + '</section>' +

      '<section class="card"><h2>Carburants de référence <span class="tag fixe">Fixe</span></h2>' +
      '<p class="muted small" style="margin-top:0">Valeurs du classeur, non modifiables. Coût aux 100 km = prix au litre × consommation.</p>' +
      '<div class="row"><span class="k">SP98</span><span class="v">' + nf(c.sp98.prixL) + ' <small>€/L</small> · ' + nf(c.sp98.l100, 1) + ' <small>L/100 km</small> → ' + nf(c.sp98.prixL * c.sp98.l100) + ' <small>€/100 km</small></span></div>' +
      '<div class="row"><span class="k">Diesel</span><span class="v">' + nf(c.diesel.prixL) + ' <small>€/L</small> · ' + nf(c.diesel.l100, 1) + ' <small>L/100 km</small> → ' + nf(c.diesel.prixL * c.diesel.l100) + ' <small>€/100 km</small></span></div>' +
      '<div class="btns"><button class="btn alt sm" data-act="resetSettings">Revenir aux valeurs du classeur</button></div></section>' +

      '<section class="card" id="guide"><details class="guide"' + (state.openGuide ? ' open' : '') + '><summary>Installer sur l’écran d’accueil (iPhone)</summary>' +
      '<ol class="steps"><li>Ouvre l’adresse de l’application dans <b>Safari</b>.</li>' +
      '<li>Touche le bouton <b>Partager</b> (carré avec une flèche vers le haut).</li>' +
      '<li>Choisis <b>« Sur l’écran d’accueil »</b> (parfois sous « Plus »), puis <b>Ajouter</b>.</li>' +
      '<li>Ouvre ensuite l’app <b>depuis son icône</b>. Elle fonctionne alors hors connexion.</li></ol>' +
      '<p class="small"><b>Important :</b> les données de Safari et celles de l’icône sur l’écran d’accueil sont séparées. Installe l’app d’abord, puis saisis tout depuis l’icône. Pour transférer des données déjà saisies dans Safari : exporte-les dans Safari, puis importe-les dans l’app installée.</p></details></section>' +

      '<section class="card"><h2>Données</h2><div class="btns">' +
      (db.entries.length ? '' : '<button class="btn alt sm" data-act="samples">Charger les exemples du classeur</button>') +
      '<button class="btn danger sm" data-act="wipe">Effacer toutes les données</button></div>' +
      '<p class="hint">Aucun compte, aucun serveur, aucune statistique : tout reste dans le stockage local de l’app.</p></section>';
  }
  function setPath(path, val) {
    var p = path.split('.'), o = S();
    for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = val;
  }

  /* ---------- Feuilles modales ---------- */
  var overlay = $('#overlay');
  function openSheet(html) {
    overlay.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    overlay.hidden = false;
  }
  function closeSheet() { overlay.hidden = true; overlay.innerHTML = ''; }
  function ask(o) {
    return new Promise(function (resolve) {
      openSheet('<h3>' + esc(o.title) + '</h3>' + (o.text ? '<p class="sub">' + esc(o.text) + '</p>' : '') +
        '<div class="btns">' + o.buttons.map(function (b, i) {
          return '<button class="btn ' + (b.cls || '') + '" data-ans="' + i + '">' + esc(b.label) + '</button>';
        }).join('') + '<button class="btn alt" data-ans="-1">Annuler</button></div>');
      overlay.onclick = function (ev) {
        var b = ev.target.closest('[data-ans]');
        if (b || ev.target === overlay) { overlay.onclick = null; closeSheet(); resolve(b ? Number(b.dataset.ans) : -1); }
      };
    });
  }
  function openEntry(id) {
    var e = db.entries.filter(function (x) { return x.id === id; })[0]; if (!e) return;
    var c = Calc.calcEntry(e, S());
    openSheet('<h3>' + esc(entryTitle(e)) + '</h3><p class="sub">' + esc(fmtDate(e.date)) + ' · ' + esc(entryDetail(e, c)) + '</p>' +
      '<div class="res">' + (e.type !== 'plein' ? '' : '') + rowsHtml(c ? [['Coût', nf(c.cout), '€']].concat(computedRows(e.type, c)) : []) + '</div>' +
      (e.note ? '<p class="small muted">Note : ' + esc(e.note) + '</p>' : '') +
      '<div class="btns"><button class="btn" data-sheet="edit" data-id="' + esc(id) + '">Modifier</button>' +
      '<button class="btn danger" data-sheet="del" data-id="' + esc(id) + '">Supprimer</button>' +
      '<button class="btn alt" data-sheet="close">Fermer</button></div>');
    overlay.onclick = function (ev) {
      if (ev.target === overlay) { overlay.onclick = null; return closeSheet(); }
      var b = ev.target.closest('[data-sheet]'); if (!b) return;
      overlay.onclick = null; closeSheet();
      if (b.dataset.sheet === 'edit') { state.editId = id; state.tab = 'add'; render(true); }
      if (b.dataset.sheet === 'del') {
        ask({ title: 'Supprimer cette entrée ?', text: entryTitle(e) + ' du ' + fmtDate(e.date) + '. Cette action est définitive.', buttons: [{ label: 'Supprimer', cls: 'danger' }] })
          .then(function (n) { if (n === 0) { db.entries = db.entries.filter(function (x) { return x.id !== id; }); save(); toast('Entrée supprimée'); render(); } });
      }
    };
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  /* ---------- Export / import ---------- */
  function stamp() { return todayStr(); }
  function deliver(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var file;
    try { file = new File([blob], name, { type: mime }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).then(function () { return true; }, function (err) { return err && err.name === 'AbortError' ? false : fallback(); });
    }
    return Promise.resolve(fallback());
    function fallback() {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); return true;
    }
  }
  function exportJson() {
    var payload = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), settings: db.settings, entries: db.entries };
    deliver('conso-gte-sauvegarde-' + stamp() + '.json', 'application/json', JSON.stringify(payload, null, 2)).then(function (ok) {
      if (ok) { db.lastBackup = new Date().toISOString(); save(); toast('Sauvegarde exportée'); if (state.tab === 'settings') render(); }
    });
  }
  function exportCsv() {
    var head = ['date', 'type', 'kWh', 'prix_kWh_eur', 'km', 'cout_eur', 'litres', 'prix_L_eur', 'carburant', 'cout_100km_eur', 'L_100km', 'note'];
    var q = function (v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var f = function (n) { return n == null ? '' : String(Math.round(n * 1e4) / 1e4).replace('.', ','); };
    var lines = [head.join(';')].concat(sorted(db.entries).reverse().map(function (e) {
      var c = Calc.calcEntry(e, S()) || {};
      return [e.date, { maison: 'maison', ext: 'exterieur', plein: 'plein' }[e.type], f(c.kwh), f(e.prixKwh != null ? e.prixKwh : c.prixKwh), f(e.type === 'maison' ? c.km : e.km),
        f(c.cout), f(e.litres), f(e.prixL), e.carburant ? S().carburants[e.carburant].nom : '', f(c.cout100), f(c.l100), e.note].map(q).join(';');
    }));
    deliver('conso-gte-' + stamp() + '.csv', 'text/csv', '﻿' + lines.join('\n')).then(function (ok) { if (ok) toast('Tableau exporté'); });
  }
  function handleImport(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var d;
      try { d = JSON.parse(rd.result); } catch (e) { return toast('Fichier illisible (JSON invalide).'); }
      if (!d || d.app !== APP_ID || !Array.isArray(d.entries)) return toast('Ce fichier n’est pas une sauvegarde Conso GTE.');
      var inc = normalize(d), n = inc.entries.length;
      ask({ title: 'Importer ' + n + ' entrée' + (n > 1 ? 's' : '') + ' ?', text: 'Fusionner ajoute les entrées absentes. Remplacer efface les données actuelles (' + db.entries.length + ' entrée' + (db.entries.length > 1 ? 's' : '') + ') et reprend aussi les réglages du fichier.',
        buttons: [{ label: 'Fusionner avec mes données' }, { label: 'Remplacer mes données', cls: 'danger' }] }).then(function (c) {
        if (c === 0) {
          var ids = {}; db.entries.forEach(function (e) { ids[e.id] = 1; });
          var added = inc.entries.filter(function (e) { return !ids[e.id]; });
          db.entries = db.entries.concat(added); save(); toast(added.length + ' entrée(s) ajoutée(s)');
        } else if (c === 1) {
          var keep = db.ui; db = inc; db.ui = keep; db.lastBackup = new Date().toISOString(); save(); toast('Données remplacées');
        } else return;
        render();
      });
    };
    rd.readAsText(file);
  }
  function loadSamples() {
    var now = Date.now(), d = todayStr();
    db.entries.push(
      { id: uid(), type: 'maison', date: d, kwh: 5, prixKwh: 0.44, note: 'Exemple du classeur', createdAt: now },
      { id: uid(), type: 'ext', date: d, km: 23, cout: 4.95, kwh: null, note: 'Exemple du classeur', createdAt: now + 1 });
    save(); toast('Exemples chargés'); render();
  }

  /* ---------- Événements ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]'); if (!t) return;
    var a = t.dataset.act;
    if (a === 'tab') go(t.dataset.tab);
    else if (a === 'period') { state.period = t.dataset.p; render(); }
    else if (a === 'filter') { state.filter = t.dataset.f; render(); }
    else if (a === 'open') openEntry(t.dataset.id);
    else if (a === 'addType') { var f = $('#addForm'); if (f) state.addDate = f.elements.date.value; state.addType = t.dataset.t; render(); }
    else if (a === 'cancelEdit') { state.editId = null; go('history'); }
    else if (a === 'export') exportJson();
    else if (a === 'exportCsv') exportCsv();
    else if (a === 'import') $('#importFile').click();
    else if (a === 'samples') loadSamples();
    else if (a === 'dismissInstall') { db.ui.installDismissed = true; save(); render(); }
    else if (a === 'guide') { state.openGuide = true; state.tab = 'settings'; render(); var g = $('#guide'); if (g) g.scrollIntoView(); }
    else if (a === 'goBackup') go('settings');
    else if (a === 'resetSettings') {
      ask({ title: 'Revenir aux valeurs du classeur ?', text: 'Les réglages (pas les entrées) reprennent leurs valeurs d’origine.', buttons: [{ label: 'Réinitialiser' }] })
        .then(function (n) { if (n === 0) { db.settings = clone(Calc.DEFAULTS); save(); toast('Réglages réinitialisés'); render(); } });
    }
    else if (a === 'wipe') {
      ask({ title: 'Effacer toutes les données ?', text: 'Toutes les entrées et tous les réglages seront supprimés de cet iPhone. Pense à exporter une sauvegarde avant.', buttons: [{ label: 'Tout effacer', cls: 'danger' }] })
        .then(function (n) { if (n === 0) { db = normalize({}); save(); toast('Données effacées'); render(true); } });
    }
  });
  document.addEventListener('submit', function (ev) { if (ev.target.id === 'addForm') { ev.preventDefault(); saveEntry(); } });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.closest('#addForm')) { t.closest('.inp') && t.closest('.inp').classList.remove('bad'); updatePreview(); }
    if (t.dataset && t.dataset.set) {
      var v = num(t.value), box = t.closest('.inp');
      if (v == null || v < 0) { box.classList.add('bad'); return; }
      box.classList.remove('bad'); setPath(t.dataset.set, v); save();
      if (state.tab === 'sim') updateSim();
    }
  });
  document.addEventListener('change', function (ev) {
    if (ev.target.closest && ev.target.closest('#addForm')) updatePreview();
  });
  $('#importFile').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (f) handleImport(f);
  });

  /* ---------- Démarrage ---------- */
  render();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
