#!/usr/bin/env python3
"""Ergänzt kurse_usd.csv, kurse_beob_usd.csv, kurse_welt.csv um neuere Tageskurse aus dem Marktdaten-Repo (nur Kurse, keine Prognose).
Aufruf: python3 grok_sync.py <repo_dir> <eingabe_dir> <ausgabe_dir>
Regeln: alte Zeilen bleiben unverändert (nur Zwischenstand-Zeilen werden ersetzt), je Wert nur wenn die letzten bis zu 6 gemeinsamen Tage
im Median höchstens 2,5 % abweichen, sonst wird der Wert übersprungen. Heutiger Tag (Wiener Datum) = zwischenstand, frühere = final.
Tage vor dem ersten gespeicherten Tag werden aus dem Repo nachgetragen (Historie verlängern); Werte ohne Zeilen starten mit der Repo-Historie.
Werte, die das Repo (noch) nicht führt, werden still übersprungen und kommen automatisch, sobald es sie führt."""
import sys,re,json,base64,gzip,datetime,statistics,os
from zoneinfo import ZoneInfo
repo,indir,outdir=sys.argv[1:4]
os.makedirs(outdir,exist_ok=True)
TODAY=datetime.datetime.now(ZoneInfo('Europe/Vienna')).date().isoformat()
h=open(os.path.join(repo,'index.html'),encoding='utf-8').read()
m=re.search(r'<script id="daten" type="application/json"([^>]*)>(.*?)</script>',h,re.S)
raw=m.group(2).strip()
d=json.loads(gzip.decompress(base64.b64decode(raw)).decode()) if 'gzip' in m.group(1) else json.loads(raw)
D0=datetime.date.fromisoformat(d['d0']); G={}
for a in d['assets']:
    off=0;ds=[]
    for x in a['od']:
        off+=x; ds.append((D0+datetime.timedelta(days=off)).isoformat())
    G[a['ticker']]=dict(zip(ds,a['c']))
