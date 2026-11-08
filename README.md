# Marktübersicht (Claude)

Sicherung und offene Daten der Marktübersicht, die Claude auf claude.ai betreibt. Die Seite selbst läuft nur auf claude.ai (sie braucht deren Rechen- und Datenbankfunktionen); hier liegen ihr Quelltext und alle Daten als einfache CSV-Dateien.

Kein persönliches Depot: Bestände werden nur im Browser gespeichert und kommen nie in dieses Repo.

## Inhalt

| Ordner | Datei | Inhalt |
|---|---|---|
| `signale/` | `signal_log.csv` | Tägliches Protokoll der Ampel je Wert seit 27.10.2026: `tag, asset, ampel (gruen/gelb/rot), score, rsi, kurs, kurs_datum, quelle, gruppe, d200 (Abstand zur 200-Tage-Linie), h52 (Abstand zum 52-Wochen-Hoch), vol` |
| `signale/` | `ampel_aktuell.csv` | Nur der letzte Tag aus dem Protokoll |
| `daten/kurse/` | `kurse_usd.csv` | Hauptwerte (BTC, ETH, SOL, XRP, DOGE, Gold, Silber, Platin, S&P 500) seit 2020, USD: `date, asset, close, open, high, low, status` |
| `daten/kurse/` | `kurse_beob_usd.csv` | Beobachtungsliste (weitere Kryptos, US-Aktien, Nasdaq, DAX, Palladium) |
| `daten/kurse/` | `kurse_welt.csv` | Weltbörsen, Rohstoffe, Zinsen, VIX, Wiener Börse |
| `daten/kurse/` | `kurse_ki.csv` | KI-Werte (Halbleiter, Cloud, Uran, Kupfer, neue Börsengänge) für den KI-Zyklus-Monitor |
| `daten/kurse/` | `historie.csv`, `fx_eurusd.csv` | Weitere Kursreihen und EUR/USD |
| `daten/umfeld/` | `stimmung.csv` | Kredit-Spreads, Fear & Greed, LTH-SOPR, Zinserwartung, Netto-Liquidität, BTC-ETF-Flüsse: `date, faktor, wert` |
| `daten/umfeld/` | `konjunktur.csv` | Zinskurve 10J–3M, Sahm-Regel, ISM, CAPE |
| `daten/langzeit/` | `langzeit_sp.csv`, `gold_lang.csv`, `rezessionen.csv`, `vpi_at.csv` | S&P 500 und CAPE seit 1871, Gold seit 1833, US-Rezessionen (NBER), österreichische Inflation |
| `daten/stammdaten/` | `werte.csv`, `zusatz.csv` | Stammdaten je Wert (Klasse, Risiko, Bitpanda-Kosten) |
| `seite/` | `index.html`, `extra.js` | Quelltext der Dashboard-Seite |
| `skripte/` | `grok_sync.py` | Abgleich mit dem Repo au7d4rk/marktdaten |

## Ampel-Regel in Kürze

Je Wert ein Punktestand aus Trend (Kurs gegenüber dem 20-Tage-Schnitt), 30-Tage-Veränderung und Rückgang vom Hoch. Details stehen im Quelltext `seite/index.html` (Calc `ampel_serie`). Seit 05.11.2026 gibt RSI keinen Abzug mehr (eigener Test: bei Krypto folgte auf RSI über 70 im Schnitt eher Stärke). Grün = Trend intakt, Gelb = gemischt, Rot = Trend gebrochen.

## Für den Vergleich mit Grok

Die Prognose-Treffer lassen sich aus `signale/signal_log.csv` und den Kursdateien nachrechnen: Ampel am Tag X gegen die Kursänderung 5, 20 und 60 Tage später.
