#!/usr/bin/env python3
"""Hängt für den heutigen Wiener Tag je Wert eine Zeile an signal_log.csv an (nur wenn für tag+asset noch keine existiert).
Aufruf: python3 ampel_log.py <eingabe_dir> <ausgabe_dir> [tag JJJJ-MM-TT] [quelle]
Eingabe: kurse_usd.csv, kurse_beob_usd.csv, kurse_welt.csv, werte.csv, beob_meta.csv, welt_meta.csv, bp_verf.csv, signal_log.csv
Regel wie auf der Seite und im Nachtlauf (RSI zählt seit 05.11.2026 nicht mehr)."""
import sys,os,csv,math,datetime
from zoneinfo import ZoneInfo
indir,outdir=sys.argv[1:3]
TAG=sys.argv[3] if len(sys.argv)>3 else datetime.datetime.now(ZoneInfo('Europe/Vienna')).date().isoformat()
QUELLE=sys.argv[4] if len(sys.argv)>4 else 'abgleich'
os.makedirs(outdir,exist_ok=True)
P=lambda n:os.path.join(indir,n)
rd=lambda n:list(csv.DictReader(open(P(n),encoding='utf-8',newline='')))
STOPP={}
for n in ('werte.csv','beob_meta.csv','welt_meta.csv'):
    for r in rd(n):
        try: STOPP[r['asset']]=float(r['stopp'])
        except Exception: pass
KAUF={r['asset'] for r in rd('bp_verf.csv') if r.get('kaufbar','').strip().lower()=='ja'}
KRYPTO={'BTC','ETH','SOL','XRP','DOGE','ADA','LINK','AVAX','BNB'}
SER={};ORD=[];HAUPT=set()
for n in ('kurse_usd.csv','kurse_beob_usd.csv','kurse_welt.csv'):
    for r in rd(n):
        if r['date']>TAG: continue
        try: c=float(r['close'])
        except Exception: continue
        if c<=0: continue
        a=r['asset']
        if a not in SER: SER[a]={}; ORD.append(a)
        SER[a][r['date']]=c
        if n!='kurse_welt.csv': HAUPT.add(a)
raw=open(P('signal_log.csv'),'rb').read().decode('utf-8')
crlf='\r\n' in raw
lines=raw.replace('\r\n','\n').rstrip('\n').split('\n')
hdr=lines[0].split(',')
have={(l.split(',')[0],l.split(',')[1]) for l in lines[1:] if l}
D=lambda s:datetime.date.fromisoformat(s)
def werktage(a,b):
    n=0;d=a
    while d<b:
        d+=datetime.timedelta(days=1)
        if d.weekday()<5: n+=1
    return n
r4=lambda v:'' if v is None else ('%.4f'%v)
neu=[]
for a in ORD:
    if (TAG,a) in have or a not in STOPP: continue
    x=sorted(SER[a].items())
    if not x: continue
    ds=[d for d,_ in x]; cs=[c for _,c in x]; n=len(cs); last=cs[-1]; ld=ds[-1]
    st=STOPP[a]
    # RSI 14 Wilder
    rsi=None
    if n>14:
        ag=al=0.0
        for i in range(1,n):
            ch=cs[i]-cs[i-1]; g=max(ch,0); l=max(-ch,0)
            if i<=14: ag+=g/14; al+=l/14
            else: ag=(ag*13+g)/14; al=(al*13+l)/14
        rsi=100.0 if al==0 else 100-100/(1+ag/al)
    if True:
        s10=sum(cs[-10:])/min(10,n); s20=sum(cs[-20:])/min(20,n)
        cut=(D(ld)-datetime.timedelta(days=30)).isoformat()
        win=[c for d,c in x if d>=cut]
        hi=max(win); ah=last/hi-1; r30=last/win[0]-1
        sc=0
        if last>s20 and s10>s20: sc+=1
        elif last<s20 and s10<s20: sc-=1
        if ah<=-st: sc-=2
        elif ah<=-st/2: sc-=1
        if r30>0: sc+=1
        elif r30<=-st: sc-=1
        ampel='kurz' if n<15 else 'gruen' if sc>=1 else 'rot' if sc<=-3 else 'gelb'
    d200=h52=vol=None;gruppe=''
    if a in HAUPT:
        if n>=200: d200=last/(sum(cs[-200:])/200)-1
        c365=(D(ld)-datetime.timedelta(days=365)).isoformat()
        h52=last/max(c for d,c in x if d>=c365)-1
        if n>=31:
            lr=[math.log(cs[i]/cs[i-1]) for i in range(n-30,n)]
            m=sum(lr)/len(lr); sd=math.sqrt(sum((v-m)**2 for v in lr)/(len(lr)-1))
            vol=sd*math.sqrt(365 if a in KRYPTO else 252)
        if a in KAUF:
            alt=(D(TAG)-D(ld)).days if a in KRYPTO else werktage(D(ld),D(TAG))
            gruppe='interessant' if ampel=='gruen' and alt<=2 else 'beobachten' if ampel=='gelb' and alt<=2 else 'nein'
    row={'tag':TAG,'asset':a,'ampel':ampel,'score':str(sc),'rsi':'' if rsi is None else str(round(rsi)),'kurs':repr(last) if not float(last).is_integer() else str(last),
         'kurs_datum':ld,'quelle':QUELLE,'gruppe':gruppe,'d200':r4(d200),'h52':r4(h52),'vol':r4(vol)}
    neu.append(','.join(row.get(h,'') for h in hdr))
out=lines+neu
open(os.path.join(outdir,'signal_log.csv'),'wb').write(((('\r\n' if crlf else '\n')).join(out)+('\r\n' if crlf else '\n')).encode())
print('signal_log: tag',TAG,'+%d Zeilen'%len(neu),'(bereits vorhanden: %d)'%sum(1 for k in have if k[0]==TAG))
