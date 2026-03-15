// App.jsx — OpenClaw Mission Control: Pixel Art Office + Live Dashboard
// Connects to bridge WebSocket and maps agent state to office scene positions

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBridge } from './hooks/useBridge';

const BRIDGE_WS = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001/ws';
const PX = 4;
const CW = 190, CH = 120;

// ---- Zone mapping: agent status/tool → office location ----
const ZONES = {
  idle:     { x: 88,  y: 68, label: 'Break room',   bubble: 'Taking a break...' },
  working:  { x: 22,  y: 56, label: 'Work desk',     bubble: 'Thinking...' },
  youtube:  { x: 46,  y: 56, label: 'Media desk',    bubble: 'Scraping video...' },
  search:   { x: 98,  y: 50, label: 'Library',       bubble: 'Researching...' },
  sheets:   { x: 140, y: 62, label: 'Data desk',     bubble: 'Writing data...' },
  telegram: { x: 155, y: 82, label: 'Comms desk',    bubble: 'Sending report...' },
  error:    { x: 158, y: 48, label: 'Server rack',   bubble: 'Something broke!' },
};

const TOOL_ZONES = [
  { p: /youtube|yt_scraper|yt-scraper/i, z: 'youtube' },
  { p: /perplexity|web_search|sonar/i,   z: 'search' },
  { p: /google_sheets|gsheet|spreadsheet/i, z: 'sheets' },
  { p: /telegram|tg_send|tg_post/i,     z: 'telegram' },
];

function resolveZone(a) {
  if (!a) return 'idle';
  if (a.status === 'error') return 'error';
  if (a.status === 'offline' || a.status === 'idle') return 'idle';
  if (a.status === 'tool_use' && a.currentTool?.name) {
    for (const m of TOOL_ZONES) { if (m.p.test(a.currentTool.name)) return m.z; }
    return 'working';
  }
  return 'working';
}

const STATUS_CFG = {
  working:  { label: 'WORKING',  color: '#00ff88' },
  tool_use: { label: 'TOOL USE', color: '#ffaa00' },
  idle:     { label: 'IDLE',     color: '#666' },
  error:    { label: 'ERROR',    color: '#ff4444' },
  offline:  { label: 'OFFLINE',  color: '#333' },
};

// ---- Pixel Art Colors ----
const P = {
  wallBrick:'#a0705a', brickLine:'#8a6050', brickHi:'#b8846e',
  wallWood:'#c4a882', woodLine:'#b0946e', woodHi:'#d4b892',
  wallRight:'#d4c4a0', wallRightHi:'#e0d0b0',
  floorA:'#e8d8c0', floorB:'#dccaae', trim:'#8a6a4a', trimHi:'#a0805a',
  deskTop:'#9a7a5a', deskFront:'#7a5e42', deskLeg:'#6a5038',
  mon:'#222', scrGreen:'#1a442a', scrBlue:'#1a2a44',
  books:['#7755aa','#5577cc','#aa5533','#338855','#cc7733','#cc4455'],
  shelf:'#8a6a4a',
  couch:'#887766', couchDk:'#706050', couchPil:'#aa9977',
  chrSeat:'#c8b898', chrBack:'#b8a888', chrLeg:'#8a7a5a',
  coffee:'#666', coffeeDk:'#444', coffeeRed:'#aa3333',
  cat:'#aaa', catDk:'#888', catEar:'#bbb', catBed:'#996655', catBedIn:'#bb8877',
  plant:'#3a7a3a', plantDk:'#2a6a2a', pot:'#aa6644', potDk:'#884422',
  lampShade:'#eedd99', lampPole:'#999', lamp:'#ddcc88',
  frame:'#6a5a3a', photo:'#ccaa88',
  srv:'#333', srvSlot:'#444', srvG:'#44ff44', srvR:'#ff4444', srvY:'#ffaa00',
  rug:'#8a5a4a', rugPat:'#9a6a5a',
  skin:'#ffcc88', hair:'#553322',
  shirt:'#7755bb', shirtDk:'#5544aa', pants:'#444', shoes:'#333',
  winBg:'#1a2844', star:'#aaccff', winFrame:'#8a7a5a',
  poster:'#ddccaa', posterArt:'#aa5533',
  signBg:'#2a5a3a', signTxt:'#ddcc66', signBdr:'#4a7a5a',
};