FILES={'kurse_usd.csv':{'BTC':'BTC-USD','ETH':'ETH-USD','SOL':'SOL-USD','XRP':'XRP-USD','DOGE':'DOGE-USD','GOLD':'GC=F','SILBER':'SI=F','PLATIN':'PL=F','SPX':'^GSPC'},
'kurse_beob_usd.csv':{'ADA':'ADA-USD','LINK':'LINK-USD','AVAX':'AVAX-USD','BNB':'BNB-USD','NDX':'^NDX','NVDA':'NVDA','COIN':'COIN','AAPL':'AAPL','MSFT':'MSFT','AMZN':'AMZN','GOOGL':'GOOGL','PALLADIUM':'PA=F','DAX':'^GDAXI','EUNL':'EUNL.DE','SXR8':'SXR8.DE'},
'kurse_welt.csv':{'ATX':'^ATX','WIE':'WIE.VI','VER':'VER.VI','EBS':'EBS.VI','OMV':'OMV.VI','ANDR':'ANDR.VI','N225':'^N225','HSI':'^HSI','SSEC':'000001.SS','NIFTY':'^NSEI','SX5E':'^STOXX50E','RUT':'^RUT','WTI':'CL=F','BRENT':'BZ=F','KUPFER':'HG=F','ERDGAS':'NG=F','DXY':'DX-Y.NYB','US10Y':'^TNX','VIX':'^VIX','TSM':'TSM','BABA':'BABA','TENCENT':'0700.HK','ASML':'ASML.AS','SAP':'SAP.DE','TSLA':'TSLA','META':'META','LLY':'LLY','DOT':'DOT-USD','LTC':'LTC-USD','SUI':'SUI20947-USD','NESN':'NESN.SW','ALV':'ALV.DE','VOE':'VOE.VI','TON':'TON11419-USD','V':'V','RBI':'RBI.VI','TOYOTA':'7203.T','SONY':'6758.T','SAMSUNG':'005930.KS','KOSPI':'^KS11','FTSE':'^FTSE','CAC':'^FCHI','SMI':'^SSMI','DJI':'^DJI','LVMH':'MC.PA','SIE':'SIE.DE','SHEL':'SHEL.L','BRKB':'BRK-B','JPM':'JPM','NFLX':'NFLX','WEIZEN':'ZW=F','TRX':'TRX-USD','SHIB':'SHIB-USD','IS3N':'IS3N.DE','EUNA':'EUNA.DE'}}
fmt=lambda v:('%.6f'%v).rstrip('0').rstrip('.')
for fn,mp in FILES.items():
    lines=open(os.path.join(indir,fn),'rb').read().decode().split('\n')
    trail=lines[-1]==''
    if trail: lines=lines[:-1]
    hdr,body=lines[0],lines[1:]
    order=[];rows={}
    for ln in body:
        c=ln.rstrip('\r').split(',')
        if c[1] not in rows: order.append(c[1]); rows[c[1]]=[]
        rows[c[1]].append([c[0],ln])
    crlf0=body[0].endswith('\r') if body else False
    for a,tk in mp.items():
        if tk not in G: print(fn,a,'übersprungen: Repo führt',tk,'nicht'); continue
        g=G[tk]
        if a not in rows: order.append(a); rows[a]=[]; print(fn,a,'neu: startet mit Repo-Historie')
        cur=rows[a]; st={r[0]:r for r in cur}
        common=[x for x in sorted(st) if x in g][-6:]
        if st and len(common)<2: print(fn,a,'übersprungen: kein Überlapp'); continue
        med=statistics.median(abs(g[x]/float(st[x][1].rstrip('\r').split(',')[2])-1) for x in common) if st else 0.0
        if med>0.025: print(fn,a,'übersprungen: Abweichung %.1f %%'%(med*100)); continue
        first=min(st) if st else '9999'; last=max(st) if st else '0000'
        crlf=st[last][1].endswith('\r') if st else crlf0; add=rep=0
        for x in sorted(g):
            if first<x<last and x not in st: continue
            s='zwischenstand' if x>=TODAY else 'final'
            if x in st:
                c=st[x][1].rstrip('\r').split(',')
                if c[6]=='zwischenstand':
                    c[2]=fmt(g[x]); c[6]=s; st[x][1]=','.join(c)+('\r' if crlf else ''); rep+=1
                continue
            r=[x,f"{x},{a},{fmt(g[x])},,,,{s}"+('\r' if crlf else '')]; cur.append(r); st[x]=r; add+=1
        cur.sort(key=lambda r:r[0])
        print(fn,a,'ok +%d ersetzt %d, %s bis %s (Abw. %.2f %%)'%(add,rep,min(st),max(st),med*100))
    out=[hdr]+[r[1] for a in order for r in rows[a]]
    open(os.path.join(outdir,fn),'wb').write(('\n'.join(out)+('\n' if trail else '')).encode())

# KI-Zyklus: komplette Kursreihen ausgewählter Werte aus dem Repo (kurse_ki.csv mit date,asset,close), wird jedes Mal neu geschrieben
KI={'SMH':'Halbleiter-ETF','NVDA':'Nvidia','MU':'Micron','AVGO':'Broadcom','AMD':'AMD','TSM':'TSMC','MSFT':'Microsoft','GOOGL':'Alphabet','META':'Meta','AMZN':'Amazon','CCJ':'Cameco','URNM':'Uran-Minen-ETF','HG=F':'Kupfer','^GSPC':'S&P 500','^NDX':'Nasdaq 100','CBRS':'Cerebras','SPCX':'SpaceX'}
# Bestehende Zeilen (eingabe_dir/kurse_ki.csv) bleiben erhalten, das Repo liefert nur noch rund 280 Tage; neuere oder geänderte Tage kommen aus dem Repo
try:
    KK={}
    alt=os.path.join(indir,'kurse_ki.csv')
    if os.path.exists(alt):
        for ln in open(alt,encoding='utf-8').read().replace('\r\n','\n').split('\n')[1:]:
            c=ln.split(',')
            if len(c)>=3 and c[2]: KK[(c[1],c[0])]=c[2]
    n0=len(KK)
    for tk in KI:
        for x,v in G.get(tk,{}).items(): KK[(tk,x)]=fmt(v)
    kr=['date,asset,close']
    for tk in [t for t in KI if any(k[0]==t for k in KK)]:
        for x in sorted(k[1] for k in KK if k[0]==tk): kr.append(f"{x},{tk},{KK[(tk,x)]}")
    open(os.path.join(outdir,'kurse_ki.csv'),'w').write('\n'.join(kr)+'\n'); print('kurse_ki.csv',len(kr)-1,'Zeilen (vorher',n0,'),',len({k[0] for k in KK}),'Werte')
