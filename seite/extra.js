// Marktübersicht – Zusatzmodul: Marktlage, Stresstest, Sparplan-Rhythmus.
// Eigenständig: liest nur Datensätze über dash und die eigenen Browser-Einträge (Depot, Stand).
(() => {
  const root = document.getElementById('dash-root') || document;
  const $ = (s) => root.querySelector(s);
  const fmtN = (v, d) => (v == null || !Number.isFinite(v) ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pct = (v, d = 1) => (v == null || !Number.isFinite(v) ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmtN(Math.abs(v) * 100, d) + ' %');
  const eur = (v) => (v == null || !Number.isFinite(v) ? '–' : (v < 0 ? '−' : '') + fmtN(Math.abs(v), 2) + ' €');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sg = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');
  const ok = (ids) => ids.every((id) => dash.data(id).status === 'ok');
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const NAMES = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin', GOLD: 'Gold', SILBER: 'Silber', PLATIN: 'Platin', PALLADIUM: 'Palladium', SPX: 'S&P 500', ADA: 'Cardano', LINK: 'Chainlink', AVAX: 'Avalanche', BNB: 'BNB', NDX: 'Nasdaq 100', NVDA: 'Nvidia', COIN: 'Coinbase', AAPL: 'Apple', MSFT: 'Microsoft', AMZN: 'Amazon', GOOGL: 'Alphabet', EUNL: 'MSCI-World-ETF', SXR8: 'S&P-500-ETF', DAX: 'DAX' };
  const nm = (a) => NAMES[a] || a;

  // ---------- Berechnungen ----------
  dash.calc('marktlage', {
    title: 'Marktlage gesamt',
    description: 'Punkte aus Angstindex VIX (Stand), 10-jähriger US-Rendite und Dollar-Index (Veränderung über 30 Tage), S&P 500 und Bitcoin gegenüber ihrer 200-Tage-Linie und dem Anteil der Hauptwerte und der Beobachtungsliste über ihrer 200-Tage-Linie. Summe ab +2 freundlich, bis −2 angespannt.',
    inputs: ['kurse_welt', 'kurse_usd', 'kurse_beob'],
    fn: (kurse_welt, kurse_usd, kurse_beob) => {
      const by = {};
      for (const r of kurse_welt.concat(kurse_usd, kurse_beob)) { const c = Number(r.close); if (c > 0) (by[r.asset] = by[r.asset] || []).push([r.date, c]); }
      for (const k of Object.keys(by)) by[k].sort((p, q) => (p[0] < q[0] ? -1 : 1));
      const last = (a) => (by[a] ? by[a][by[a].length - 1] : null);
      const ago = (a, days) => { const s = by[a]; if (!s) return null; const L = s[s.length - 1][0]; const t = new Date(Date.parse(L + 'T00:00:00Z') - days * 864e5).toISOString().slice(0, 10); let v = null; for (const x of s) { if (x[0] <= t) v = x; else break; } return v; };
      const ma = (a, n) => { const s = by[a]; return s && s.length >= n ? s.slice(-n).reduce((t, x) => t + x[1], 0) / n : null; };
      const out = [];
      const push = (faktor, wert, text, punkte, stand) => out.push({ faktor, wert, text, punkte, stand });
      const v = last('VIX');
      if (v) push('Angstindex VIX', v[1], v[1] < 18 ? 'ruhig' : v[1] <= 25 ? 'normal' : v[1] <= 35 ? 'angespannt' : 'Stress', v[1] < 18 ? 1 : v[1] <= 25 ? 0 : v[1] <= 35 ? -1 : -2, v[0]);
      const y = last('US10Y'), y0 = ago('US10Y', 30);
      if (y && y0) { const d = y[1] - y0[1]; push('US-Zins 10 Jahre, 30 Tage', d, d > 0.3 ? 'steigt deutlich (Druck)' : d < -0.3 ? 'fällt deutlich (Entlastung)' : 'kaum verändert', d > 0.3 ? -1 : d < -0.3 ? 1 : 0, y[0]); }
      const x = last('DXY'), x0 = ago('DXY', 30);
      if (x && x0) { const d = x[1] / x0[1] - 1; push('Dollar-Index, 30 Tage', d, d > 0.02 ? 'stark (belastet Risiko)' : d < -0.02 ? 'schwach (stützt Risiko)' : 'seitwärts', d > 0.02 ? -1 : d < -0.02 ? 1 : 0, x[0]); }
      for (const [a, label] of [['SPX', 'S&P 500 zur 200-Tage-Linie'], ['BTC', 'Bitcoin zur 200-Tage-Linie']]) {
        const l = last(a), m = ma(a, 200);
        if (l && m) { const d = l[1] / m - 1; push(label, d, d > 0 ? 'darüber (Aufwärtstrend)' : 'darunter (Abwärtstrend)', d > 0 ? 1 : -1, l[0]); }
      }
      const pool = [...new Set(kurse_usd.concat(kurse_beob).map((r) => r.asset))].filter((a) => by[a] && by[a].length >= 200);
      if (pool.length) {
        const up = pool.filter((a) => last(a)[1] > ma(a, 200)).length, s = up / pool.length;
        push('Breite: Werte über 200-Tage-Linie', s, up + ' von ' + pool.length, s > 0.6 ? 1 : s < 0.4 ? -1 : 0, pool.map((a) => last(a)[0]).sort().pop());
      }
      const sum = out.reduce((t, r) => t + r.punkte, 0);
      out.push({ faktor: 'Gesamt', wert: sum, text: sum >= 2 ? 'freundlich' : sum <= -2 ? 'angespannt' : 'gemischt', punkte: sum, stand: out.map((r) => r.stand).sort().pop() });
      return out;
    },
  });

  dash.calc('stimmung_lage', {
    title: 'Stimmung und Kredit',
    description: 'Aus der Marktdaten-App: Kredit-Spread (Investment Grade), Zinserwartung (2-jährige Rendite minus Leitzins) und Gewinnmitnahmen der Bitcoin-Langzeithalter (LTH-SOPR) gegenüber ihrem Mittel im letzten Jahr (in Standardabweichungen), dazu Fear & Greed für Krypto und Aktien. Dazu die Veränderung der Netto-Liquidität der US-Notenbank über 12 Wochen (ab ±2 % ein Punkt). Punkte nur für Kennzahlen, die im Test der App über Jahre und auf neuen Daten gehalten haben; Fear & Greed zählt nur als Info.',
    inputs: ['stimmung'],
    fn: (stimmung) => {
      const by = {};
      for (const r of stimmung) { const v = Number(r.wert); if (Number.isFinite(v)) (by[r.faktor] = by[r.faktor] || []).push([r.date, v]); }
      const out = [];
      const z = (k) => { const s = (by[k] || []).sort((p, q) => (p[0] < q[0] ? -1 : 1)); if (s.length < 60) return null; const v = s.map((x) => x[1]), m = v.reduce((t, x) => t + x, 0) / v.length, sd = Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / (v.length - 1)); const L = s[s.length - 1]; return { wert: L[1], stand: L[0], z: sd > 0 ? (L[1] - m) / sd : 0, mittel: m }; };
      const add = (faktor, k, dir, hoch, tief, mitte, einheit) => { const x = z(k); if (!x) return; const p = x.z >= 0.5 ? dir : x.z <= -0.5 ? -dir : 0; out.push({ faktor, wert: x.wert, einheit, z: Math.round(x.z * 100) / 100, text: x.z >= 0.5 ? hoch : x.z <= -0.5 ? tief : mitte, punkte: p, stand: x.stand }); };
      add('Kredit-Spread (Investment Grade)', 'IG_SPREAD', 1, 'höher als im Jahresmittel: danach lief es im Test eher besser', 'niedriger als im Jahresmittel: danach eher schwächer', 'etwa im Jahresmittel', 'Pp.');
      add('Zinserwartung (2 J. minus Leitzins)', 'ZINSERWARTUNG', -1, 'höher als im Jahresmittel: Markt erwartet steigende Zinsen (Gegenwind)', 'niedriger als im Jahresmittel: eher Zinssenkungen erwartet (Rückenwind)', 'etwa im Jahresmittel', 'Pp.');
      add('Bitcoin-Langzeithalter (LTH-SOPR)', 'LTH_SOPR', -1, 'mehr Gewinnmitnahmen als im Jahresmittel (Gegenwind für Bitcoin)', 'weniger Gewinnmitnahmen als im Jahresmittel (Rückenwind)', 'etwa im Jahresmittel', '');
      const n12 = (by.NETTO_LIQ_12W || []).sort((p, q) => (p[0] < q[0] ? -1 : 1)).pop();
      if (n12) { const ch = n12[1] / 100; out.push({ faktor: 'Netto-Liquidität der US-Notenbank, 12 Wochen', wert: ch, einheit: '%', z: null, text: ch > 0.02 ? 'steigt (Rückenwind vor allem für Krypto)' : ch < -0.02 ? 'sinkt (Gegenwind vor allem für Krypto)' : 'kaum verändert', punkte: ch > 0.02 ? 1 : ch < -0.02 ? -1 : 0, stand: n12[0] }); }
      for (const [k, f] of [['FNG_KRYPTO', 'Fear & Greed Krypto'], ['FNG_AKTIEN', 'Fear & Greed Aktien']]) { const x = z(k); if (x) out.push({ faktor: f, wert: x.wert, einheit: '', z: Math.round(x.z * 100) / 100, text: (x.wert < 25 ? 'große Angst' : x.wert < 45 ? 'Angst' : x.wert <= 55 ? 'neutral' : x.wert <= 75 ? 'Gier' : 'große Gier') + ', nur Info', punkte: 0, stand: x.stand }); }
      return out;
    },
  });

  dash.calc('rsi_test', {
    title: 'Was nach einem hohen RSI passierte',
    description: 'Hauptwerte und Beobachtungsliste seit 2020: Veränderung 20 Kurstage später an allen Tagen und an Tagen mit RSI (14, Wilder) ab 70, getrennt nach Krypto und übrigen Werten. Kein Blick in die Zukunft beim RSI.',
    inputs: ['kurse_usd', 'kurse_beob'],
    fn: (kurse_usd, kurse_beob) => {
      const CRY = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'BNB'];
      const by = {};
      for (const r of kurse_usd.concat(kurse_beob)) { const c = Number(r.close); if (c > 0) (by[r.asset] = by[r.asset] || []).push([r.date, c]); }
      const acc = {};
      const put = (g, f, v) => { const k = g + '|' + f; (acc[k] = acc[k] || []).push(v); };
      for (const a of Object.keys(by)) {
        const s = by[a].sort((p, q) => (p[0] < q[0] ? -1 : 1)), c = s.map((x) => x[1]), g = CRY.includes(a) ? 'Krypto' : 'Aktien, Indizes, Metalle';
        let ag = 0, al = 0;
        for (let i = 1; i < c.length; i++) {
          const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
          if (i <= 14) { ag += up / 14; al += dn / 14; } else { ag = (ag * 13 + up) / 14; al = (al * 13 + dn) / 14; }
          if (i < 15 || i + 20 >= c.length) continue;
          const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al), f = c[i + 20] / c[i] - 1;
          put(g, 'alle Tage', f); if (rsi >= 70) put(g, 'RSI ab 70', f);
        }
      }
      return Object.keys(acc).sort().map((k) => { const v = acc[k].slice().sort((p, q) => p - q), [gruppe, fall] = k.split('|'); return { gruppe, fall, n: v.length, schnitt: Math.round((v.reduce((t, x) => t + x, 0) / v.length) * 1e4) / 1e4, median: Math.round(v[Math.floor(v.length / 2)] * 1e4) / 1e4, plus: Math.round((v.filter((x) => x > 0).length / v.length) * 1e3) / 1e3 }; });
    },
  });

  dash.calc('stopp_test', {
    title: 'Ausstiegsregeln mit Bitpanda-Kosten',
    description: 'Krypto seit 2020 mit 1.000 € Start: Halten gegen vier Ausstiegsregeln. Signal zum Schlusskurs, gehandelt zum Schlusskurs des Folgetags, mit Bitpanda-Aufschlag beim Kauf und Abschlag beim Verkauf aus den Werten. Steuer: 27,5 % auf Gewinne beim Verkauf, mit Verlustausgleich im selben Kalenderjahr, am Ende wird alles verkauft. Kursbasis: Ampel-Serie in Euro.',
    inputs: ['ampel_serie', 'werte'],
    fn: (ampel_serie, werte) => {
      const W = Object.fromEntries(werte.map((w) => [w.asset, w]));
      const by = {};
      for (const r of ampel_serie) if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].includes(r.asset)) (by[r.asset] = by[r.asset] || []).push(r);
      const RULES = [['halten', 'Kaufen und halten'], ['rot', 'Raus bei Rot, wieder rein sobald nicht mehr Rot'], ['rot_gruen', 'Raus bei Rot, wieder rein erst bei Grün'], ['stopp25', 'Raus 25 % unter dem Hoch, wieder rein bei Grün'], ['ma200', 'Raus unter der 200-Tage-Linie, rein darüber']];
      const out = [];
      for (const a of Object.keys(by)) {
        const x = by[a].sort((p, q) => (p.date < q.date ? -1 : 1)), fb = Number(W[a] ? W[a].aufschlag_kauf : 0.0199), fs = Number(W[a] ? W[a].abschlag_verkauf : 0.0199);
        const ma = x.map((v, i) => (i >= 199 ? x.slice(i - 199, i + 1).reduce((t, w) => t + w.c, 0) / 200 : null));
        for (const [id, label] of RULES) {
          for (const mitKosten of [true, false]) {
            let cash = 1000, units = 0, basis = 0, inv = false, peak = 0, trades = 0, tage = 0, hi = 1000, mdd = 0, year = null, gain = 0, paid = 0;
            const buy = (p) => { const net = mitKosten ? cash / (1 + fb) : cash; units = net / p; basis = cash; cash = 0; inv = true; peak = p; trades++; };
            const sell = (p, d) => { const gross = units * p * (mitKosten ? 1 - fs : 1); const y = d.slice(0, 4); if (y !== year) { year = y; gain = 0; paid = 0; } gain += gross - basis; const due = mitKosten ? Math.max(0, gain) * 0.275 : 0; cash = gross - (due - paid); paid = due; units = 0; inv = false; trades++; };
            buy(x[0].c);
            for (let i = 1; i < x.length; i++) {
              const p = x[i].c, prev = x[i - 1];
              if (inv) { peak = Math.max(peak, p); tage++; }
              let want = inv;
              if (id === 'rot') want = prev.ampel !== 'rot';
              if (id === 'rot_gruen') want = inv ? prev.ampel !== 'rot' : prev.ampel === 'gruen';
              if (id === 'stopp25') want = inv ? prev.c > peak * 0.75 : prev.ampel === 'gruen';
              if (id === 'ma200') want = ma[i - 1] == null ? inv : prev.c > ma[i - 1];
              if (id !== 'halten' && want !== inv) { if (want) buy(p); else sell(p, x[i].date); }
              const val = inv ? units * p : cash; hi = Math.max(hi, val); mdd = Math.min(mdd, val / hi - 1);
            }
            const L = x[x.length - 1];
            if (inv) sell(L.c, L.date);
            const jahre = (Date.parse(L.date) - Date.parse(x[0].date)) / (365.25 * 864e5);
            if (mitKosten) out.push({ asset: a, regel: id, label, endwert: Math.round(cash * 100) / 100, pro_jahr: Math.round((Math.pow(cash / 1000, 1 / jahre) - 1) * 1e4) / 1e4, groesster_rueckgang: Math.round(mdd * 1e4) / 1e4, wechsel: trades, investiert: Math.round((tage / (x.length - 1)) * 1e3) / 1e3, von: x[0].date, bis: L.date });
            else out[out.length - 1].endwert_ohne = Math.round(cash * 100) / 100;
          }
        }
      }
      return out;
    },
  });

  dash.calc('gesamtbild', {
    title: 'Gesamtbild aus Trend und Umfeld',
    description: 'Zwei unabhängige Säulen je Wert: Trend = Ampel aus den eigenen Kursen (grün +1, gelb 0, rot −1); Umfeld = Punkte der Marktlage (Krypto mit den Krypto-Faktoren Bitcoin-200-Tage-Linie, Langzeithalter und Netto-Liquidität, alle anderen ohne diese), ab +2 Rückenwind, ab −2 Gegenwind. Einig, wenn beide Säulen in dieselbe Richtung zeigen. 200-Tage-Linie und Abstand zum 52-Wochen-Hoch nur als Chart-Info.',
    inputs: ['ampel_alle', 'marktlage', 'stimmung_lage'],
    fn: (ampel_alle, marktlage, stimmung_lage) => {
      const fac = marktlage.filter((r) => r.faktor !== 'Gesamt').concat(stimmung_lage);
      const cryOnly = (f) => /^Bitcoin|Netto-Liquidität/.test(f);
      const uK = fac.reduce((t, r) => t + r.punkte, 0), uA = fac.filter((r) => !cryOnly(r.faktor)).reduce((t, r) => t + r.punkte, 0);
      const out = [];
      for (const r of ampel_alle) {
        if (r.src === 'welt' || !r.ampel || r.ampel === 'kurz') continue;
        const tr = r.ampel === 'gruen' ? 1 : r.ampel === 'rot' ? -1 : 0, u = r.krypto ? uK : uA, um = u >= 2 ? 1 : u <= -2 ? -1 : 0;
        const k = tr === 1 && um === 1 ? 'einig aufwärts' : tr === -1 && um === -1 ? 'einig abwärts' : tr * um === -1 ? 'uneinig' : 'offen';
        out.push({ asset: r.asset, name: r.name, krypto: r.krypto, ampel: r.ampel, trend: tr, umfeld_punkte: u, umfeld: um, konsens: k, d200: r.d200 == null ? null : r.d200, h52: r.h52 == null ? null : r.h52, date: r.date });
      }
      return out;
    },
  });

  dash.calc('konjunktur_ampel', {
    title: 'Konjunktur-Vorzeichen',
    description: 'Fünf Vorzeichen für einen Abschwung in den USA: Zinskurve 10 Jahre minus 3 Monate (unter 0 Warnung, unter 0,5 Achtung), Sahm-Regel (ab 0,5 Warnung, ab 0,3 Achtung), Einkaufsmanager-Index ISM Industrie (unter 48 Warnung, unter 50 Achtung), Anstieg des High-Yield-Kredit-Spreads über 3 Monate (ab 1,0 Pp. Warnung, ab 0,5 Achtung) und Netto-Liquidität über 12 Wochen (unter −5 % Warnung, unter −2 % Achtung). Bewertung (CAPE) nur als Info. Ab 3 Warnungen hoch, ab 2 Warnungen oder 1 Warnung plus 2 Achtung erhöht, sonst ruhig.',
    inputs: ['konjunktur', 'stimmung'],
    fn: (konjunktur, stimmung) => {
      const K = Object.fromEntries(konjunktur.map((r) => [r.faktor, r]));
      const out = [];
      const add = (faktor, wert, stand, stufe, text, quelle) => out.push({ faktor, wert, stand, stufe, text, quelle });
      if (K.T10Y3M) { const v = Number(K.T10Y3M.wert); add('Zinskurve 10 J. minus 3 Mon.', v, K.T10Y3M.stand, v < 0 ? 2 : v < 0.5 ? 1 : 0, v < 0 ? 'invertiert: ging Rezessionen meist 6–18 Monate voraus' : v < 0.5 ? 'flach' : 'normal, steigend', K.T10Y3M.quelle); }
      if (K.SAHM) { const v = Number(K.SAHM.wert); add('Arbeitsmarkt (Sahm-Regel)', v, K.SAHM.stand, v >= 0.5 ? 2 : v >= 0.3 ? 1 : 0, v >= 0.5 ? 'ausgelöst: Rezession meist schon im Gang' : v >= 0.3 ? 'nähert sich der Schwelle' : 'unauffällig', K.SAHM.quelle); }
      if (K.ISM) { const v = Number(K.ISM.wert); add('Einkaufsmanager Industrie (ISM)', v, K.ISM.stand, v < 48 ? 2 : v < 50 ? 1 : 0, v < 48 ? 'deutlich schrumpfend' : v < 50 ? 'leicht schrumpfend' : 'wachsend', K.ISM.quelle); }
      const hy = stimmung.filter((r) => r.faktor === 'HY_SPREAD').map((r) => [r.date, Number(r.wert)]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
      if (hy.length > 70) { const L = hy[hy.length - 1], cut = new Date(Date.parse(L[0] + 'T00:00:00Z') - 91 * 864e5).toISOString().slice(0, 10); let b = null; for (const x of hy) { if (x[0] <= cut) b = x; else break; } if (b) { const d = L[1] - b[1]; add('Kredit-Spread High Yield, 3 Monate', d, L[0], d >= 1 ? 2 : d >= 0.5 ? 1 : 0, d >= 1 ? 'weitet sich deutlich aus' : d >= 0.5 ? 'weitet sich aus' : 'ruhig', 'Marktdaten-App (FRED ICE BofA)'); } }
      const nl = stimmung.filter((r) => r.faktor === 'NETTO_LIQ_12W').map((r) => [r.date, Number(r.wert)]).sort((p, q) => (p[0] < q[0] ? -1 : 1)).pop();
      if (nl) { const v = nl[1] / 100; add('Netto-Liquidität der US-Notenbank, 12 Wochen', v, nl[0], v < -0.05 ? 2 : v < -0.02 ? 1 : 0, v < -0.05 ? 'sinkt stark' : v < -0.02 ? 'sinkt' : 'stabil oder steigend', 'Marktdaten-App (FRED)'); }
      const w = out.filter((r) => r.stufe === 2).length, a = out.filter((r) => r.stufe === 1).length;
      out.push({ faktor: 'Gesamt', wert: w, stand: out.map((r) => r.stand).sort().pop(), stufe: w >= 3 ? 2 : w >= 2 || (w >= 1 && a >= 2) ? 1 : 0, text: (w >= 3 ? 'hoch' : w >= 2 || (w >= 1 && a >= 2) ? 'erhöht' : 'ruhig') + ` (${w} Warnung${w === 1 ? '' : 'en'}, ${a} Achtung)`, quelle: '' });
      if (K.CAPE) out.push({ faktor: 'Bewertung (Shiller-KGV, CAPE)', wert: Number(K.CAPE.wert), stand: K.CAPE.stand, stufe: null, text: 'nur Info, sagt etwas über 10 Jahre, nicht über die nächsten Monate', quelle: K.CAPE.quelle });
      return out;
    },
  });

  dash.calc('rezession_rueckblick', {
    title: 'Aktien rund um Rezessionen',
    description: 'S&P 500 (Monatsdurchschnitte, ohne Dividenden, nominal) rund um jede US-Rezession seit 1929 nach den Datierungen des NBER: Veränderung in den 12 Monaten vor Beginn, in den 12 und 24 Monaten ab Beginn, größter Rückgang vom Hoch der 12 Monate davor und Monate bis das alte Hoch wieder erreicht war.',
    inputs: ['langzeit_sp', 'rezessionen'],
    fn: (langzeit_sp, rezessionen) => {
      const s = langzeit_sp.map((r) => [r.date, Number(r.sp500)]).filter((x) => x[1] > 0).sort((p, q) => (p[0] < q[0] ? -1 : 1));
      const idx = Object.fromEntries(s.map((x, i) => [x[0], i]));
      const out = [];
      for (const r of rezessionen) {
        const i = idx[r.beginn]; if (i == null || i < 12) continue;
        const at = (k) => (s[i + k] ? s[i + k][1] : null);
        const pre = s[i][1] / s[i - 12][1] - 1, p12 = at(12) ? at(12) / s[i][1] - 1 : null, p24 = at(24) ? at(24) / s[i][1] - 1 : null;
        let hi = 0, hiI = i - 12; for (let k = i - 12; k <= i; k++) if (s[k][1] > hi) { hi = s[k][1]; hiI = k; }
        let lo = hi, loI = hiI; for (let k = hiI; k < Math.min(s.length, i + 48); k++) if (s[k][1] < lo) { lo = s[k][1]; loI = k; }
        let rec = null; for (let k = loI; k < s.length; k++) if (s[k][1] >= hi) { rec = k - hiI; break; }
        out.push({ beginn: r.beginn, ende: r.ende, vorher_12m: Math.round(pre * 1e3) / 1e3, nach_12m: p12 == null ? null : Math.round(p12 * 1e3) / 1e3, nach_24m: p24 == null ? null : Math.round(p24 * 1e3) / 1e3, rueckgang: Math.round((lo / hi - 1) * 1e3) / 1e3, tief: s[loI][0], monate_bis_hoch: rec });
      }
      return out;
    },
  });

  dash.calc('cape_rueckblick', {
    title: 'Bewertung und die folgenden 10 Jahre',
    description: 'Monatliche Shiller-KGV-Werte (CAPE) seit 1881 bis 09/2016, gruppiert nach Höhe, und die reale Kursentwicklung des S&P 500 in den folgenden 10 Jahren pro Jahr (inflationsbereinigt mit dem US-Verbraucherpreisindex, ohne Dividenden). Dazu der heutige CAPE-Wert.',
    inputs: ['langzeit_sp', 'konjunktur'],
    fn: (langzeit_sp, konjunktur) => {
      const s = langzeit_sp.map((r) => ({ d: r.date, p: Number(r.sp500), c: Number(r.cpi), pe: r.pe10 === '' ? null : Number(r.pe10) })).filter((x) => x.p > 0 && x.c > 0).sort((a, b) => (a.d < b.d ? -1 : 1));
      const B = [[0, 10, 'unter 10'], [10, 15, '10 bis 15'], [15, 20, '15 bis 20'], [20, 25, '20 bis 25'], [25, 30, '25 bis 30'], [30, 999, 'über 30']];
      const acc = B.map((b) => ({ von: b[0], bis: b[1], label: b[2], v: [] }));
      for (let i = 0; i + 120 < s.length; i++) { const x = s[i]; if (x.pe == null || x.pe <= 0) continue; const y = s[i + 120]; const r = Math.pow((y.p / y.c) / (x.p / x.c), 1 / 10) - 1; const b = acc.find((q) => x.pe >= q.von && x.pe < q.bis); if (b) b.v.push(r); }
      const cur = konjunktur.find((r) => r.faktor === 'CAPE'), cv = cur ? Number(cur.wert) : null;
      return acc.filter((b) => b.v.length).map((b) => { const v = b.v.slice().sort((p, q) => p - q), q = (f) => v[Math.floor(f * (v.length - 1))]; return { gruppe: b.label, monate: v.length, schnitt: Math.round((v.reduce((t, x) => t + x, 0) / v.length) * 1e4) / 1e4, schlecht: Math.round(q(0.1) * 1e4) / 1e4, gut: Math.round(q(0.9) * 1e4) / 1e4, heute: cv != null && cv >= b.von && cv < b.bis, cape_heute: cv, stand: cur ? cur.stand : null }; });
    },
  });

  dash.calc('rueckgaenge_lang', {
    title: 'Große Rückgänge seit 1928',
    description: 'Alle Rückgänge des S&P 500 (Monatsdurchschnitte, nominal, ohne Dividenden) um 20 % oder mehr seit 1928: Hoch, Tief, Tiefe, Monate bis zum Tief und bis das alte Hoch wieder erreicht war. Dazu der aktuelle Abstand zum Hoch aus den Tageskursen.',
    inputs: ['langzeit_sp', 'kurse_usd'],
    fn: (langzeit_sp, kurse_usd) => {
      const s = langzeit_sp.map((r) => [r.date, Number(r.sp500)]).filter((x) => x[1] > 0 && x[0] >= '1928-01').sort((p, q) => (p[0] < q[0] ? -1 : 1));
      const out = []; let pk = 0, pkI = 0, lo = Infinity, loI = 0, inDD = false;
      for (let i = 0; i < s.length; i++) {
        const v = s[i][1];
        if (v >= pk) { if (inDD && lo / pk - 1 <= -0.2) out.push({ hoch: s[pkI][0], tief: s[loI][0], tiefe: Math.round((lo / pk - 1) * 1e3) / 1e3, monate_fall: loI - pkI, monate_erholung: i - pkI, erholt: s[i][0] }); pk = v; pkI = i; lo = Infinity; inDD = false; }
        else { inDD = true; if (v < lo) { lo = v; loI = i; } }
      }
      if (inDD && lo / pk - 1 <= -0.2) out.push({ hoch: s[pkI][0], tief: s[loI][0], tiefe: Math.round((lo / pk - 1) * 1e3) / 1e3, monate_fall: loI - pkI, monate_erholung: null, erholt: null });
      const d = kurse_usd.filter((r) => r.asset === 'SPX' && Number(r.close) > 0).map((r) => [r.date, Number(r.close)]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
      if (d.length) { const L = d[d.length - 1], H = Math.max(...d.map((x) => x[1])); out.push({ hoch: 'heute', tief: L[0], tiefe: Math.round((L[1] / H - 1) * 1e3) / 1e3, monate_fall: null, monate_erholung: null, erholt: null }); }
      return out;
    },
  });

  dash.calc('spaetzyklus', {
    title: 'Spätzyklus-Check',
    description: 'Drei Messpunkte (Marktbreite gegen Index, Ölpreis mit Zinserwartung, Zuflüsse in US-Bitcoin-ETFs über 20 Handelstage) und die sechs Stufen des typischen Ablaufs vor früheren Abschwüngen: Notenbank strafft (Zinserwartung über 0,25 Pp.), Zinskurve flach (10 J. minus 3 Mon. unter 0,5), Kredit-Spreads weiten sich (High Yield +0,5 Pp. in 3 Monaten), Industrie schrumpft (ISM unter 50), Arbeitsmarkt kippt (Sahm ab 0,3), Aktien im Bärenmarkt (S&P 500 20 % unter Hoch).',
    inputs: ['marktlage', 'stimmung', 'kurse_welt', 'konjunktur', 'rueckgaenge_lang'],
    fn: (marktlage, stimmung, kurse_welt, konjunktur, rueckgaenge_lang) => {
      const f2 = (v, d) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }), sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');
      const ser = (f) => stimmung.filter((r) => r.faktor === f).map((r) => [r.date, Number(r.wert)]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
      const back = (s, days) => { if (!s.length) return null; const L = s[s.length - 1][0], cut = new Date(Date.parse(L + 'T00:00:00Z') - days * 864e5).toISOString().slice(0, 10); let b = null; for (const x of s) { if (x[0] <= cut) b = x; else break; } return b; };
      const K = Object.fromEntries(konjunktur.map((r) => [r.faktor, Number(r.wert)]));
      const spx = rueckgaenge_lang.find((r) => r.hoch === 'heute'), br = marktlage.find((r) => /^Breite/.test(r.faktor));
      const ze = ser('ZINSERWARTUNG'), hy = ser('HY_SPREAD'), etf = ser('BTC_ETF_FLUSS');
      const wti = kurse_welt.filter((r) => r.asset === 'WTI' && Number(r.close) > 0).map((r) => [r.date, Number(r.close)]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
      const out = [];
      if (spx && br) { const d = spx.tiefe, b = br.wert; out.push({ art: 'punkt', name: 'Marktbreite gegen Index', wert: `S&P 500 ${sgn(d)}${f2(Math.abs(d) * 100, 1)} % vom Hoch, ${Math.round(b * 100)} % der Werte über 200-Tage-Linie`, stufe: d > -0.05 && b < 0.5 ? 2 : d > -0.05 && b < 0.6 ? 1 : 0, text: d > -0.05 && b < 0.6 ? 'Index nahe Rekord, aber viele Werte schwach: wenige Titel tragen den Markt' : 'Index und Breite passen zusammen' }); }
      if (wti.length && ze.length) { const w = wti[wti.length - 1][1], wb = back(wti, 91), z = ze[ze.length - 1][1], ch = wb ? w / wb[1] - 1 : null, hi = w > 100, zh = z > 0.5; out.push({ art: 'punkt', name: 'Ölpreis und Zinserwartung', wert: `WTI ${f2(w, 0)} $${ch == null ? '' : ' (' + sgn(ch) + f2(Math.abs(ch) * 100, 0) + ' % in 3 Mon.)'}, Zinserwartung ${sgn(z)}${f2(Math.abs(z), 2)} Pp.`, stufe: hi && zh ? 2 : hi || zh ? 1 : 0, text: hi && zh ? 'teure Energie und erwartete Zinserhöhungen zugleich: Kostendruck' : hi || zh ? 'einer der beiden Druckfaktoren aktiv' : 'kein Kostendruck' }); }
      if (etf.length >= 20) { const t20 = etf.slice(-20).reduce((t, x) => t + x[1], 0); out.push({ art: 'punkt', name: 'Zuflüsse US-Bitcoin-ETFs, 20 Handelstage', wert: `${sgn(t20)}${f2(Math.abs(Math.round(t20)), 0)} Mio. $`, stufe: t20 < -2000 ? 2 : t20 < 0 ? 1 : 0, text: t20 < -2000 ? 'deutliche Abflüsse' : t20 < 0 ? 'Abflüsse' : 'Zuflüsse', stand: etf[etf.length - 1][0] }); }
      const hyb = back(hy, 91), hyd = hy.length && hyb ? hy[hy.length - 1][1] - hyb[1] : null;
      const steps = [
        ['Notenbank strafft', ze.length ? ze[ze.length - 1][1] > 0.25 : null, ze.length ? `Zinserwartung ${sgn(ze[ze.length - 1][1])}${f2(Math.abs(ze[ze.length - 1][1]), 2)} Pp.` : ''],
        ['Zinskurve flach oder invertiert', K.T10Y3M != null ? K.T10Y3M < 0.5 : null, K.T10Y3M != null ? `10 J. minus 3 Mon. ${sgn(K.T10Y3M)}${f2(Math.abs(K.T10Y3M), 2)} Pp.` : ''],
        ['Kredit-Spreads weiten sich', hyd != null ? hyd >= 0.5 : null, hyd != null ? `High Yield ${sgn(hyd)}${f2(Math.abs(hyd), 2)} Pp. in 3 Mon.` : ''],
        ['Industrie schrumpft', K.ISM != null ? K.ISM < 50 : null, K.ISM != null ? `ISM ${f2(K.ISM, 1)}` : ''],
        ['Arbeitsmarkt kippt', K.SAHM != null ? K.SAHM >= 0.3 : null, K.SAHM != null ? `Sahm ${f2(K.SAHM, 2)}` : ''],
        ['Aktien im Bärenmarkt', spx ? spx.tiefe <= -0.2 : null, spx ? `S&P 500 ${sgn(spx.tiefe)}${f2(Math.abs(spx.tiefe) * 100, 1)} % vom Hoch` : ''],
      ];
      steps.forEach((x, i) => out.push({ art: 'stufe', nr: i + 1, name: x[0], erreicht: x[1], wert: x[2] }));
      return out;
    },
  });

  dash.calc('aktien_gold', {
    title: 'S&P 500 in Gold gemessen',
    description: 'Monatsdurchschnitt des S&P 500 geteilt durch den Goldpreis in US-Dollar je Feinunze (Monatswerte) seit 1871, dazu der heutige Wert aus den Tageskursen. Hoch- und Tiefpunkte = höchster bzw. tiefster Wert im Umkreis von 8 Jahren. Bis 1933 war der Goldpreis staatlich festgelegt.',
    inputs: ['langzeit_sp', 'gold_lang', 'kurse_usd'],
    fn: (langzeit_sp, gold_lang, kurse_usd) => {
      const G = Object.fromEntries(gold_lang.map((r) => [r.date, Number(r.gold)]));
      const s = langzeit_sp.map((r) => [r.date, Number(r.sp500)]).filter((x) => x[1] > 0 && G[x[0]] > 0).sort((p, q) => (p[0] < q[0] ? -1 : 1)).map((x) => ({ date: x[0], ratio: Math.round((x[1] / G[x[0]]) * 1e4) / 1e4, art: '' }));
      const W = 96;
      for (let i = 0; i < s.length; i++) {
        const win = s.slice(Math.max(0, i - W), Math.min(s.length, i + W + 1)).map((x) => x.ratio), v = s[i].ratio;
        if (v === Math.max(...win) && i > 12 && i < s.length - 12) s[i].art = 'hoch';
        else if (v === Math.min(...win) && i > 12 && i < s.length - 12) s[i].art = 'tief';
      }
      const by = {};
      for (const r of kurse_usd) if ((r.asset === 'SPX' || r.asset === 'GOLD') && Number(r.close) > 0) (by[r.date] = by[r.date] || {})[r.asset] = Number(r.close);
      const d = Object.keys(by).filter((k) => by[k].SPX && by[k].GOLD).sort().pop();
      if (d) s.push({ date: d, ratio: Math.round((by[d].SPX / by[d].GOLD) * 1e4) / 1e4, art: 'heute' });
      return s;
    },
  });

  dash.calc('btc_gold', {
    title: 'Bitcoin in Gold gemessen',
    description: 'Bitcoin-Schlusskurs geteilt durch den Goldpreis (Future, US-Dollar je Feinunze) an gemeinsamen Handelstagen seit 2020, je Monat der letzte Wert, dazu der jüngste Tag. Hoch und Tief = höchster bzw. tiefster Monatswert im Umkreis von 12 Monaten.',
    inputs: ['kurse_usd'],
    fn: (kurse_usd) => {
      const by = {};
      for (const r of kurse_usd) if ((r.asset === 'BTC' || r.asset === 'GOLD') && Number(r.close) > 0) (by[r.date] = by[r.date] || {})[r.asset] = Number(r.close);
      const days = Object.keys(by).filter((d) => by[d].BTC && by[d].GOLD).sort();
      const mon = {};
      for (const d of days) mon[d.slice(0, 7)] = { date: d, ratio: Math.round((by[d].BTC / by[d].GOLD) * 1e3) / 1e3, art: '' };
      const s = Object.values(mon).sort((a, b) => (a.date < b.date ? -1 : 1));
      for (let i = 0; i < s.length; i++) { const w = s.slice(Math.max(0, i - 12), Math.min(s.length, i + 13)).map((x) => x.ratio); if (i > 2 && i < s.length - 3) { if (s[i].ratio === Math.max(...w)) s[i].art = 'hoch'; else if (s[i].ratio === Math.min(...w)) s[i].art = 'tief'; } }
      if (s.length) s[s.length - 1].art = 'heute';
      return s;
    },
  });

  dash.calc('sparplan_baer', {
    title: 'Bitcoin-Sparplan durch den Bärenmarkt',
    description: '25 € alle 14 Tage in Bitcoin (Euro-Kurs, Bitpanda-Aufschlag beim Kauf aus den Werten), gestartet zu vier Zeitpunkten: Beginn der Daten (01/2020), am Rekordhoch 2021, mitten im Absturz (06/2022) und am Tief 2022. Je Start: eingezahlt, Wert heute, tiefster Zwischenstand gegenüber dem Eingezahlten, Monate bis dauerhaft wieder im Plus, und zum Vergleich: Weiterkaufen am Tief 2022 eingestellt, Bestand gehalten. Ohne Steuern.',
    inputs: ['kurse', 'werte'],
    fn: (kurse, werte) => {
      const s = kurse.filter((r) => r.asset === 'BTC' && Number(r.close) > 0).map((r) => [r.date, Number(r.close)]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
      if (s.length < 400) return [];
      const W = werte.find((w) => w.asset === 'BTC'), fee = W ? Number(W.aufschlag_kauf) : 0.0149;
      const in21 = s.filter((x) => x[0] < '2022-01-01'), ath = in21.reduce((m, x) => (x[1] > m[1] ? x : m)), in22 = s.filter((x) => x[0] >= '2022-01-01' && x[0] < '2023-06-01'), low = in22.reduce((m, x) => (x[1] < m[1] ? x : m));
      const starts = [['Beginn der Daten', s[0][0]], ['Am Rekordhoch 2021', ath[0]], ['Mitten im Absturz', '2022-06-15'], ['Am Tief 2022', low[0]]];
      const L = s[s.length - 1], out = [];
      for (const [label, st] of starts) {
        let units = 0, paid = 0, unitsStop = 0, paidStop = 0, worst = 0, plusSeit = null, next = Date.parse(st + 'T00:00:00Z');
        const serie = [];
        for (const [d, p] of s) {
          if (d < st) continue;
          const t = Date.parse(d + 'T00:00:00Z');
          if (t >= next) { units += 25 / (1 + fee) / p; paid += 25; if (d <= low[0]) { unitsStop += 25 / (1 + fee) / p; paidStop += 25; } next += 14 * 864e5; }
          const v = units * p, r = v / paid - 1;
          worst = Math.min(worst, r);
          if (r >= 0) { if (plusSeit === null) plusSeit = d; } else plusSeit = null;
          if (d.slice(8) <= '07' && (serie.length === 0 || serie[serie.length - 1].m !== d.slice(0, 7))) serie.push({ m: d.slice(0, 7), eingezahlt: paid, wert: Math.round(v * 100) / 100 });
        }
        const wert = units * L[1];
        const monate = plusSeit ? Math.round((Date.parse(plusSeit + 'T00:00:00Z') - Date.parse(st + 'T00:00:00Z')) / (30.44 * 864e5)) : null;
        out.push({ start: label, startdatum: st, startkurs: Math.round(s.find((x) => x[0] >= st)[1]), eingezahlt: paid, wert: Math.round(wert * 100) / 100, ergebnis: Math.round((wert / paid - 1) * 1e3) / 1e3, tiefster: Math.round(worst * 1e3) / 1e3, plus_seit: plusSeit, monate_bis_plus: worst < 0 ? monate : 0, gestoppt_eingezahlt: st <= low[0] ? paidStop : null, gestoppt_wert: st <= low[0] ? Math.round(unitsStop * L[1] * 100) / 100 : null, stand: L[0], serie: label === 'Am Rekordhoch 2021' ? JSON.stringify(serie) : '' });
      }
      return out;
    },
  });

  dash.calc('euro_real', {
    title: '1.000 € seit 2021 in Euro, nach Inflation',
    description: '1.000 € am ersten Handelstag 2021 in Bitcoin, Gold, MSCI-World-ETF (EUNL) und S&P-500-ETF (SXR8), alles in Euro, oder auf dem Konto ohne Zinsen. Real = geteilt durch den österreichischen Verbraucherpreisindex (VPI 2020 = 100, Statistik Austria, Jänner 2021 = 100,3). Ohne Gebühren und Steuern. Monatswerte am Monatsanfang, dazu der jüngste Tag.',
    inputs: ['kurse', 'kurse_beob', 'vpi_at'],
    fn: (kurse, kurse_beob, vpi_at) => {
      const V = Object.fromEntries(vpi_at.map((r) => [r.date, Number(r.vpi)])), vm = Object.keys(V).sort(), v0 = V['2021-01'];
      const vAt = (d) => { let v = null; for (const m of vm) { if (m <= d.slice(0, 7)) v = V[m]; else break; } return v; };
      const ser = (rows, a) => rows.filter((r) => r.asset === a && Number(r.close) > 0).map((r) => [r.date, Number(r.close)]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
      const A = [['Bitcoin', ser(kurse, 'BTC')], ['Gold', ser(kurse, 'GOLD')], ['MSCI-World-ETF', ser(kurse_beob, 'EUNL')], ['S&P-500-ETF', ser(kurse_beob, 'SXR8')]];
      const out = [];
      const months = vm.filter((m) => m >= '2021-01');
      for (const [name, s] of A) {
        const st = s.find((x) => x[0] >= '2021-01-01'); if (!st) continue;
        const pt = (m) => { let v = null; for (const x of s) { if (x[0].slice(0, 7) <= m) v = x; else break; } return v; };
        for (const m of months) { const x = s.find((y) => y[0].slice(0, 7) === m); if (!x) continue; const nom = 1000 * x[1] / st[1]; out.push({ anlage: name, date: x[0], nominal: Math.round(nom * 100) / 100, real: Math.round((nom * v0 / V[m]) * 100) / 100 }); }
        const L = s[s.length - 1], vl = vAt(L[0]), nom = 1000 * L[1] / st[1];
        out.push({ anlage: name, date: L[0], nominal: Math.round(nom * 100) / 100, real: Math.round((nom * v0 / vl) * 100) / 100, letzter: 1 });
        void pt;
      }
      for (const m of months) out.push({ anlage: 'Konto ohne Zinsen', date: m + '-01', nominal: 1000, real: Math.round((1000 * v0 / V[m]) * 100) / 100 });
      const lm = months[months.length - 1];
      out.push({ anlage: 'Konto ohne Zinsen', date: lm + '-28', nominal: 1000, real: Math.round((1000 * v0 / V[lm]) * 100) / 100, letzter: 1 });
      return out;
    },
  });

  dash.calc('gleichlauf_btc', {
    title: 'Bitcoin im Gleichlauf mit Nasdaq und Gold',
    description: 'Korrelation der täglichen Renditen von Bitcoin mit dem Nasdaq 100 und mit Gold über die jeweils letzten 90 gemeinsamen Börsentage, einmal pro Monat berechnet, seit 2020. +1 = im Gleichschritt, 0 = unabhängig, −1 = gegenläufig.',
    inputs: ['kurse_usd', 'kurse_beob'],
    fn: (kurse_usd, kurse_beob) => {
      const by = {};
      for (const r of kurse_usd.concat(kurse_beob)) if (['BTC', 'GOLD', 'NDX'].includes(r.asset) && Number(r.close) > 0) (by[r.date] = by[r.date] || {})[r.asset] = Number(r.close);
      const d = Object.keys(by).filter((k) => by[k].BTC && by[k].GOLD && by[k].NDX).sort();
      const ret = (a) => d.slice(1).map((k, i) => Math.log(by[k][a] / by[d[i]][a]));
      const b = ret('BTC'), n = ret('NDX'), g = ret('GOLD');
      const cor = (u, v) => { const mu = u.reduce((t, x) => t + x, 0) / u.length, mv = v.reduce((t, x) => t + x, 0) / v.length; let c = 0, su = 0, sv = 0; for (let i = 0; i < u.length; i++) { c += (u[i] - mu) * (v[i] - mv); su += (u[i] - mu) ** 2; sv += (v[i] - mv) ** 2; } return c / Math.sqrt(su * sv); };
      const out = []; let lastM = '';
      for (let i = 90; i <= b.length; i++) { const day = d[i], m = day.slice(0, 7); if (m === lastM && i !== b.length) continue; lastM = m; out.push({ date: day, nasdaq: Math.round(cor(b.slice(i - 90, i), n.slice(i - 90, i)) * 100) / 100, gold: Math.round(cor(b.slice(i - 90, i), g.slice(i - 90, i)) * 100) / 100 }); }
      return out;
    },
  });

  dash.calc('ki_zyklus', {
    title: 'KI-Zyklus-Monitor',
    description: 'Je KI-Wert (Halbleiter, große Cloud-Anbieter, Energie und Rohstoffe, neue Börsengänge) aus den Kursreihen der Marktdaten-App: Veränderung über 3 und 12 Monate, Abstand zur 200-Tage-Linie und zum Hoch. Dazu Rausch-Signale: Halbleiter-ETF über seiner 200-Tage-Linie (ab 12 % warm, ab 25 % heiß), Halbleiter gegen S&P 500 über 12 Monate (ab +10 % bzw. +30 %), Anteil der Chip- und Cloud-Werte über ihrer 200-Tage-Linie (ab 60 % bzw. 80 %), Zahl neuer KI-Börsengänge (weniger als ein Jahr Kurshistorie) und die Geldpolitik (Zinserwartung über 0 bzw. 0,25 Prozentpunkte).',
    inputs: ['kurse_ki', 'stimmung'],
    fn: (kurse_ki, stimmung) => {
      const GR = { SMH: 'Chips', NVDA: 'Chips', MU: 'Chips', AVGO: 'Chips', AMD: 'Chips', TSM: 'Chips', MSFT: 'Cloud', GOOGL: 'Cloud', META: 'Cloud', AMZN: 'Cloud', CCJ: 'Energie', URNM: 'Energie', 'HG=F': 'Energie', CBRS: 'Neu', SPCX: 'Neu', '^GSPC': 'Index', '^NDX': 'Index' };
      const NM = { SMH: 'Halbleiter-ETF', NVDA: 'Nvidia', MU: 'Micron', AVGO: 'Broadcom', AMD: 'AMD', TSM: 'TSMC', MSFT: 'Microsoft', GOOGL: 'Alphabet', META: 'Meta', AMZN: 'Amazon', CCJ: 'Cameco (Uran)', URNM: 'Uran-Minen-ETF', 'HG=F': 'Kupfer', CBRS: 'Cerebras', SPCX: 'SpaceX (inkl. xAI)', '^GSPC': 'S&P 500', '^NDX': 'Nasdaq 100' };
      const by = {};
      for (const r of kurse_ki) { const c = Number(r.close); if (c > 0) (by[r.asset] = by[r.asset] || []).push([r.date, c]); }
      const back = (s, days) => { const L = s[s.length - 1][0], cut = new Date(Date.parse(L + 'T00:00:00Z') - days * 864e5).toISOString().slice(0, 10); let b = null; for (const x of s) { if (x[0] <= cut) b = x; else break; } return b; };
      const out = [];
      for (const a of Object.keys(by)) {
        const s = by[a].sort((p, q) => (p[0] < q[0] ? -1 : 1)), L = s[s.length - 1], n = s.length;
        const ma = n >= 200 ? s.slice(-200).reduce((t, x) => t + x[1], 0) / 200 : null, b3 = back(s, 91), b12 = back(s, 365), hi = Math.max(...s.slice(-260).map((x) => x[1]));
        out.push({ art: 'wert', asset: a, name: NM[a] || a, gruppe: GR[a] || '', stand: L[0], tage: n, r3: b3 ? Math.round((L[1] / b3[1] - 1) * 1e3) / 1e3 : null, r12: b12 && n > 240 ? Math.round((L[1] / b12[1] - 1) * 1e3) / 1e3 : null, ma200: ma ? Math.round((L[1] / ma - 1) * 1e3) / 1e3 : null, hoch: Math.round((L[1] / hi - 1) * 1e3) / 1e3 });
      }
      const W = Object.fromEntries(out.map((r) => [r.asset, r]));
      const sig = [];
      const smh = W.SMH;
      if (smh && smh.ma200 != null) sig.push({ name: 'Halbleiter über ihrem Trend', wert: smh.ma200, einheit: '%', stufe: smh.ma200 >= 0.25 ? 2 : smh.ma200 >= 0.12 ? 1 : 0, text: 'Halbleiter-ETF gegenüber seiner 200-Tage-Linie' });
      if (by.SMH && by['^GSPC']) { const S = Object.fromEntries(by.SMH), P = Object.fromEntries(by['^GSPC']); const d = Object.keys(S).filter((k) => P[k]).sort(); const rs = d.map((k) => [k, S[k] / P[k]]); const b = back(rs, 365); if (b) { const v = rs[rs.length - 1][1] / b[1] - 1; sig.push({ name: 'Halbleiter laufen dem Markt davon', wert: v, einheit: '%', stufe: v >= 0.3 ? 2 : v >= 0.1 ? 1 : 0, text: 'Halbleiter-ETF gegenüber dem S&P 500, 12 Monate' }); }
        const base = rs.find((x) => x[0] >= rs[0][0]); const step = Math.max(1, Math.floor(rs.length / 120));
        for (let i = 0; i < rs.length; i += step) out.push({ art: 'rel', gruppe: 'Halbleiter', date: rs[i][0], wert: Math.round((rs[i][1] / base[1]) * 1e4) / 100 });
        out.push({ art: 'rel', gruppe: 'Halbleiter', date: rs[rs.length - 1][0], wert: Math.round((rs[rs.length - 1][1] / base[1]) * 1e4) / 100 });
        for (const [grp, list] of [['Cloud-Anbieter', ['MSFT', 'GOOGL', 'META', 'AMZN']], ['Energie und Rohstoffe', ['CCJ', 'URNM', 'HG=F']]]) {
          const ok2 = d.filter((k) => list.every((a) => by[a] && Object.fromEntries(by[a])[k]));
          const M = Object.fromEntries(list.map((a) => [a, Object.fromEntries(by[a])]));
          if (ok2.length < 50) continue;
          const val = (k) => list.reduce((t, a) => t + M[a][k] / M[a][ok2[0]], 0) / list.length / (P[k] / P[ok2[0]]);
          for (let i = 0; i < ok2.length; i += step) out.push({ art: 'rel', gruppe: grp, date: ok2[i], wert: Math.round(val(ok2[i]) * 1e4) / 100 });
          out.push({ art: 'rel', gruppe: grp, date: ok2[ok2.length - 1], wert: Math.round(val(ok2[ok2.length - 1]) * 1e4) / 100 });
        }
      }
      const core = out.filter((r) => r.art === 'wert' && (r.gruppe === 'Chips' || r.gruppe === 'Cloud') && r.ma200 != null);
      if (core.length) { const sh = core.filter((r) => r.ma200 > 0).length / core.length; sig.push({ name: 'Breite der KI-Rally', wert: sh, einheit: 'anteil', stufe: sh >= 0.8 ? 2 : sh >= 0.6 ? 1 : 0, text: 'Anteil der Chip- und Cloud-Werte über ihrer 200-Tage-Linie' }); }
      const ipo = out.filter((r) => r.art === 'wert' && r.tage < 250).length;
      sig.push({ name: 'Neue KI-Börsengänge', wert: ipo, einheit: 'anzahl', stufe: ipo >= 2 ? 1 : 0, text: 'Werte in der Liste mit weniger als einem Jahr Kurshistorie' });
      const ze = stimmung.filter((r) => r.faktor === 'ZINSERWARTUNG').map((r) => [r.date, Number(r.wert)]).sort((p, q) => (p[0] < q[0] ? -1 : 1)).pop();
      if (ze) sig.push({ name: 'Geldpolitik', wert: ze[1], einheit: 'Pp.', stufe: ze[1] > 0.25 ? 2 : ze[1] > 0 ? 1 : 0, text: 'Zinserwartung: 2-jährige Rendite minus Leitzins', geld: true });
      const heat = sig.filter((x) => !x.geld).reduce((t, x) => t + x.stufe, 0), tight = (sig.find((x) => x.geld) || {}).stufe || 0;
      const phase = heat >= 4 && tight === 2 ? 'Rausch bei straffer werdender Geldpolitik' : heat >= 4 ? 'Rausch' : heat >= 2 ? 'Aufbruch oder Abkühlung' : 'Ernüchterung';
      sig.forEach((x) => out.push({ art: 'signal', ...x }));
      out.push({ art: 'phase', phase, hitze: heat, geld: tight, stand: smh ? smh.stand : null });
      return out;
    },
  });

  dash.calc('stress_beta', {
    title: 'Mitbewegung je Wert',
    description: 'Je Wert die gemessene Mitbewegung (Beta) zum Leitwert seiner Klasse über die letzten 365 Tage: Krypto zu Bitcoin, Aktien und ETFs zum S&P 500, Edelmetalle zu Gold, aus täglichen Renditen an gemeinsamen Tagen. Dazu der schlechteste 30-Tage-Verlauf seit 2020.',
    inputs: ['kurse_usd', 'kurse_beob'],
    fn: (kurse_usd, kurse_beob) => {
      const CRY = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'BNB'], MET = ['GOLD', 'SILBER', 'PLATIN', 'PALLADIUM'];
      const by = {};
      for (const r of kurse_usd.concat(kurse_beob)) { const c = Number(r.close); if (c > 0) (by[r.asset] = by[r.asset] || {})[r.date] = c; }
      const out = [];
      for (const a of Object.keys(by)) {
        const kl = CRY.includes(a) ? 'krypto' : MET.includes(a) ? 'edel' : 'aktie', lead = kl === 'krypto' ? 'BTC' : kl === 'edel' ? 'GOLD' : 'SPX';
        const ds = Object.keys(by[a]).sort(), L = ds[ds.length - 1];
        const from = new Date(Date.parse(L + 'T00:00:00Z') - 365 * 864e5).toISOString().slice(0, 10);
        const cd = ds.filter((d) => d >= from && by[lead][d] !== undefined);
        const u = [], w = [];
        for (let i = 1; i < cd.length; i++) { u.push(Math.log(by[a][cd[i]] / by[a][cd[i - 1]])); w.push(Math.log(by[lead][cd[i]] / by[lead][cd[i - 1]])); }
        let beta = 1;
        if (u.length > 60) { const mu = u.reduce((t, v) => t + v, 0) / u.length, mw = w.reduce((t, v) => t + v, 0) / w.length; let c = 0, vw = 0; for (let i = 0; i < u.length; i++) { c += (u[i] - mu) * (w[i] - mw); vw += (w[i] - mw) ** 2; } beta = vw > 0 ? c / vw : 1; }
        let worst = 0, j = 0;
        for (let i = 0; i < ds.length; i++) { const lim = new Date(Date.parse(ds[i] + 'T00:00:00Z') - 30 * 864e5).toISOString().slice(0, 10); while (ds[j] < lim) j++; worst = Math.min(worst, by[a][ds[i]] / by[a][ds[j]] - 1); }
        out.push({ asset: a, klasse: kl, leitwert: lead, beta: Math.round(beta * 100) / 100, tage: u.length, schlechtester_monat: Math.round(worst * 1e4) / 1e4 });
      }
      return out;
    },
  });

  dash.calc('sparplan_rhythmus', {
    title: 'Sparplan-Rhythmus im Rückblick',
    description: 'Bitcoin und Gold: gleicher Jahresbetrag, gekauft wöchentlich, alle zwei Wochen oder monatlich über die letzten 365 Tage zum Schlusskurs in US-Dollar, ohne Gebühren. Gezeigt wird der Durchschnittspreis je Einheit und der Wert heute je 1.000 eingezahlt.',
    inputs: ['kurse_usd'],
    fn: (kurse_usd) => {
      const out = [];
      for (const a of ['BTC', 'GOLD']) {
        const s = kurse_usd.filter((r) => r.asset === a && Number(r.close) > 0).map((r) => [r.date, Number(r.close)]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
        if (s.length < 30) continue;
        const L = s[s.length - 1], start = new Date(Date.parse(L[0] + 'T00:00:00Z') - 365 * 864e5);
        const px = (d) => { const iso = d.toISOString().slice(0, 10); let v = null; for (const x of s) { if (x[0] <= iso) v = x[1]; else break; } return v; };
        for (const [label, step] of [['wöchentlich', 7], ['alle 2 Wochen', 14], ['monatlich', 0]]) {
          const dates = [];
          if (step) { for (let t = start.getTime(); t <= Date.parse(L[0] + 'T00:00:00Z'); t += step * 864e5) dates.push(new Date(t)); }
          else { const d = new Date(start); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); while (d.getTime() <= Date.parse(L[0] + 'T00:00:00Z')) { dates.push(new Date(d)); d.setUTCMonth(d.getUTCMonth() + 1); } }
          const per = 1000 / dates.length; let units = 0;
          for (const d of dates) { const p = px(d); if (p) units += per / p; }
          out.push({ asset: a, rhythmus: label, kaeufe: dates.length, schnitt: Math.round((1000 / units) * 100) / 100, wert_heute: Math.round(units * L[1] * 100) / 100, kurs_heute: L[1], stand: L[0] });
        }
      }
      return out;
    },
  });

  // ---------- Darstellung ----------
  const css = document.createElement('style');
  css.textContent = `.mx-lage { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--cds-gap-xs) var(--cds-gap-md, 1rem); }
.mx-lage b { font-family: var(--font-anthropic-sans); font-weight: 500; font-size: calc(var(--cds-font-size-title) * 0.8); }
.mx-card { border-left: 4px solid var(--color-border-line); }
.mx-card.ok { border-left-color: var(--color-ok); } .mx-card.warn { border-left-color: var(--color-warn); } .mx-card.bad { border-left-color: var(--color-bad); }
.mx-sc { display: flex; flex-wrap: wrap; gap: var(--cds-gap-xs); margin-block: var(--cds-gap-sm); }
.mx-row td.txt { min-width: 10rem; }
.mx-chart { margin: var(--cds-gap-sm) 0; }
.mx-leg { display: flex; flex-wrap: wrap; gap: var(--cds-gap-sm); font-size: var(--cds-font-size-caption); color: var(--color-fg-muted); }
.mx-leg i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.mx-uhr { margin: var(--cds-gap-sm) 0 0; padding-left: 1.4rem; display: grid; gap: 0.35rem; }
.mx-uhr li { color: var(--color-fg-muted); } .mx-uhr li b { color: var(--color-fg); font-weight: 500; margin-right: 0.5rem; }
.mx-uhr li.on { color: var(--color-fg); } .mx-uhr li.on::marker { color: var(--color-bad); font-weight: 700; }
#mx-gesamt .up, #mx-konj .up, #mx-zyk .up { color: var(--color-ok); } #mx-gesamt .down, #mx-konj .down, #mx-zyk .down { color: var(--color-bad); }`;
  root.appendChild(css);

  const card = (id, after, cls) => {
    let el = $('#' + id);
    if (!el) { const anchor = $(after); if (!anchor) return null; el = document.createElement('div'); el.id = id; el.className = 'mk-card ' + (cls || ''); anchor.insertAdjacentElement('afterend', el); }
    return el;
  };
  const wait = (el, ids) => { const bad = ids.find((id) => ['error', 'missing', 'declined', 'connect'].includes(dash.data(id).status)); el.innerHTML = '<p class="mk-sub">' + (bad ? 'Die Daten dafür konnten nicht geladen werden.' : 'Lädt …') + '</p>'; };

  const renderLage = () => {
    const el = card('mx-lage', '#today-sub', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'marktlage stimmung_lage');
    if (!ok(['marktlage'])) { wait(el, ['marktlage', 'kurse_welt', 'kurse_usd', 'kurse_beob']); return; }
    const base = dash.data('marktlage').data, g0 = base.find((r) => r.faktor === 'Gesamt');
    const extra = ok(['stimmung_lage']) ? dash.data('stimmung_lage').data : [];
    const rows = base.filter((r) => r.faktor !== 'Gesamt').concat(extra);
    const sum = rows.reduce((t, r) => t + r.punkte, 0), stand = rows.map((r) => r.stand).sort().pop();
    const text = sum >= 2 ? 'freundlich' : sum <= -2 ? 'angespannt' : 'gemischt';
    el.className = 'mk-card mx-card ' + (sum >= 2 ? 'ok' : sum <= -2 ? 'bad' : 'warn');
    const val = (r) => (r.einheit === '%' ? pct(r.wert, 1) : r.einheit !== undefined ? fmtN(r.wert, r.einheit === 'Pp.' ? 2 : r.faktor.startsWith('Fear') ? 0 : 3) + (r.einheit ? ' ' + r.einheit : '') + (r.faktor.startsWith('Fear') ? '' : ' (' + (r.z > 0 ? '+' : r.z < 0 ? '−' : '') + fmtN(Math.abs(r.z), 1) + ' σ)')
      : r.faktor.startsWith('Angst') ? fmtN(r.wert, 1) : r.faktor.startsWith('US-Zins') ? (r.wert > 0 ? '+' : r.wert < 0 ? '−' : '') + fmtN(Math.abs(r.wert), 2) + ' Pp.' : r.faktor.startsWith('Breite') ? fmtN(r.wert * 100, 0) + ' %' : pct(r.wert, 1));
    const fd = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–');
    el.innerHTML = `<div class="mx-lage"><h3>Marktlage</h3><b>${esc(text)}</b><span class="mk-sub">${sum > 0 ? '+' : ''}${sum} Punkte, Stand ${fd(stand)}${extra.length ? '' : ' (ohne Stimmung, deren Daten fehlen gerade)'}</span></div>`
      + '<p class="mk-sub">Wie freundlich ist das Umfeld für riskante Anlagen? Jeder Faktor gibt +1 (stützt), 0 oder −1 (belastet). Sagt nichts über einen einzelnen Wert und ist keine Prognose, sondern der heutige Rückenwind oder Gegenwind. Kredit-Spread, Zinserwartung, Langzeithalter und Netto-Liquidität stammen aus der Marktdaten-App; die ersten drei werden mit ihrem Mittel im letzten Jahr verglichen (σ = Standardabweichungen), die Netto-Liquidität zählt ab ±2 % in 12 Wochen.</p>'
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Faktor</th><th>Wert</th><th>Einordnung</th><th>Punkte</th><th>Stand</th></tr></thead><tbody>'
      + rows.map((r) => `<tr><td>${esc(r.faktor)}</td><td>${val(r)}</td><td class="txt-s">${esc(r.text)}</td><td class="${sg(r.punkte)}">${r.punkte > 0 ? '+' : ''}${r.punkte}</td><td>${fd(r.stand)}</td></tr>`).join('')
      + '</tbody></table></div>';
    void g0;
  };

  const renderRsi = () => {
    const el = card('mx-rsi', '#pt-card', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'rsi_test');
    if (!ok(['rsi_test'])) { wait(el, ['rsi_test', 'kurse_usd', 'kurse_beob']); return; }
    const rows = dash.data('rsi_test').data;
    el.innerHTML = '<h3>Warum ein hoher RSI keinen Abzug mehr gibt</h3><p class="mk-sub">Bis 04.11.2026 zog die Ampel bei einem RSI ab 70 einen Punkt ab („heiß gelaufen“). Der Langzeittest der Marktdaten-App und dieser Test mit unseren eigenen Kursen seit 2020 zeigen das Gegenteil: Danach ging es im Schnitt eher weiter. Seit 05.11.2026 zählt ein hoher RSI deshalb neutral. Einträge im Ampel-Protokoll vor diesem Tag sind nach der alten Regel berechnet.</p>'
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Gruppe</th><th>Fall</th><th>Fälle</th><th>Ø nach 20 Tagen</th><th>Median</th><th>Anteil im Plus</th></tr></thead><tbody>'
      + rows.map((r) => `<tr><td>${esc(r.gruppe)}</td><td>${esc(r.fall)}</td><td>${fmtN(r.n, 0)}</td><td class="${sg(r.schnitt)}">${pct(r.schnitt, 1)}</td><td class="${sg(r.median)}">${pct(r.median, 1)}</td><td>${fmtN(r.plus * 100, 0)} %</td></tr>`).join('')
      + '</tbody></table></div><p class="mk-sub">Bei Krypto war der Schwung danach deutlich stärker als an normalen Tagen, bei Aktien, Indizes und Metallen etwa gleich. In Fall-Jahren wie 2022 half auch ein hoher RSI nicht. Einen Pluspunkt gibt es dafür bewusst nicht, das wäre zu sehr auf die Vergangenheit zugeschnitten.</p>';
  };

  const renderGesamt = () => {
    const el = card('mx-gesamt', '#amp-lead', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'gesamtbild');
    if (!ok(['gesamtbild'])) { wait(el, ['gesamtbild', 'ampel_alle', 'marktlage', 'stimmung_lage']); return; }
    const MINE = ['BTC', 'GOLD'], ORD = { 'einig aufwärts': 0, offen: 1, uneinig: 2, 'einig abwärts': 3 };
    const rows = dash.data('gesamtbild').data.slice().sort((a, b) => (MINE.includes(b.asset) - MINE.includes(a.asset)) || ORD[a.konsens] - ORD[b.konsens] || String(a.name).localeCompare(String(b.name)));
    const n = (k) => rows.filter((r) => r.konsens === k).length;
    const lab = (v) => (v > 0 ? '<span class="up">Rückenwind</span>' : v < 0 ? '<span class="down">Gegenwind</span>' : 'neutral');
    const amp = { gruen: '<span class="up">grün</span>', gelb: 'gelb', rot: '<span class="down">rot</span>' };
    const kon = { 'einig aufwärts': '<b class="up">einig aufwärts</b>', 'einig abwärts': '<b class="down">einig abwärts</b>', uneinig: 'uneinig', offen: 'offen' };
    const chart = (r) => [r.d200 == null ? null : (r.d200 >= 0 ? 'über' : 'unter') + ' 200-Tage-Linie (' + pct(r.d200, 0) + ')', r.h52 == null ? null : pct(r.h52, 0) + ' vom 52W-Hoch'].filter(Boolean).join(', ') || '–';
    el.innerHTML = '<h3>Gesamtbild: Trend und Umfeld</h3>'
      + `<p class="mk-sub">Zwei getrennte Säulen: der <b>Trend</b> aus den Kursen des Werts (die Ampel) und das <b>Umfeld</b> aus Daten, die nicht vom Kurs abhängen (Kredit-Spreads, Zinsen, Liquidität, VIX, Marktbreite; bei Krypto zusätzlich Bitcoin-spezifische Faktoren). Nur wenn beide in dieselbe Richtung zeigen, gilt ein Wert als „einig“. Heute: ${n('einig aufwärts')} einig aufwärts, ${n('einig abwärts')} einig abwärts, ${n('uneinig')} uneinig, ${n('offen')} offen. Die Chart-Spalte ist Info ohne Punkte. Wie gut das trägt, wird erst nach einigen Wochen Protokoll messbar.</p>`
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Wert</th><th>Trend (Ampel)</th><th>Umfeld</th><th>Gesamtbild</th><th>Chart-Info</th></tr></thead><tbody>'
      + rows.map((r) => `<tr><td>${esc(r.name || nm(r.asset))}${MINE.includes(r.asset) ? ' ★' : ''}</td><td>${amp[r.ampel] || esc(r.ampel)}</td><td>${lab(r.umfeld)} (${r.umfeld_punkte > 0 ? '+' : ''}${r.umfeld_punkte})</td><td>${kon[r.konsens]}</td><td class="txt-s">${esc(chart(r))}</td></tr>`).join('')
      + '</tbody></table></div><p class="mk-sub">★ = deine Werte. Umfeld-Punkte: Summe der Marktlage, ab +2 Rückenwind, ab −2 Gegenwind.</p>';
  };

  const renderKonjunktur = () => {
    const el = card('mx-konj', '#mx-lage', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'konjunktur_ampel rezession_rueckblick');
    if (!ok(['konjunktur_ampel'])) { wait(el, ['konjunktur_ampel', 'konjunktur', 'stimmung']); return; }
    const rows = dash.data('konjunktur_ampel').data, g = rows.find((r) => r.faktor === 'Gesamt'), info = rows.filter((r) => r.stufe === null);
    el.className = 'mk-card mx-card ' + (g.stufe === 2 ? 'bad' : g.stufe === 1 ? 'warn' : 'ok');
    const fd = (d) => (!d ? '–' : d.length === 7 ? d.slice(5) + '/' + d.slice(0, 4) : new Date(d + 'T00:00:00').toLocaleDateString('de-DE'));
    const ST = { 2: '<span class="down">Warnung</span>', 1: 'Achtung', 0: '<span class="up">unauffällig</span>' };
    const val = (r) => (/Liquidität/.test(r.faktor) ? pct(r.wert, 1) : /ISM|CAPE/.test(r.faktor) ? fmtN(r.wert, 1) : (r.wert > 0 ? '+' : r.wert < 0 ? '−' : '') + fmtN(Math.abs(r.wert), 2) + ' Pp.');
    let rb = '';
    if (ok(['rezession_rueckblick'])) {
      const R = dash.data('rezession_rueckblick').data, m = (k) => { const v = R.map((r) => r[k]).filter((x) => x != null).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
      rb = '<details class="mk-fold" style="margin-top:var(--cds-gap-sm)"><summary>Was Aktien rund um frühere Rezessionen machten (S&P 500 seit 1929)</summary>'
        + `<p class="mk-sub">Im Mittel (Median) über ${R.length} Rezessionen: in den 12 Monaten vor Beginn ${pct(m('vorher_12m'), 0)}, 12 Monate ab Beginn ${pct(m('nach_12m'), 0)}, 24 Monate ab Beginn ${pct(m('nach_24m'), 0)}, größter Rückgang ${pct(m('rueckgang'), 0)}. Die Börse fiel oft schon vor dem offiziellen Beginn und erholte sich, während die Wirtschaft noch schrumpfte.</p>`
        + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Rezession</th><th>12 Mon. davor</th><th>12 Mon. danach</th><th>24 Mon. danach</th><th>Größter Rückgang</th><th>Tief</th><th>Bis altes Hoch</th></tr></thead><tbody>'
        + R.map((r) => `<tr><td>${fd(r.beginn)} – ${fd(r.ende)}</td><td class="${sg(r.vorher_12m)}">${pct(r.vorher_12m, 0)}</td><td class="${sg(r.nach_12m)}">${pct(r.nach_12m, 0)}</td><td class="${sg(r.nach_24m)}">${pct(r.nach_24m, 0)}</td><td class="down">${pct(r.rueckgang, 0)}</td><td>${fd(r.tief)}</td><td>${r.monate_bis_hoch == null ? 'noch nicht' : r.monate_bis_hoch + ' Mon.'}</td></tr>`).join('')
        + '</tbody></table></div><p class="mk-sub">Rezessions-Daten: NBER. Kurse: Monatsdurchschnitte des S&P 500 nach Robert Shiller, ohne Dividenden und ohne Inflationsbereinigung.</p></details>';
    }
    el.innerHTML = `<div class="mx-lage"><h3>Konjunktur-Vorzeichen (USA)</h3><b>${esc(g.text)}</b><span class="mk-sub">Stand ${fd(g.stand)}</span></div>`
      + '<p class="mk-sub">Signale, die Abschwüngen in der Vergangenheit oft vorausgingen. Einzelne Warnungen gibt es auch ohne Rezession, aussagekräftig wird es erst, wenn mehrere zusammenkommen. Die Werte werden einmal pro Woche erneuert.</p>'
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Vorzeichen</th><th>Wert</th><th>Einordnung</th><th>Status</th><th>Stand</th></tr></thead><tbody>'
      + rows.filter((r) => r.faktor !== 'Gesamt' && r.stufe !== null).map((r) => `<tr><td>${esc(r.faktor)}</td><td>${val(r)}</td><td class="txt-s">${esc(r.text)}</td><td>${ST[r.stufe]}</td><td>${fd(r.stand)}</td></tr>`).join('')
      + info.map((r) => `<tr><td>${esc(r.faktor)}</td><td>${val(r)}</td><td class="txt-s">${esc(r.text)}</td><td>Info</td><td>${fd(r.stand)}</td></tr>`).join('')
      + '</tbody></table></div>' + rb;
  };

  const renderLangzeit = () => {
    const el = card('mx-lang', '#auswertung > h2', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'rueckgaenge_lang cape_rueckblick');
    if (!ok(['rueckgaenge_lang', 'cape_rueckblick'])) { wait(el, ['rueckgaenge_lang', 'cape_rueckblick', 'langzeit_sp']); return; }
    const R = dash.data('rueckgaenge_lang').data, C = dash.data('cape_rueckblick').data, now = R.find((r) => r.hoch === 'heute'), hist = R.filter((r) => r.hoch !== 'heute');
    const fd = (d) => (!d ? '–' : d.length === 7 ? d.slice(5) + '/' + d.slice(0, 4) : new Date(d + 'T00:00:00').toLocaleDateString('de-DE'));
    const n30 = hist.filter((r) => r.tiefe <= -0.3).length, n50 = hist.filter((r) => r.tiefe <= -0.5).length, ch = C.find((c) => c.heute);
    el.innerHTML = '<h3>Langzeit-Perspektive: S&P 500 seit 1928</h3>'
      + `<p class="mk-sub">Heute liegt der S&P 500 ${now ? pct(now.tiefe, 1) : '–'} unter seinem Hoch. Seit 1928 fiel er ${hist.length}-mal um 20 % oder mehr unter sein bisheriges Rekordhoch (Monatsdurchschnitte; Rückgänge innerhalb einer laufenden Erholung, etwa 1937, zählen zum vorherigen), davon ${n30} um 30 % oder mehr und ${n50} um 50 % oder mehr. Das sind Häufigkeiten aus der Vergangenheit, keine Vorhersage.</p>`
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Hoch</th><th>Tief</th><th>Rückgang</th><th>Monate bis Tief</th><th>Monate bis altes Hoch</th></tr></thead><tbody>'
      + hist.map((r) => `<tr><td>${fd(r.hoch)}</td><td>${fd(r.tief)}</td><td class="down">${pct(r.tiefe, 0)}</td><td>${r.monate_fall}</td><td>${r.monate_erholung == null ? 'noch nicht' : r.monate_erholung}</td></tr>`).join('')
      + '</tbody></table></div>'
      + `<h3 style="margin-top:var(--cds-gap-md)">Bewertung und die folgenden 10 Jahre</h3><p class="mk-sub">Das Shiller-KGV (CAPE) steht heute bei ${ch ? fmtN(ch.cape_heute, 1) : '–'} (${ch ? fd(ch.stand) : ''}). Je teurer der Markt beim Einstieg war, desto schwächer waren im Schnitt die nächsten 10 Jahre, bei großer Streuung. Für die nächsten Wochen oder Monate sagt die Bewertung praktisch nichts. Vorsicht bei der Gruppe „über 30“: Sie stammt fast nur aus den Jahren um 1997 bis 2001 und 2016, also aus wenigen unabhängigen Phasen.</p>`
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>CAPE beim Start</th><th>Monate</th><th>Ø pro Jahr real, 10 Jahre</th><th>Schlechte 10 %</th><th>Gute 10 %</th></tr></thead><tbody>'
      + C.map((c) => `<tr${c.heute ? ' style="font-weight:600"' : ''}><td>${esc(c.gruppe)}${c.heute ? ' ← heute' : ''}</td><td>${c.monate}</td><td class="${sg(c.schnitt)}">${pct(c.schnitt, 1)}</td><td class="${sg(c.schlecht)}">${pct(c.schlecht, 1)}</td><td class="${sg(c.gut)}">${pct(c.gut, 1)}</td></tr>`).join('')
      + '</tbody></table></div><p class="mk-sub">Real = nach Inflation, ohne Dividenden (mit Dividenden lag es historisch rund 2 bis 4 Prozentpunkte pro Jahr höher). Daten: Robert Shiller (über datasets/s-and-p-500 auf GitHub), US-Verbraucherpreise, aktuelles CAPE von multpl.com. Ein Halving-Vergleich für Bitcoin folgt, sobald genug Bitcoin-Historie vorliegt; drei Zyklen sind zu wenig für eine Regel.</p>';
  };

  const renderZyklus = () => {
    const el = card('mx-zyk', '#mx-konj', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'spaetzyklus');
    if (!ok(['spaetzyklus'])) { wait(el, ['spaetzyklus', 'marktlage', 'stimmung', 'kurse_welt', 'konjunktur']); return; }
    const rows = dash.data('spaetzyklus').data, P = rows.filter((r) => r.art === 'punkt'), S = rows.filter((r) => r.art === 'stufe');
    const n = S.filter((r) => r.erreicht).length;
    const ST = { 2: '<span class="down">Warnung</span>', 1: 'Achtung', 0: '<span class="up">unauffällig</span>' };
    el.innerHTML = `<div class="mx-lage"><h3>Zyklus-Uhr</h3><b>${n} von ${S.length} Stufen erreicht</b></div>`
      + '<p class="mk-sub">Vor früheren Abschwüngen lief es oft in dieser Reihenfolge ab. Die Stufen müssen nicht alle und nicht genau so kommen, und zwischen den ersten Stufen und einem Abschwung lagen oft ein bis zwei Jahre. Die Uhr zeigt, wie weit der typische Ablauf heute fortgeschritten ist, nicht wann etwas passiert.</p>'
      + '<ol class="mx-uhr">' + S.map((r) => `<li class="${r.erreicht ? 'on' : ''}"><b>${esc(r.name)}</b><span>${r.erreicht == null ? 'keine Daten' : r.erreicht ? 'erreicht' : 'noch nicht'}${r.wert ? ' · ' + esc(r.wert) : ''}</span></li>`).join('') + '</ol>'
      + '<h3 style="margin-top:var(--cds-gap-md)">Messpunkte</h3><div class="mk-scroll"><table class="mk-table"><thead><tr><th>Messpunkt</th><th>Heute</th><th>Einordnung</th><th>Status</th></tr></thead><tbody>'
      + P.map((r) => `<tr><td>${esc(r.name)}</td><td class="txt-s">${esc(r.wert)}</td><td class="txt-s">${esc(r.text)}</td><td>${ST[r.stufe]}</td></tr>`).join('')
      + '</tbody></table></div>';
  };

  const renderAktienGold = () => {
    const el = card('mx-ag', '#mx-lang', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'aktien_gold');
    if (!ok(['aktien_gold'])) { wait(el, ['aktien_gold', 'langzeit_sp', 'gold_lang']); return; }
    const rows = dash.data('aktien_gold').data, now = rows.find((r) => r.art === 'heute'), ext = rows.filter((r) => r.art === 'hoch' || r.art === 'tief');
    const lastHi = ext.filter((r) => r.art === 'hoch').pop();
    const fd = (d) => (!d ? '–' : d.length === 7 ? d.slice(5) + '/' + d.slice(0, 4) : new Date(d + 'T00:00:00').toLocaleDateString('de-DE'));
    el.innerHTML = '<h3>Aktien in Gold gemessen (S&P 500 ÷ Goldpreis)</h3>'
      + `<p class="mk-sub">Wie viele Unzen Gold kostet der S&P 500? Steigt die Linie, waren Aktien besser als Gold, fällt sie, war Gold besser. Heute: ${now ? fmtN(now.ratio, 2) : '–'} (${now ? fd(now.date) : ''})${lastHi && now ? `, ${pct(now.ratio / lastHi.ratio - 1, 0)} seit dem letzten Hoch ${fd(lastHi.date)}` : ''}. Die großen Hochpunkte lagen 1929, 1967 und 2000, danach folgten jeweils lange Phasen, in denen Gold besser lief. Wenige Wiederholungen, also ein Muster, keine Regel.</p>`
      + '<div class="mx-chart" id="mx-ag-chart"></div>'
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Wendepunkt</th><th>Monat</th><th>S&P 500 in Unzen Gold</th></tr></thead><tbody>'
      + ext.map((r) => `<tr><td>${r.art === 'hoch' ? 'Hoch' : 'Tief'}</td><td>${fd(r.date)}</td><td>${fmtN(r.ratio, 2)}</td></tr>`).join('')
      + '</tbody></table></div><p class="mk-sub">Logarithmische Skala. Daten: S&P 500 nach Robert Shiller und monatliche Goldpreise (GitHub datasets/s-and-p-500 und datasets/gold-prices), aktueller Wert aus unseren Tageskursen. Bis 1933 war der Goldpreis in den USA fest.</p>';
    const host = el.querySelector('#mx-ag-chart'), W = 800, H = 280, m = { t: 12, r: 12, b: 24, l: 40 };
    const pts = rows.map((r) => ({ d: new Date(r.date.length === 7 ? r.date + '-15T00:00:00Z' : r.date + 'T00:00:00Z'), v: r.ratio, art: r.art, date: r.date }));
    const x = d3.scaleUtc().domain(d3.extent(pts, (p) => p.d)).range([m.l, W - m.r]);
    const y = d3.scaleLog().domain([d3.min(pts, (p) => p.v) * 0.9, d3.max(pts, (p) => p.v) * 1.1]).range([H - m.b, m.t]);
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'S&P 500 in Unzen Gold seit 1871');
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(8).tickSizeOuter(0)).call((g) => g.selectAll('text').attr('fill', 'var(--color-fg-muted)')).call((g) => g.selectAll('line,path').attr('stroke', 'var(--color-border-line)'));
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues([0.2, 0.5, 1, 2, 5]).tickFormat((v) => fmtN(v, v < 1 ? 1 : 0))).call((g) => g.selectAll('text').attr('fill', 'var(--color-fg-muted)')).call((g) => g.selectAll('line,path').attr('stroke', 'var(--color-border-line)'));
    svg.append('path').datum(pts).attr('fill', 'none').attr('stroke', (dash.colors && dash.colors[0]) || 'currentColor').attr('stroke-width', 1.6).attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)));
    const mk = pts.filter((p) => p.art);
    svg.selectAll('circle.mx-pt').data(mk).enter().append('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', 3.5).attr('fill', (p) => (p.art === 'hoch' ? 'var(--color-bad)' : p.art === 'tief' ? 'var(--color-ok)' : 'var(--color-fg)'));
    svg.selectAll('text.mx-lb').data(mk.filter((p) => p.art !== 'tief' || p.v < 0.4)).enter().append('text').attr('x', (p) => x(p.d)).attr('y', (p) => y(p.v) + (p.art === 'tief' ? 14 : -7)).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((p) => (p.art === 'heute' ? 'heute' : p.date.slice(0, 4)));
  };

  const fdm = (d) => (!d ? '–' : d.length === 7 ? d.slice(5) + '/' + d.slice(0, 4) : new Date(d + 'T00:00:00').toLocaleDateString('de-DE'));
  const lineChart = (host, series, o) => {
    const W = 800, H = o.h || 260, m = { t: 12, r: 12, b: 24, l: 48 };
    const all = series.flatMap((x) => x.pts);
    if (!all.length) return;
    const x = d3.scaleUtc().domain(d3.extent(all, (p) => p.d)).range([m.l, W - m.r]);
    const ext = d3.extent(all, (p) => p.v), pad = o.log ? 1.1 : (ext[1] - ext[0]) * 0.08 || 1;
    const y = (o.log ? d3.scaleLog().domain([ext[0] / pad, ext[1] * pad]) : d3.scaleLinear().domain(o.domain || [ext[0] - pad, ext[1] + pad])).range([H - m.b, m.t]);
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', o.label || '');
    const ax = (g) => g.call((q) => q.selectAll('text').attr('fill', 'var(--color-fg-muted)')).call((q) => q.selectAll('line,path').attr('stroke', 'var(--color-border-line)'));
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(7).tickSizeOuter(0)).call(ax);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5, o.log ? '~s' : undefined).tickFormat(o.yfmt || null)).call(ax);
    if (o.zero != null) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(o.zero)).attr('y2', y(o.zero)).attr('stroke', 'var(--color-fg-muted)').attr('stroke-dasharray', '3 3');
    series.forEach((sr, i) => svg.append('path').datum(sr.pts).attr('fill', 'none').attr('stroke', sr.color || (dash.colors && dash.colors[i]) || 'currentColor').attr('stroke-width', sr.w || 1.8).attr('stroke-dasharray', sr.dash || null).attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v))));
    if (series.length > 1) host.insertAdjacentHTML('beforeend', '<div class="mx-leg">' + series.map((sr, i) => `<span><i style="background:${sr.color || (dash.colors && dash.colors[i]) || 'currentColor'}"></i>${esc(sr.name)}</span>`).join('') + '</div>');
    return { svg, x, y };
  };
  const toD = (d) => new Date((d.length === 7 ? d + '-15' : d) + 'T00:00:00Z');

  const renderBtcGold = () => {
    const el = card('mx-bg', '#mx-ag', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'btc_gold gleichlauf_btc');
    if (!ok(['btc_gold'])) { wait(el, ['btc_gold', 'kurse_usd']); return; }
    const R = dash.data('btc_gold').data, now = R.find((r) => r.art === 'heute'), hi = R.filter((r) => r.art === 'hoch'), lo = R.filter((r) => r.art === 'tief');
    const maxR = R.reduce((m, r) => (r.ratio > m.ratio ? r : m), R[0]);
    let gl = '';
    if (ok(['gleichlauf_btc'])) {
      const G = dash.data('gleichlauf_btc').data, L = G[G.length - 1], avg = (k) => G.reduce((t, r) => t + r[k], 0) / G.length;
      gl = `<h3 style="margin-top:var(--cds-gap-md)">Verhält sich Bitcoin wie Tech-Aktien oder wie Gold?</h3><p class="mk-sub">Gleichlauf der Tagesrenditen über 90 Börsentage. Heute: mit dem Nasdaq ${fmtN(L.nasdaq, 2)}, mit Gold ${fmtN(L.gold, 2)} (Schnitt seit 2020: ${fmtN(avg('nasdaq'), 2)} bzw. ${fmtN(avg('gold'), 2)}). ${avg('nasdaq') > avg('gold') ? 'Über die ganze Zeit lief Bitcoin eher mit Tech-Aktien als mit Gold, Gold war also meist ein echtes Gegengewicht.' : 'Über die ganze Zeit lief Bitcoin eher mit Gold als mit Tech-Aktien.'} ${L.gold > avg('gold') + 0.2 ? 'Zuletzt läuft Bitcoin aber auffällig stark mit Gold: Beide sind gemeinsam gefallen, als Gegengewicht wirkt Gold gerade schwächer als sonst.' : ''}</p><div class="mx-chart" id="mx-gl-chart"></div>`;
    }
    el.innerHTML = '<h3>Bitcoin in Gold gemessen (Unzen Gold je Bitcoin)</h3>'
      + `<p class="mk-sub">Heute kostet ein Bitcoin ${now ? fmtN(now.ratio, 1) : '–'} Unzen Gold (${now ? fdm(now.date) : ''}). Höchststand seit 2020: ${fmtN(maxR.ratio, 1)} (${fdm(maxR.date.slice(0, 7))}), heute ${now ? pct(now.ratio / maxR.ratio - 1, 0) : '–'} darunter. Hochs: ${hi.map((r) => fdm(r.date.slice(0, 7))).join(', ') || '–'}; Tiefs: ${lo.map((r) => fdm(r.date.slice(0, 7))).join(', ') || '–'}. Gegenüber Gold ist Bitcoin damit klar schwächer als vor einem Jahr; ob das eine Kaufgelegenheit oder ein längerer Abschwung ist, zeigen erst die nächsten Monate. Unsere Daten reichen bis 2020 zurück, also nur über gut einen Halving-Zyklus.</p>`
      + '<div class="mx-chart" id="mx-bg-chart"></div>' + gl;
    lineChart(el.querySelector('#mx-bg-chart'), [{ name: 'Unzen Gold je Bitcoin', pts: R.map((r) => ({ d: toD(r.date), v: r.ratio })) }], { log: true, label: 'Bitcoin in Unzen Gold seit 2020', yfmt: (v) => fmtN(v, 0) });
    if (gl) { const G = dash.data('gleichlauf_btc').data; lineChart(el.querySelector('#mx-gl-chart'), [{ name: 'mit Nasdaq 100', pts: G.map((r) => ({ d: toD(r.date), v: r.nasdaq })) }, { name: 'mit Gold', pts: G.map((r) => ({ d: toD(r.date), v: r.gold })) }], { domain: [-0.6, 1], zero: 0, h: 220, label: 'Gleichlauf von Bitcoin mit Nasdaq und Gold', yfmt: (v) => fmtN(v, 1) }); }
  };

  const renderBaer = () => {
    const el = card('mx-baer', '#mx-rhythmus', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'sparplan_baer');
    if (!ok(['sparplan_baer'])) { wait(el, ['sparplan_baer', 'kurse', 'werte']); return; }
    const R = dash.data('sparplan_baer').data;
    if (!R.length) { el.innerHTML = '<h3>Sparplan durch den Bärenmarkt</h3><p class="mk-sub">Zu wenig Kursdaten.</p>'; return; }
    const ath = R.find((r) => r.start === 'Am Rekordhoch 2021');
    el.innerHTML = '<h3>Was wäre, wenn: dein Bitcoin-Sparplan durch einen Absturz</h3>'
      + `<p class="mk-sub">25 € alle 2 Wochen in Bitcoin, mit Bitpanda-Aufschlag, ohne Steuern. Der härteste Fall: Start genau am Rekordhoch ${fdm(ath ? ath.startdatum : '')}, danach fiel Bitcoin um rund drei Viertel.</p>`
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Start</th><th>Eingezahlt</th><th>Wert heute</th><th>Ergebnis</th><th>Schlimmster Zwischenstand</th><th>Wieder dauerhaft im Plus nach</th><th>Am Tief 2022 aufgehört</th></tr></thead><tbody>'
      + R.map((r) => `<tr><td>${esc(r.start)} (${fdm(r.startdatum)})</td><td>${eur(r.eingezahlt)}</td><td>${eur(r.wert)}</td><td class="${sg(r.ergebnis)}">${pct(r.ergebnis, 0)}</td><td class="${sg(r.tiefster)}">${pct(r.tiefster, 0)}</td><td>${r.tiefster >= 0 ? 'nie im Minus' : r.monate_bis_plus == null ? 'noch nicht' : r.monate_bis_plus + ' Monaten'}</td><td>${r.gestoppt_wert == null ? '–' : eur(r.gestoppt_wert) + ' aus ' + eur(r.gestoppt_eingezahlt)}</td></tr>`).join('')
      + '</tbody></table></div><div class="mx-chart" id="mx-baer-chart"></div>'
      + '<p class="mk-sub">Die Linien zeigen den Start am Rekordhoch: eingezahlt (gestrichelt) gegen Wert. Wer im Absturz weiterkaufte, kaufte billig nach und war deutlich früher wieder im Plus als der Kurs selbst. Rückblick, keine Garantie: Ob der nächste Absturz genauso ausgeht, weiß niemand.</p>';
    if (ath && ath.serie) { const S = JSON.parse(ath.serie); lineChart(el.querySelector('#mx-baer-chart'), [{ name: 'Wert', pts: S.map((p) => ({ d: toD(p.m), v: p.wert })) }, { name: 'Eingezahlt', pts: S.map((p) => ({ d: toD(p.m), v: p.eingezahlt })), dash: '4 4', color: 'var(--color-fg-muted)' }], { label: 'Sparplan ab Rekordhoch 2021', yfmt: (v) => fmtN(v, 0) + ' €' }); }
  };

  const renderReal = () => {
    const el = card('mx-real', '#mx-baer', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'euro_real');
    if (!ok(['euro_real'])) { wait(el, ['euro_real', 'kurse', 'kurse_beob', 'vpi_at']); return; }
    const R = dash.data('euro_real').data, last = R.filter((r) => r.letzter).sort((a, b) => b.real - a.real);
    const names = [...new Set(R.map((r) => r.anlage))];
    const yrs = (r) => (Date.parse(r.date + 'T00:00:00Z') - Date.parse('2021-01-04T00:00:00Z')) / (365.25 * 864e5);
    el.innerHTML = '<h3>1.000 € seit Anfang 2021: was real übrig ist</h3>'
      + '<p class="mk-sub">In Euro und nach österreichischer Inflation (VPI, Statistik Austria). Seit Jänner 2021 sind die Preise in Österreich um rund ein Drittel gestiegen, so viel Kaufkraft hat Geld auf dem Konto ohne Zinsen verloren. Ohne Gebühren und Steuern; Sparbuch-Zinsen lagen in der Zeit meist deutlich unter der Inflation.</p>'
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Anlage</th><th>Wert in €</th><th>Real (Kaufkraft von 2021)</th><th>Real pro Jahr</th><th>Stand</th></tr></thead><tbody>'
      + last.map((r) => { const y = yrs(r), pa = y > 0 ? Math.pow(r.real / 1000, 1 / y) - 1 : null; return `<tr><td>${esc(r.anlage)}</td><td>${eur(r.nominal)}</td><td class="${sg(r.real - 1000)}">${eur(r.real)}</td><td class="${sg(pa)}">${pct(pa, 1)}</td><td>${fdm(r.date)}</td></tr>`; }).join('')
      + '</tbody></table></div><div class="mx-chart" id="mx-real-chart"></div><p class="mk-sub">Kaufkraft in Euro von Jänner 2021, logarithmische Skala. Kurse: Bitcoin und Gold in US-Dollar mit dem EUR/USD-Tageskurs umgerechnet, MSCI-World- und S&P-500-ETF in Euro an der Xetra.</p>';
    lineChart(el.querySelector('#mx-real-chart'), names.map((n) => ({ name: n, pts: R.filter((r) => r.anlage === n && !r.letzter).map((r) => ({ d: toD(r.date), v: r.real })), dash: n === 'Konto ohne Zinsen' ? '4 4' : null })), { log: true, zero: 1000, label: 'Kaufkraft von 1.000 € seit 2021', yfmt: (v) => fmtN(v, 0) });
  };

  const renderKi = () => {
    const el = card('mx-ki', '#mx-bg', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'ki_zyklus');
    if (!ok(['ki_zyklus'])) { wait(el, ['ki_zyklus', 'kurse_ki', 'stimmung']); return; }
    const R = dash.data('ki_zyklus').data, ph = R.find((r) => r.art === 'phase'), S = R.filter((r) => r.art === 'signal'), V = R.filter((r) => r.art === 'wert'), REL = R.filter((r) => r.art === 'rel');
    const ST = { 2: '<span class="down">heiß</span>', 1: 'warm', 0: '<span class="up">ruhig</span>' };
    const GS = { 2: '<span class="down">strafft</span>', 1: 'leicht straffer', 0: '<span class="up">locker</span>' };
    const val = (x) => (x.einheit === '%' ? pct(x.wert, 0) : x.einheit === 'anteil' ? fmtN(x.wert * 100, 0) + ' %' : x.einheit === 'Pp.' ? (x.wert > 0 ? '+' : '') + fmtN(x.wert, 2) + ' Pp.' : String(x.wert));
    const ORD = ['Index', 'Chips', 'Cloud', 'Energie', 'Neu'], GN = { Index: 'Index', Chips: 'Chips', Cloud: 'Cloud', Energie: 'Energie/Rohstoff', Neu: 'Neu an der Börse' };
    el.className = 'mk-card mx-card ' + (ph.hitze >= 4 && ph.geld === 2 ? 'bad' : ph.hitze >= 4 ? 'warn' : 'ok');
    el.innerHTML = `<div class="mx-lage"><h3>KI-Zyklus-Monitor</h3><b>${esc(ph.phase)}</b><span class="mk-sub">Rausch-Punkte ${ph.hitze} von 7, Stand ${fdm(ph.stand)}</span></div>`
      + '<p class="mk-sub">Frühere Technikwellen (Eisenbahn, Elektrizität, Internet) liefen in vier Phasen: Aufbruch, Rausch, Wendepunkt, Ausbreitung. Der Wendepunkt kam 1929 und 2000 nach Zinserhöhungen. Die Karte misst, wie heiß die KI-Werte laufen und ob die Geldpolitik strafft. Ein Rausch kann lange dauern, den Zeitpunkt der Wende zeigt sie nicht.</p>'
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Signal</th><th>Heute</th><th>Was gemessen wird</th><th>Status</th></tr></thead><tbody>'
      + S.map((x) => `<tr><td>${esc(x.name)}</td><td>${val(x)}</td><td class="txt-s">${esc(x.text)}</td><td>${x.geld ? GS[x.stufe] : ST[x.stufe]}</td></tr>`).join('') + '</tbody></table></div>'
      + '<div class="mx-chart" id="mx-ki-chart"></div><p class="mk-sub">Gegenüber dem S&P 500, Start = 100. Über 100 heißt besser als der Gesamtmarkt.</p>'
      + '<details class="mk-fold"><summary>Alle KI-Werte im Einzelnen</summary><div class="mk-scroll"><table class="mk-table"><thead><tr><th>Wert</th><th>Gruppe</th><th>3 Monate</th><th>12 Monate</th><th>zur 200-Tage-Linie</th><th>vom Hoch</th></tr></thead><tbody>'
      + V.slice().sort((a, b) => ORD.indexOf(a.gruppe) - ORD.indexOf(b.gruppe) || (b.r3 || 0) - (a.r3 || 0)).map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(GN[r.gruppe] || r.gruppe)}</td><td class="${sg(r.r3)}">${pct(r.r3, 0)}</td><td class="${sg(r.r12)}">${r.r12 == null ? '–' : pct(r.r12, 0)}</td><td class="${sg(r.ma200)}">${r.ma200 == null ? '–' : pct(r.ma200, 0)}</td><td class="down">${pct(r.hoch, 0)}</td></tr>`).join('')
      + '</tbody></table></div><p class="mk-sub">Kurse aus der Marktdaten-App, je in Landeswährung. „Vom Hoch“: Abstand zum höchsten Schluss der letzten rund 12 Monate.</p></details>';
    const grp = [...new Set(REL.map((r) => r.gruppe))];
    lineChart(el.querySelector('#mx-ki-chart'), grp.map((g) => ({ name: g, pts: REL.filter((r) => r.gruppe === g).map((r) => ({ d: toD(r.date), v: r.wert })) })), { zero: 100, label: 'KI-Gruppen gegenüber dem S&P 500', yfmt: (v) => fmtN(v, 0) });
  };

  let stoppAsset = 'BTC';
  const renderStopp = () => {
    const el = card('mx-stopp', '#mx-rsi', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'stopp_test');
    if (!ok(['stopp_test'])) { wait(el, ['stopp_test', 'ampel_serie', 'werte']); return; }
    const all = dash.data('stopp_test').data, assets = [...new Set(all.map((r) => r.asset))];
    if (!assets.includes(stoppAsset)) stoppAsset = assets[0];
    const rows = all.filter((r) => r.asset === stoppAsset), h = rows.find((r) => r.regel === 'halten');
    const fd = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('de-DE') : '–');
    el.innerHTML = '<h3>Aussteigen oder halten? Ausstiegsregeln mit echten Kosten</h3>'
      + '<div class="mx-sc" role="group" aria-label="Wert">' + assets.map((a) => `<button class="mk-btn" type="button" data-sa="${esc(a)}" aria-pressed="${a === stoppAsset}">${esc(nm(a))}</button>`).join('') + '</div>'
      + `<p class="mk-sub">1.000 € am ${fd(h && h.von)} in ${esc(nm(stoppAsset))}, Stand ${fd(h && h.bis)}. Gerechnet mit Bitpanda-Aufschlag beim Kauf und Abschlag beim Verkauf und 27,5 % Steuer auf Gewinne bei jedem Verkauf (Verlustausgleich im selben Jahr). Am Ende wird bei allen Regeln verkauft, damit der Vergleich fair ist. Gekauft vor dem 01.03.2021 wäre in Österreich steuerfrei (Altbestand), das ist hier nicht berücksichtigt.</p>`
      + '<div class="mk-scroll"><table class="mk-table"><thead><tr><th>Regel</th><th>Endwert nach Kosten und Steuer</th><th>Pro Jahr</th><th>Ohne Kosten und Steuer</th><th>Größter Rückgang</th><th>Käufe und Verkäufe</th><th>Zeit investiert</th></tr></thead><tbody>'
      + rows.map((r) => `<tr><td class="txt">${esc(r.label)}</td><td class="${r === h ? '' : sg(r.endwert - h.endwert)}">${eur(r.endwert)}</td><td>${pct(r.pro_jahr, 1)}</td><td>${eur(r.endwert_ohne)}</td><td class="down">${pct(r.groesster_rueckgang, 0)}</td><td>${r.wechsel}</td><td>${fmtN(r.investiert * 100, 0)} %</td></tr>`).join('')
      + '</tbody></table></div><p class="mk-sub">Grün oder rot heißt besser oder schlechter als Halten nach Kosten und Steuer. Jeder Wechsel kostet Aufschlag, Abschlag und oft Steuer. Eine Regel muss also deutlich mehr bringen, als sie ohne Kosten zeigt. Das ist ein Rückblick über wenige Jahre und keine Garantie.</p>';
    el.querySelectorAll('[data-sa]').forEach((b) => b.addEventListener('click', () => { stoppAsset = b.dataset.sa; renderStopp(); }));
  };

  const SCEN = [
    { id: 'krypto', t: 'Krypto-Crash: Bitcoin −30 %', s: { krypto: -0.3 } },
    { id: 'aktien', t: 'Aktien-Korrektur: S&P 500 −10 %', s: { aktie: -0.1 } },
    { id: 'breit', t: 'Breiter Abverkauf: Bitcoin −30 %, S&P 500 −15 %, Gold −5 %', s: { krypto: -0.3, aktie: -0.15, edel: -0.05 } },
    { id: 'gold', t: 'Gold-Rückschlag: Gold −10 %', s: { edel: -0.1 } },
    { id: 'worst', t: 'Jeder Wert erlebt seinen schlechtesten Monat seit 2020', s: null },
  ];
  const renderStress = () => {
    const el = card('mx-stress', '#depot-out', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'stress_beta bp_ticker');
    if (!ok(['stress_beta', 'bp_ticker'])) { wait(el, ['stress_beta', 'bp_ticker', 'kurse_usd', 'kurse_beob']); return; }
    const B = Object.fromEntries(dash.data('stress_beta').data.map((r) => [r.asset, r]));
    const P = Object.fromEntries(dash.data('bp_ticker').data.map((r) => [r.asset, Number(r.preis_eur)]));
    const dep = read('mk-depot-v1', []), st = read('mk-stand-v1', { btc: 25, gold: 80 });
    let pos = {}, quelle;
    if (Array.isArray(dep) && dep.length) {
      for (const p of dep) { const e = Number(p.einsatz) || 0, k = Number(p.kurs), v = k > 0 && P[p.a] > 0 ? (e / k) * P[p.a] : e; pos[p.a] = (pos[p.a] || 0) + v; }
      quelle = 'deine Depot-Positionen zum aktuellen Bitpanda-Preis';
    } else {
      pos = { BTC: (Number(st.btc) || 0) * 26, GOLD: (Number(st.gold) || 0) * 12 };
      quelle = 'ein Jahr deiner Sparpläne (Bitcoin ' + eur((Number(st.btc) || 0) * 26) + ', Gold ' + eur((Number(st.gold) || 0) * 12) + '), weil im Depot noch nichts eingetragen ist';
    }
    const tot = Object.values(pos).reduce((t, v) => t + v, 0);
    if (!(tot > 0)) { el.innerHTML = '<h3>Stresstest</h3><p class="mk-sub">Trag oben eine Position ein, dann siehst du hier, was typische Rückschläge mit deinem Depot machen würden.</p>'; return; }
    const loss = (sc) => {
      let L = 0; const per = {};
      for (const [a, v] of Object.entries(pos)) {
        const b = B[a]; let r;
        if (!sc.s) r = b ? b.schlechtester_monat : null;
        else { const kl = b ? b.klasse : 'aktie', sh = sc.s[kl]; r = sh == null ? 0 : sh * (b ? Math.max(0, b.beta) : 1); }
        if (r == null) r = 0;
        per[a] = v * r; L += v * r;
      }
      return { L, per };
    };
    const res = SCEN.map((sc) => ({ sc, ...loss(sc) }));
    const names = Object.keys(pos).sort((a, b) => pos[b] - pos[a]);
    el.innerHTML = `<h3>Stresstest für dein Depot</h3><p class="mk-sub">Grundlage: ${esc(quelle)}, zusammen ${eur(tot)}. Jeder Wert bewegt sich im Szenario so stark mit, wie er es im letzten Jahr gegenüber seinem Leitwert getan hat (Krypto zu Bitcoin, Aktien zum S&P 500, Metalle zu Gold). Das ist eine Rechnung, keine Vorhersage.</p>`
      + '<div class="mk-scroll"><table class="mk-table mx-row"><thead><tr><th>Szenario</th><th>Depot danach</th><th>Veränderung</th>' + names.map((a) => `<th>${esc(nm(a))}</th>`).join('') + '</tr></thead><tbody>'
      + res.map((r) => `<tr><td class="txt">${esc(r.sc.t)}</td><td>${eur(tot + r.L)}</td><td class="${sg(r.L)}">${eur(r.L)} (${pct(r.L / tot, 0)})</td>` + names.map((a) => `<td class="${sg(r.per[a])}">${eur(r.per[a])}</td>`).join('') + '</tr>').join('')
      + '</tbody></table></div>'
      + '<p class="mk-sub">Mitbewegung im letzten Jahr: ' + names.filter((a) => !B[a] || B[a].leitwert !== a).map((a) => (B[a] ? `${esc(nm(a))} ${fmtN(B[a].beta, 2)} zu ${esc(nm(B[a].leitwert))}` : `${esc(nm(a))} ohne eigene Kurse, angenommen 1`)).join(' · ') + '.</p>';
  };

  const renderRhythmus = () => {
    const el = card('mx-rhythmus', '#stand-card', 'mx-card');
    if (!el) return;
    el.setAttribute('data-source', 'sparplan_rhythmus werte');
    if (!ok(['sparplan_rhythmus', 'werte'])) { wait(el, ['sparplan_rhythmus', 'werte', 'kurse_usd']); return; }
    const rows = dash.data('sparplan_rhythmus').data, W = Object.fromEntries(dash.data('werte').data.map((r) => [r.asset, r]));
    const st = read('mk-stand-v1', { btc: 25, gold: 80 }), jb = (Number(st.btc) || 0) * 26, jg = (Number(st.gold) || 0) * 12;
    const fb = Number(W.BTC && W.BTC.aufschlag_kauf), fg = Number(W.GOLD && W.GOLD.aufschlag_kauf);
    const tab = (a) => { const r = rows.filter((x) => x.asset === a); if (!r.length) return ''; const best = Math.max(...r.map((x) => x.wert_heute)); return `<div class="mk-scroll"><table class="mk-table"><thead><tr><th>${esc(nm(a))}: Rhythmus</th><th>Käufe</th><th>Ø Preis in US-Dollar</th><th>Wert heute je 1.000 eingezahlt</th><th>Unterschied zum besten</th></tr></thead><tbody>` + r.map((x) => `<tr><td>${esc(x.rhythmus)}</td><td>${x.kaeufe}</td><td>${fmtN(x.schnitt, 2)}</td><td>${fmtN(x.wert_heute, 2)}</td><td class="${sg(x.wert_heute - best)}">${x.wert_heute === best ? '–' : pct(x.wert_heute / best - 1, 1)}</td></tr>`).join('') + '</tbody></table></div>'; };
    el.innerHTML = '<h3>Was kosten deine Sparpläne, und spielt der Rhythmus eine Rolle?</h3>'
      + `<p class="mk-sub">Kosten im Jahr bei deinem Stand: Bitcoin ${eur(jb)} eingezahlt, davon rund ${eur(jb * fb)} Gebühr und Spread (${pct(fb, 2).replace('+', '')} je Kauf). Gold ${eur(jg)} eingezahlt, davon rund ${eur(jg * fg)} (${pct(fg, 2).replace('+', '')} je Kauf). Die Gebühr ist ein Prozentsatz, der Rhythmus ändert sie also nicht. Nur Beträge unter dem Mindestbetrag von 10 € je Ausführung gehen nicht.</p>`
      + '<p class="mk-sub">Rückblick auf die letzten 365 Tage, gleicher Jahresbetrag, nur der Kauftag ist anders:</p>' + tab('BTC') + tab('GOLD')
      + '<p class="mk-sub">Die Unterschiede zwischen den Rhythmen sind klein und wechseln von Jahr zu Jahr das Vorzeichen. Wichtiger als der Rhythmus ist, dass du dabeibleibst.</p>';
  };

  const all = () => { for (const f of [renderLage, renderKonjunktur, renderZyklus, renderLangzeit, renderAktienGold, renderBtcGold, renderKi, renderGesamt, renderStress, renderRhythmus, renderBaer, renderReal, renderRsi, renderStopp]) { try { f(); } catch (e) { console.error(e); } } };
  dash.onData(all);
  const dp = $('#depot-out');
  if (dp && window.MutationObserver) { let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(renderStress, 50); }).observe(dp, { childList: true }); }
  const sb = $('#stand-out');
  if (sb && window.MutationObserver) { let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { renderStress(); renderRhythmus(); }, 50); }).observe(sb, { childList: true }); }
})();