// ===========================================================
// PIXEL ART CANVAS
// ===========================================================
function OfficeCanvas({ agents }) {
  const ref = useRef(null);
  const pos = useRef({});
  const tgt = useRef({});
  const bub = useRef({});

  useEffect(() => {
    if (!agents) return;
    for (const [id, agent] of Object.entries(agents)) {
      const zone = resolveZone(agent);
      const z = ZONES[zone] || ZONES.idle;
      if (!pos.current[id]) pos.current[id] = { x: z.x, y: z.y };
      tgt.current[id] = { x: z.x, y: z.y };
      const newText = agent.currentTool?.name
        ? `${agent.currentTool.name}`
        : (ZONES[zone]?.bubble || 'Idle...');
      if (bub.current[id]?.text !== newText) {
        bub.current[id] = { text: newText, show: false };
        setTimeout(() => { if (bub.current[id]) bub.current[id].show = true; }, 1200);
      }
    }
  }, [agents]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let anim;

    const r = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
    const px = (x,y,c) => r(x,y,1,1,c);

    function walls() {
      for(let y=0;y<42;y++) for(let x=0;x<65;x++){
        let c=P.wallBrick;
        if(y%5===0)c=P.brickLine; else if(y%5===1&&x%8===0)c=P.brickLine;
        else if(y%5===3&&(x+4)%8===0)c=P.brickLine; else if((x+y)%7===0)c=P.brickHi;
        r(x,y,1,1,c);
      }
      for(let y=0;y<42;y++) for(let x=65;x<130;x++){
        let c=P.wallWood; if(x%12===0)c=P.woodLine; else if((x+y*3)%17===0)c=P.woodHi;
        r(x,y,1,1,c);
      }
      for(let y=0;y<42;y++) for(let x=130;x<CW;x++){
        let c=P.wallRight; if((x+y)%11===0)c=P.wallRightHi; r(x,y,1,1,c);
      }
      r(0,42,CW,2,P.trim); r(0,41,CW,1,P.trimHi);
    }

    function floor() {
      for(let y=44;y<CH;y++) for(let x=0;x<CW;x++) r(x,y,1,1,((x+y)%2===0)?P.floorA:P.floorB);
      for(let y=62;y<80;y++) for(let x=70;x<115;x++){
        let c=P.rug;
        if(x===70||x===114||y===62||y===79)c=P.rugPat; else if((x+y)%4===0)c=P.rugPat;
        r(x,y,1,1,c);
      }
    }

    function win(x,y,w,h){
      r(x-1,y-1,w+2,h+2,P.winFrame); r(x,y,w,h,P.winBg);
      r(x+w/2,y,1,h,'#7a6a4a'); r(x,y+h/2,w,1,'#7a6a4a');
      [[3,3],[w-4,5],[5,h-4],[w-6,2]].forEach(([sx,sy])=>px(x+sx,y+sy,P.star));
    }

    function desk(x,y){
      r(x,y,30,2,P.deskTop); r(x,y+2,30,8,P.deskFront);
      r(x+1,y+10,2,5,P.deskLeg); r(x+27,y+10,2,5,P.deskLeg);
      r(x+2,y+4,12,1,'#6a5038'); r(x+2,y+7,12,1,'#6a5038');
      px(x+8,y+3,P.trimHi); px(x+8,y+6,P.trimHi);
    }

    function mon(x,y,sc){
      r(x,y,10,8,P.mon); r(x+1,y+1,8,6,sc); r(x+4,y+8,2,2,P.mon); r(x+2,y+10,6,1,'#555');
      if(sc!=='#111') for(let i=0;i<3;i++) px(x+2+i*2,y+2,'#ffffff20');
    }

    function chair(x,y){
      r(x,y,10,3,P.chrBack); r(x+1,y+3,8,5,P.chrSeat);
      r(x+1,y+8,2,3,P.chrLeg); r(x+7,y+8,2,3,P.chrLeg);
    }

    function couch(x,y){
      r(x,y,30,4,P.couch); r(x,y+4,30,8,P.couchDk);
      r(x-2,y+2,4,10,P.couch); r(x+28,y+2,4,10,P.couch);
      r(x+4,y+5,8,4,P.couchPil); r(x+18,y+5,8,4,P.couchPil);
    }

    function coffeeMach(x,y){
      r(x,y,8,12,P.coffee); r(x,y,8,2,P.coffeeDk);
      r(x+2,y+3,4,4,P.coffeeDk); px(x+6,y+4,P.coffeeRed); px(x+6,y+6,P.srvG);
      r(x+2,y+9,3,2,'#ddd'); r(x+5,y+10,1,1,'#ddd');
    }

    function bookshelf(x,y){
      r(x,y,14,30,P.shelf);
      for(let row=0;row<4;row++){
        let sy=y+2+row*7; r(x+1,sy+5,12,1,P.shelf);
        let bx=x+1;
        for(let b=0;b<4;b++){
          let bh=4+Math.floor(Math.sin(row*3+b*7)*1.5);
          r(bx,sy+5-bh,3,bh,P.books[(row*4+b)%6]); bx+=3;
        }
      }
    }

    function plant(x,y){
      r(x+1,y+5,4,4,P.pot); r(x+2,y+8,2,1,P.potDk);
      for(let i=0;i<5;i++){
        r(x+3+Math.sin(i*1.8)*3, y+Math.cos(i*1.3)*3, 2, 3, i%2?P.plant:P.plantDk);
      }
    }

    function lamp(x,y){
      r(x+2,y,6,4,P.lampShade); r(x+4,y+4,2,8,P.lampPole);
      r(x+2,y+12,6,1,P.lampPole); px(x+4,y+3,P.lamp); px(x+5,y+3,P.lamp);
    }

    function cat(x,y){
      r(x,y+2,10,4,P.cat); r(x+1,y+3,8,2,P.catDk);
      r(x+8,y,4,4,P.cat); px(x+8,y-1,P.catEar); px(x+11,y-1,P.catEar);
      r(x+9,y+1,1,1,'#222'); r(x+11,y+1,1,1,'#222');
      r(x-2,y+3,3,1,P.cat); px(x-3,y+2,P.cat);
      r(x-4,y+5,16,3,P.catBed); r(x-3,y+4,14,1,P.catBedIn);
    }

    function serverRack(x,y){
      r(x,y,10,24,P.srv); r(x,y,10,1,'#555');
      const lc=[P.srvG,P.srvG,P.srvY,P.srvY,P.srvR];
      for(let i=0;i<5;i++){
        r(x+1,y+2+i*4,8,3,P.srvSlot);
        if(Math.sin(Date.now()/(400+i*200)+i)>0) px(x+8,y+3+i*4,lc[i]);
      }
    }

    function drawFrame(x,y,w,h,c){ r(x,y,w,h,P.frame); r(x+1,y+1,w-2,h-2,c||P.photo); }

    function sign(x,y,text){
      r(x,y,30,10,P.signBg); r(x,y,30,1,P.signBdr); r(x,y+9,30,1,P.signBdr);
      ctx.fillStyle=P.signTxt; ctx.font='5px monospace'; ctx.fillText(text,x+2,y+7);
    }

    function poster(x,y){
      r(x,y,12,16,P.frame); r(x+1,y+1,10,14,P.poster);
      r(x+3,y+3,6,6,P.posterArt); r(x+2,y+11,8,2,'#6a5a3a');
    }

    function agent(x,y,id){
      let ax=Math.round(x), ay=Math.round(y);
      r(ax+1,ay+13,8,2,'#00000020');
      let moving=false;
      const p=pos.current[id], t=tgt.current[id];
      if(p&&t){ let d=Math.sqrt((t.x-p.x)**2+(t.y-p.y)**2); moving=d>1; }
      let lo=moving?Math.sin(Date.now()/150):0;
      r(ax+2,ay+11+lo,2,3,P.pants); r(ax+6,ay+11-lo,2,3,P.pants);
      r(ax+2,ay+13,2,1,P.shoes); r(ax+6,ay+13,2,1,P.shoes);
      r(ax+1,ay+5,8,7,P.shirt); r(ax+2,ay+6,6,5,P.shirtDk);
      let ab=moving?Math.sin(Date.now()/200):0;
      r(ax-1,ay+5+ab,2,5,P.shirt); r(ax+9,ay+5-ab,2,5,P.shirt);
      r(ax+1,ay,8,6,P.skin);
      r(ax+1,ay-1,8,1,P.hair); r(ax,ay,1,3,P.hair); r(ax+9,ay,1,3,P.hair);
      px(ax+3,ay+2,'#333'); px(ax+6,ay+2,'#333');
      px(ax+4,ay+4,'#cc8866'); px(ax+5,ay+4,'#cc8866');

      const b=bub.current[id];
      if(b?.show&&b?.text){
        let t2=b.text.length>18?b.text.substring(0,16)+'..':b.text;
        let bw=t2.length*3+6, bx=ax+5-bw/2, by=ay-10;
        if(bx<2)bx=2; if(bx+bw>CW-2)bx=CW-2-bw;
        r(bx,by,bw,7,'#fff'); r(bx+Math.floor(bw/2),by+7,2,2,'#fff');
        ctx.fillStyle='#333'; ctx.font='4px monospace'; ctx.fillText(t2,bx+3,by+5);
      }
    }

    function draw(){
      ctx.clearRect(0,0,cv.width,cv.height);
      ctx.save(); ctx.scale(PX,PX);

      walls(); floor();
      r(64,0,1,CH,'#7a6050'); r(65,0,1,CH,'#8a7060');
      r(129,0,1,CH,'#8a7a5a'); r(130,0,1,CH,'#9a8a6a');

      win(15,8,16,14); win(82,8,16,14); win(148,8,16,14);
      drawFrame(38,6,10,8); drawFrame(50,8,8,7,'#88aa88');
      poster(110,4); sign(135,27,'OPENCLAW');
      [[32],[92],[152]].forEach(([lx])=>{ r(lx,0,10,1,'#4a4255'); });

      // Left room
      desk(10,48); mon(13,42,P.scrGreen); mon(24,41,P.scrBlue);
      chair(16,60); lamp(2,30); cat(42,72); plant(52,38);
      r(42,50,15,2,P.deskTop); r(42,52,15,5,P.deskFront);
      r(44,44,10,6,P.mon); r(45,45,8,4,'#331a22');
      ctx.fillStyle='#cc3355';
      ctx.beginPath(); ctx.moveTo(48,46); ctx.lineTo(51,47.5); ctx.lineTo(48,49); ctx.fill();

      // Center room
      couch(75,66); coffeeMach(68,48);
      r(80,58,20,3,P.deskTop); r(82,61,2,3,P.deskLeg); r(96,61,2,3,P.deskLeg);
      r(84,56,3,2,'#ddd'); r(90,57,3,2,'#eeddcc');
      bookshelf(110,12);
      r(96,44,12,4,P.chrBack); r(97,48,10,6,P.chrSeat);
      r(95,46,2,8,'#b8a888'); r(107,46,2,8,'#b8a888');
      plant(68,34); lamp(122,32); plant(124,76);

      // Right room
      r(135,56,22,2,P.deskTop); r(135,58,22,6,P.deskFront);
      r(136,64,2,4,P.deskLeg); r(155,64,2,4,P.deskLeg);
      mon(138,50,P.scrGreen); mon(148,49,P.scrGreen); chair(140,68);
      r(150,78,18,2,P.deskTop); r(150,80,18,5,P.deskFront);
      mon(153,72,P.scrBlue); r(163,73,5,4,'#33aadd'); px(164,74,'#fff');
      serverRack(155,22); serverRack(167,22);
      r(175,50,10,18,'#888');
      r(176,52,8,4,'#777'); r(176,57,8,4,'#777'); r(176,62,8,4,'#777');
      px(180,54,'#aa8855'); px(180,59,'#aa8855'); px(180,64,'#aa8855');
      plant(178,36);

      // Zone labels
      ctx.font='4px monospace'; ctx.fillStyle='#ffffff25';
      ctx.fillText('work',18,76); ctx.fillText('media',42,64);
      ctx.fillText('break',83,84); ctx.fillText('library',96,62);
      ctx.fillText('data',140,76); ctx.fillText('comms',152,92);

      // Agents
      for(const id of Object.keys(pos.current)){
        const p2=pos.current[id], t2=tgt.current[id];
        if(p2&&t2){
          const dx=t2.x-p2.x, dy=t2.y-p2.y;
          if(Math.sqrt(dx*dx+dy*dy)>0.5){ p2.x+=dx*0.04; p2.y+=dy*0.04; }
          agent(p2.x, p2.y+Math.sin(Date.now()/300)*0.8, id);
        }
      }
      if(Object.keys(pos.current).length===0){
        agent(88, 68+Math.sin(Date.now()/300)*0.8, '_def');
        if(!bub.current._def) bub.current._def={text:'Waiting for data...',show:true};
      }

      ctx.restore();
      anim=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(anim);
  },[]);

  return <canvas ref={ref} width={CW*PX} height={CH*PX}
    style={{width:'100%',maxWidth:'760px',display:'block',margin:'0 auto',borderRadius:'8px',imageRendering:'pixelated'}} />;
}