except Exception as e:
    print('kurse_ki.csv übersprungen:',e)

# EUR/USD (fx.csv mit date,eurusd): nur neuere Tage anhängen, wenn die letzten bis zu 6 gemeinsamen Tage im Median höchstens 0,5 % abweichen
try:
    fxp=os.path.join(indir,'fx.csv'); g=G.get('EURUSD=X',{})
    if os.path.exists(fxp) and g:
        raw=open(fxp,'rb').read().decode(); crlf='\r\n' in raw; nl='\r\n' if crlf else '\n'
        L=raw.replace('\r\n','\n').rstrip('\n').split('\n'); st={l.split(',')[0]:float(l.split(',')[1]) for l in L[1:] if l}
        common=[x for x in sorted(st) if x in g][-6:]
        med=statistics.median(abs(g[x]/st[x]-1) for x in common) if len(common)>=2 else None
        if med is None or med>0.005: print('fx.csv übersprungen: Abweichung oder kein Überlapp',med)
        else:
            last=max(st); add=[x for x in sorted(g) if x>last and x<TODAY]
            L+= [f"{x},{g[x]:.4f}" for x in add]
            open(os.path.join(outdir,'fx.csv'),'wb').write((nl.join(L)+nl).encode()); print('fx.csv ok +%d bis %s (Abw. %.2f %%)'%(len(add),add[-1] if add else last,med*100))
    else: print('fx.csv übersprungen: Eingabe oder Quelle fehlt')
except Exception as e:
    print('fx.csv übersprungen:',e)

# Stimmung und Flüsse (nur Kennzahlen aus dem Repo, keine Prognose): stimmung.csv mit date,faktor,wert
try:
    FL=d.get('FL',{}); q4=FL.get('q4',{}); rows=['date,faktor,wert']
    def put(name,dates,vals):
        for x,v in zip(dates,vals):
            if v is not None: rows.append(f"{x},{name},{v}")
    k=q4.get('kredit',{}).get('h',{}); put('IG_SPREAD',k.get('d',[]),k.get('ig',[])); put('HY_SPREAD',k.get('d',[]),k.get('hy',[]))
    for key,name in (('fng_krypto','FNG_KRYPTO'),('fng_aktien','FNG_AKTIEN'),('lth','LTH_SOPR')):
        h=q4.get(key,{}).get('h',{}); put(name,h.get('d',[]),h.get('v',[]))
    z=FL.get('zins',{}).get('h',{}); put('ZINSERWARTUNG',z.get('d',[]),z.get('spread',[]))
    n=FL.get('q8',{}).get('liq',{}).get('h',{}); put('NETTO_LIQ',n.get('d',[]),n.get('v',[]))
    lq=FL.get('q8',{}).get('liq',{})
    if lq.get('datum') and lq.get('d12w_pct') is not None: put('NETTO_LIQ_12W',[lq['datum']],[lq['d12w_pct']])
    e=FL.get('etf',{}).get('h',{}); put('BTC_ETF_FLUSS',e.get('d',[]),e.get('mio',[]))
    if len(rows)>1:
        open(os.path.join(outdir,'stimmung.csv'),'w').write('\n'.join(rows)+'\n'); print('stimmung.csv',len(rows)-1,'Zeilen')
    else: print('stimmung.csv: keine Daten im Repo')
except Exception as e:
    print('stimmung.csv übersprungen:',e)