// ===========================================================
// MAIN APP
// ===========================================================
export default function App(){
  const {state,connected,reconnecting} = useBridge(BRIDGE_WS);
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(t); },[]);

  const mainAgent = state?.agents?.main;
  const zone = resolveZone(mainAgent);
  const zi = ZONES[zone]||ZONES.idle;
  const sc = mainAgent ? (STATUS_CFG[mainAgent.status]||STATUS_CFG.offline) : STATUS_CFG.offline;

  return (
    <div style={s.root}>
      <style>{css}</style>

      <header style={s.header}>
        <div style={s.hLeft}>
          <span style={{fontSize:'24px'}}>&#9876;&#65039;</span>
          <div>
            <h1 style={s.title}>OPENCLAW MISSION CONTROL</h1>
            <p style={s.sub}>{state?.gateway?.version||'Connecting...'}</p>
          </div>
        </div>
        <div style={s.badge}>
          <div style={{...s.dot,backgroundColor:connected?'#00ff88':reconnecting?'#ffaa00':'#ff4444',boxShadow:connected?'0 0 8px #00ff88':'none'}}/>
          <span style={{...s.badgeTxt,color:connected?'#00ff88':reconnecting?'#ffaa00':'#ff4444'}}>
            {connected?'LIVE':reconnecting?'RECONNECTING':'DISCONNECTED'}
          </span>
        </div>
      </header>

      <div style={s.scene}>
        <OfficeCanvas agents={state?.agents} />
        <div style={s.locBar}>
          <div style={{...s.locDot,backgroundColor:sc.color}}/>
          <span style={{...s.locLabel,color:sc.color}}>{sc.label}</span>
          <span style={s.sep}>—</span>
          <span style={s.locZone}>{zi.label}</span>
          {mainAgent?.currentTool&&<><span style={s.sep}>·</span><span style={s.locTool}>{mainAgent.currentTool.station?.icon||'🔧'} {mainAgent.currentTool.name}</span></>}
          {mainAgent?.currentProvider&&<span style={s.locProv}>{mainAgent.currentProvider}/{mainAgent.currentModel}</span>}
        </div>
      </div>

      {state ? (
        <div style={s.panels}>
          {/* Activity Feed */}
          <div style={{...s.panel,flex:2,minWidth:'260px'}}>
            <div style={s.ph}><span style={s.phi}>&#128225;</span><span style={s.pht}>ACTIVITY FEED</span></div>
            <div style={s.feedScroll}>
              {(!state.activityLog||state.activityLog.length===0)?<div style={s.empty}>Waiting for events...</div>:
              state.activityLog.slice(0,30).map((e,i)=>(
                <div key={i} style={{...s.fi,opacity:Math.max(0.3,1-i*0.02)}}>
                  <span style={s.fiIcon}>{{session:'🚀',prompt:'💬',tool:'🔧',error:'❌'}[e.type]||'•'}</span>
                  <span style={s.fiAgent}>{e.agentName}</span>
                  <span style={s.fiMsg}>{e.message}</span>
                  <span style={s.fiTime}>{rel(e.timestamp,now)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget + Gateway */}
          <div style={{...s.panel,flex:1,minWidth:'210px'}}>
            <div style={s.ph}><span style={s.phi}>&#128176;</span><span style={s.pht}>API BUDGET</span></div>
            {Object.values(state.budget).length===0?<div style={s.empty}>No usage yet</div>:
            Object.values(state.budget).map(p=>{
              const pct=p.limits?.monthlyTokens?Math.min(100,(p.tokensUsed/p.limits.monthlyTokens)*100):0;
              const bc=pct>85?'#ff4444':pct>60?'#ffaa00':'#00ff88';
              return(
                <div key={p.provider} style={s.bRow}>
                  <div style={s.bHead}><span style={s.bName}>{p.provider}</span><span style={s.bCost}>${p.costUsd.toFixed(2)}{p.limits?.monthlyUsd?` / $${p.limits.monthlyUsd}`:''}</span></div>
                  <div style={s.barTrack}><div style={{...s.barFill,width:`${pct}%`,backgroundColor:bc,boxShadow:`0 0 6px ${bc}40`}}/></div>
                  <div style={s.bFoot}><span>{fmtTok(p.tokensUsed)} tokens</span><span>{p.callCount} calls</span><span>{pct.toFixed(0)}%</span></div>
                </div>
              );
            })}
            <div style={{...s.ph,marginTop:'14px'}}><span style={s.phi}>&#127959;&#65039;</span><span style={s.pht}>GATEWAY</span></div>
            <div style={s.gwRow}>
              <div style={{width:8,height:8,borderRadius:'50%',background:state.gateway.status==='running'?'#00ff88':'#ff4444'}}/>
              <span style={{color:state.gateway.status==='running'?'#00ff88':'#ff4444',fontSize:'11px',fontWeight:600}}>{state.gateway.status?.toUpperCase()||'UNKNOWN'}</span>
              {state.gateway.telegram?.connected&&<span style={{fontSize:'9px',color:'#33aadd'}}>{state.gateway.telegram.bot||'TG'}</span>}
              <span style={{fontSize:'9px',color:'#444',marginLeft:'auto'}}>{state.gateway.version||''}</span>
            </div>
          </div>

          {/* Tools */}
          <div style={{...s.panel,flex:1,minWidth:'190px'}}>
            <div style={s.ph}><span style={s.phi}>&#128736;&#65039;</span><span style={s.pht}>TOOLS</span></div>
            {Object.entries(state.tools.stationCounts||{}).length>0&&(
              <div style={s.stGrid}>
                {Object.entries(state.tools.stationCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([n,c])=>(
                  <div key={n} style={s.stCard}><div style={s.stCount}>{c}</div><div style={s.stName}>{n}</div></div>
                ))}
              </div>
            )}
            <div style={{fontSize:'9px',color:'#555',letterSpacing:'1px',marginBottom:'6px'}}>Recent</div>
            {(state.tools.recent||[]).slice(0,6).map((t,i)=>(
              <div key={i} style={{...s.tRow,borderLeftColor:t.isError?'#ff4444':'#00ff8840'}}>
                <span style={{fontSize:'10px'}}>{t.station?.icon||'🔧'}</span>
                <span style={s.tName}>{t.name}</span>
                {t.duration&&<span style={s.tDur}>{(t.duration/1000).toFixed(1)}s</span>}
                {t.isError&&<span style={s.tErr}>ERR</span>}
              </div>
            ))}
            {(state.tools.recent||[]).length===0&&<div style={s.empty}>No calls yet</div>}
          </div>
        </div>
      ):(
        <div style={{textAlign:'center',padding:'20px'}}>
          <p style={{fontSize:'13px',color:'#888'}}>{reconnecting?'Reconnecting to bridge...':'Connecting to OpenClaw Bridge...'}</p>
          <p style={{fontSize:'10px',color:'#444',marginTop:'8px'}}>Bridge: <code style={{background:'#1a1a2e',padding:'2px 6px',borderRadius:'3px',color:'#00ff88',fontSize:'10px'}}>cd bridge && npm start</code></p>
        </div>
      )}
    </div>
  );
}

function rel(ts,now){ const d=now-new Date(ts).getTime(); if(d<1000)return'now'; if(d<60000)return`${Math.floor(d/1000)}s`; if(d<3600000)return`${Math.floor(d/60000)}m`; if(d<86400000)return`${Math.floor(d/3600000)}h`; return`${Math.floor(d/86400000)}d`; }
function fmtTok(n){ if(n>=1e6)return`${(n/1e6).toFixed(1)}M`; if(n>=1e3)return`${(n/1e3).toFixed(0)}K`; return String(n); }

const css=`
*{margin:0;padding:0;box-sizing:border-box}
html,body,#root{height:100%}
body{background:#0a0a0f;color:#ccc;font-family:'JetBrains Mono','Courier New',monospace;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
`;

const s={
  root:{minHeight:'100vh',display:'flex',flexDirection:'column',padding:'12px',gap:'12px',maxWidth:'1200px',margin:'0 auto'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',background:'linear-gradient(135deg,#0d0d1a,#141428)',border:'1px solid #1a1a2e',borderRadius:'8px'},
  hLeft:{display:'flex',alignItems:'center',gap:'10px'},
  title:{fontSize:'13px',fontWeight:700,color:'#fff',letterSpacing:'3px'},
  sub:{fontSize:'10px',color:'#555',marginTop:'2px'},
  badge:{display:'flex',alignItems:'center',gap:'6px',padding:'5px 10px',background:'#111',borderRadius:'16px',border:'1px solid #222'},
  dot:{width:'7px',height:'7px',borderRadius:'50%'},
  badgeTxt:{fontSize:'9px',fontWeight:700,letterSpacing:'2px'},
  scene:{background:'#0e0e1a',border:'1px solid #1a1a2e',borderRadius:'8px',padding:'12px',overflow:'hidden'},
  locBar:{display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',marginTop:'8px',background:'#0a0a14',borderRadius:'6px',flexWrap:'wrap'},
  locDot:{width:'8px',height:'8px',borderRadius:'50%',flexShrink:0},
  locLabel:{fontSize:'10px',fontWeight:700,letterSpacing:'1.5px'},
  sep:{color:'#333',fontSize:'10px'},
  locZone:{fontSize:'11px',color:'#aaa'},
  locTool:{fontSize:'10px',color:'#ffaa00'},
  locProv:{fontSize:'9px',color:'#555',background:'#111',padding:'2px 6px',borderRadius:'3px',marginLeft:'auto'},
  panels:{display:'flex',gap:'12px',flexWrap:'wrap'},
  panel:{background:'linear-gradient(180deg,#0e0e1a,#0a0a14)',border:'1px solid #1a1a2e',borderRadius:'8px',padding:'14px'},
  ph:{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid #1a1a2e'},
  phi:{fontSize:'13px'},
  pht:{fontSize:'10px',fontWeight:600,color:'#888',letterSpacing:'2px',flex:1},
  feedScroll:{maxHeight:'250px',overflowY:'auto'},
  fi:{display:'flex',alignItems:'flex-start',gap:'6px',padding:'5px 0',borderBottom:'1px solid #111',fontSize:'10px'},
  fiIcon:{fontSize:'11px',flexShrink:0},
  fiAgent:{color:'#888',fontWeight:600,flexShrink:0,minWidth:'50px'},
  fiMsg:{color:'#aaa',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  fiTime:{color:'#333',flexShrink:0,fontSize:'9px'},
  bRow:{marginBottom:'14px'},
  bHead:{display:'flex',justifyContent:'space-between',marginBottom:'4px'},
  bName:{fontSize:'11px',fontWeight:600,color:'#ddd'},
  bCost:{fontSize:'10px',color:'#888'},
  barTrack:{height:'5px',background:'#111',borderRadius:'3px',overflow:'hidden',marginBottom:'3px'},
  barFill:{height:'100%',borderRadius:'3px',transition:'width 0.5s ease'},
  bFoot:{display:'flex',justifyContent:'space-between',fontSize:'8px',color:'#444'},
  gwRow:{display:'flex',alignItems:'center',gap:'8px',padding:'6px 8px',background:'#0c0c18',borderRadius:'4px'},
  stGrid:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'4px',marginBottom:'10px'},
  stCard:{background:'#0c0c18',borderRadius:'5px',padding:'6px',textAlign:'center'},
  stCount:{fontSize:'16px',fontWeight:700,color:'#fff'},
  stName:{fontSize:'7px',color:'#666',letterSpacing:'0.5px',marginTop:'1px'},
  tRow:{display:'flex',alignItems:'center',gap:'6px',padding:'4px 6px',borderLeft:'2px solid #00ff8840',marginBottom:'3px',fontSize:'10px'},
  tName:{color:'#aaa',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  tDur:{color:'#555',fontSize:'9px'},
  tErr:{color:'#ff4444',fontSize:'8px',fontWeight:700,letterSpacing:'1px'},
  empty:{color:'#333',fontSize:'11px',padding:'16px 0',textAlign:'center'},
};
