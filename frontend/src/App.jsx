// App.jsx — OpenClaw Mission Control v2
// Features: Agent identities, anti-overlap zones, customizable room
// Drop-in replacement for frontend/src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useBridge } from './hooks/useBridge';

const BRIDGE_WS = import.meta.env.VITE_BRIDGE_URL || 'ws://localhost:3001/ws';
const PX = 4;
const CW = 190, CH = 120;

// ===========================================================
// ★ CUSTOMIZATION — Edit this section to personalize! ★
// ===========================================================

// Agent visual identities — add/modify for each agent you run
// Each agent gets a unique look so you can tell them apart at a glance
const AGENT_IDENTITIES = {
  main: {
    displayName: 'Main Agent',
    shirt: '#7755bb', shirtDark: '#5544aa',   // Purple shirt
    hair: '#553322',                           // Brown hair
    skin: '#ffcc88',                           // Skin tone
    accessory: null,                           // 'glasses' | 'headphones' | 'hat' | null
    badge: null,                               // Emoji badge shown next to name, e.g. '⭐'
  },
  'signal-feed': {
    displayName: 'SignalFeed',
    shirt: '#cc5533', shirtDark: '#aa3322',   // Red/orange shirt
    hair: '#222222',                           // Black hair
    skin: '#e8b87a',
    accessory: 'headphones',
    badge: '📡',
  },
  'market-structure': {
    displayName: 'MarketStructure',
    shirt: '#3377cc', shirtDark: '#2255aa',   // Blue shirt
    hair: '#884411',                           // Auburn hair
    skin: '#ffcc88',
    accessory: 'glasses',
    badge: '📊',
  },
  'narrative-watch': {
    displayName: 'NarrativeWatch',
    shirt: '#33aa77', shirtDark: '#228855',   // Green shirt
    hair: '#111111',
    skin: '#c49560',
    accessory: null,
    badge: '📰',
  },
  'reg-macro': {
    displayName: 'RegMacro',
    shirt: '#aa7733', shirtDark: '#886622',   // Gold shirt
    hair: '#553322',
    skin: '#ffcc88',
    accessory: 'glasses',
    badge: '⚖️',
  },
  'tech-fundamentals': {
    displayName: 'TechFundamentals',
    shirt: '#8844aa', shirtDark: '#663388',   // Purple-pink shirt
    hair: '#222222',
    skin: '#e8b87a',
    accessory: 'hat',
    badge: '🔬',
  },
  'chief-analyst': {
    displayName: 'ChiefAnalyst',
    shirt: '#333333', shirtDark: '#1a1a1a',   // Black suit
    hair: '#444444',                           // Gray hair (senior)
    skin: '#ffcc88',
    accessory: 'glasses',
    badge: '👔',
  },
  scott: {
    displayName: 'Scott',
    shirt: '#cc3388', shirtDark: '#aa2266',   // Magenta shirt
    hair: '#111111',                           // Black hair
    skin: '#e8b87a',
    accessory: 'headphones',
    badge: '🔍',
  },
};

// Default identity for unknown agents
const DEFAULT_IDENTITY = {
  displayName: 'Agent',
  shirt: '#777777', shirtDark: '#555555',
  hair: '#553322', skin: '#ffcc88',
  accessory: null, badge: null,
};

// Auto-generate colors for agents not in the list above
const AUTO_COLORS = [
  { shirt: '#cc5533', shirtDark: '#aa3322', hair: '#222' },
  { shirt: '#3377cc', shirtDark: '#2255aa', hair: '#884411' },
  { shirt: '#33aa77', shirtDark: '#228855', hair: '#111' },
  { shirt: '#aa7733', shirtDark: '#886622', hair: '#553322' },
  { shirt: '#cc3388', shirtDark: '#aa2266', hair: '#333' },
  { shirt: '#5599cc', shirtDark: '#3377aa', hair: '#442211' },
];

function getIdentity(agentId, index) {
  if (AGENT_IDENTITIES[agentId]) return AGENT_IDENTITIES[agentId];
  const auto = AUTO_COLORS[index % AUTO_COLORS.length];
  return { ...DEFAULT_IDENTITY, ...auto, displayName: agentId };
}

// Room customization — wall styles, decorations, furniture toggles
const ROOM_CONFIG = {
  // Wall styles: 'brick', 'wood', 'plain'
  leftWall: 'brick',
  centerWall: 'wood',
  rightWall: 'plain',

  // Wall colors (only used if style is 'plain')
  leftWallColor: '#a0705a',
  centerWallColor: '#c4a882',
  rightWallColor: '#d4c4a0',

  // Floor: 'checker', 'wood'
  floorStyle: 'checker',
  floorColorA: '#e8d8c0',
  floorColorB: '#dccaae',

  // Rug under break area
  showRug: true,
  rugColor: '#8a5a4a',

  // Toggle decorations on/off
  showCat: true,
  showPlants: true,
  showPosters: true,
  showBookshelf: true,
  showCoffeeMachine: true,

  // Sign text on the right wall
  signText: 'OPENCLAW',

  // Window: show night sky
  showWindows: true,
  nightSky: true, // false = daytime (lighter blue)

  // Custom wall art — add {x, y, w, h, color} objects
  // These render as colored rectangles on the back wall
  extraFrames: [
    // Example: { x: 38, y: 6, w: 10, h: 8, color: '#ccaa88' },
  ],
};

// ===========================================================
// ZONE SYSTEM — positions with anti-overlap slots
// ===========================================================

// Each zone has a primary position + offset slots for multiple agents
const ZONES = {
  idle: {
    x: 88, y: 68, label: 'Break room', bubble: 'Taking a break...',
    slots: [
      { dx: 0, dy: 0 },    // On couch
      { dx: -14, dy: -18 }, // At armchair
      { dx: 12, dy: -10 },  // Standing by coffee table
      { dx: -20, dy: -4 },  // By coffee machine
      { dx: 16, dy: 4 },    // Behind couch
      { dx: -8, dy: -24 },  // By bookshelf
    ],
  },
  working: {
    x: 22, y: 56, label: 'Work desk', bubble: 'Thinking...',
    slots: [
      { dx: 0, dy: 0 },     // Main desk
      { dx: 14, dy: -6 },   // Side position
      { dx: -6, dy: 8 },    // Standing behind
      { dx: 20, dy: 4 },    // Further right
      { dx: 8, dy: -10 },   // Above
      { dx: -4, dy: 14 },   // Below
    ],
  },
  youtube: {
    x: 46, y: 56, label: 'Media desk', bubble: 'Scraping video...',
    slots: [
      { dx: 0, dy: 0 },
      { dx: -10, dy: 6 },
      { dx: 8, dy: -6 },
      { dx: -6, dy: -10 },
    ],
  },
  search: {
    x: 98, y: 50, label: 'Library', bubble: 'Researching...',
    slots: [
      { dx: 0, dy: 0 },
      { dx: 12, dy: 6 },
      { dx: -10, dy: 8 },
      { dx: 6, dy: -8 },
      { dx: -6, dy: 16 },
      { dx: 14, dy: -4 },
    ],
  },
  sheets: {
    x: 140, y: 62, label: 'Data desk', bubble: 'Writing data...',
    slots: [
      { dx: 0, dy: 0 },
      { dx: 12, dy: -6 },
      { dx: -8, dy: 8 },
      { dx: 16, dy: 6 },
    ],
  },
  telegram: {
    x: 155, y: 82, label: 'Comms desk', bubble: 'Sending report...',
    slots: [
      { dx: 0, dy: 0 },
      { dx: -12, dy: -6 },
      { dx: 10, dy: 4 },
      { dx: -6, dy: 8 },
    ],
  },
  error: {
    x: 158, y: 48, label: 'Server rack', bubble: 'Something broke!',
    slots: [
      { dx: 0, dy: 0 },
      { dx: -12, dy: 4 },
      { dx: 8, dy: 8 },
      { dx: -8, dy: -6 },
    ],
  },
};

const TOOL_ZONES = [
  { p: /youtube|yt_scraper|yt-scraper/i, z: 'youtube' },
  { p: /perplexity|web_search|sonar/i, z: 'search' },
  { p: /google_sheets|gsheet|spreadsheet/i, z: 'sheets' },
  { p: /telegram|tg_send|tg_post/i, z: 'telegram' },
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

// Assign slot positions to avoid overlap
function assignSlots(agents) {
  const zoneOccupants = {}; // zone → [agentId, ...]
  const agentZones = {};    // agentId → zone

  // First pass: figure out which zone each agent is in
  for (const [id, agent] of Object.entries(agents || {})) {
    const zone = resolveZone(agent);
    agentZones[id] = zone;
    if (!zoneOccupants[zone]) zoneOccupants[zone] = [];
    zoneOccupants[zone].push(id);
  }

  // Second pass: assign slot positions
  const positions = {};
  for (const [zone, occupants] of Object.entries(zoneOccupants)) {
    const z = ZONES[zone] || ZONES.idle;
    occupants.forEach((id, idx) => {
      const slot = z.slots[idx % z.slots.length];
      positions[id] = {
        x: z.x + slot.dx,
        y: z.y + slot.dy,
        zone,
      };
    });
  }
  return { positions, agentZones };
}

const STATUS_CFG = {
  working:  { label: 'WORKING',  color: '#00ff88' },
  tool_use: { label: 'TOOL USE', color: '#ffaa00' },
  idle:     { label: 'IDLE',     color: '#666' },
  error:    { label: 'ERROR',    color: '#ff4444' },
  offline:  { label: 'OFFLINE',  color: '#333' },
};

// ---- Pixel colors ----
const K = {
  brickLine:'#8a6050', brickHi:'#b8846e',
  woodLine:'#b0946e', woodHi:'#d4b892', wallRightHi:'#e0d0b0',
  trim:'#8a6a4a', trimHi:'#a0805a',
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
  poster:'#ddccaa', posterArt:'#aa5533',
  winBg:'#1a2844', winBgDay:'#6699cc', star:'#aaccff', winFrame:'#8a7a5a',
  signBg:'#2a5a3a', signTxt:'#ddcc66', signBdr:'#4a7a5a',
};

// ===========================================================
// CANVAS — draws the office and agents
// ===========================================================
function OfficeCanvas({ agents }) {
  const ref = useRef(null);
  const posRef = useRef({});
  const tgtRef = useRef({});
  const bubRef = useRef({});
  const agentOrder = useRef([]);

  // Update targets when agent state changes
  useEffect(() => {
    if (!agents) return;
    const { positions, agentZones } = assignSlots(agents);

    // Track agent order for consistent identity assignment
    const ids = Object.keys(agents);
    for (const id of ids) {
      if (!agentOrder.current.includes(id)) agentOrder.current.push(id);
    }

    for (const [id, agent] of Object.entries(agents)) {
      const p = positions[id];
      if (!p) continue;
      if (!posRef.current[id]) posRef.current[id] = { x: p.x, y: p.y };
      tgtRef.current[id] = { x: p.x, y: p.y };

      const zone = agentZones[id];
      const newText = agent.currentTool?.name || (ZONES[zone]?.bubble || 'Idle...');
      if (bubRef.current[id]?.text !== newText) {
        bubRef.current[id] = { text: newText, show: false };
        setTimeout(() => { if (bubRef.current[id]) bubRef.current[id].show = true; }, 1200);
      }
    }
  }, [agents]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let anim;
    const RC = ROOM_CONFIG;

    const r = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
    const px = (x,y,c) => r(x,y,1,1,c);

    // ---- Room drawing functions ----
    function walls() {
      // Left wall
      for(let y=0;y<42;y++) for(let x=0;x<65;x++){
        if(RC.leftWall==='brick'){
          let c=RC.leftWallColor||'#a0705a';
          if(y%5===0)c=K.brickLine; else if(y%5===1&&x%8===0)c=K.brickLine;
          else if(y%5===3&&(x+4)%8===0)c=K.brickLine; else if((x+y)%7===0)c=K.brickHi;
          r(x,y,1,1,c);
        } else if(RC.leftWall==='wood'){
          let c=RC.leftWallColor||'#c4a882';
          if(x%12===0)c=K.woodLine; else if((x+y*3)%17===0)c=K.woodHi;
          r(x,y,1,1,c);
        } else {
          r(x,y,1,1,RC.leftWallColor||'#a0705a');
        }
      }
      // Center wall
      for(let y=0;y<42;y++) for(let x=65;x<130;x++){
        if(RC.centerWall==='wood'){
          let c=RC.centerWallColor||'#c4a882';
          if(x%12===0)c=K.woodLine; else if((x+y*3)%17===0)c=K.woodHi;
          r(x,y,1,1,c);
        } else if(RC.centerWall==='brick'){
          let c=RC.centerWallColor||'#a0705a';
          if(y%5===0)c=K.brickLine; else if(y%5===1&&x%8===0)c=K.brickLine;
          else if(y%5===3&&(x+4)%8===0)c=K.brickLine; else if((x+y)%7===0)c=K.brickHi;
          r(x,y,1,1,c);
        } else {
          r(x,y,1,1,RC.centerWallColor||'#c4a882');
        }
      }
      // Right wall
      for(let y=0;y<42;y++) for(let x=130;x<CW;x++){
        if(RC.rightWall==='plain'){
          let c=RC.rightWallColor||'#d4c4a0';
          if((x+y)%11===0)c=K.wallRightHi;
          r(x,y,1,1,c);
        } else if(RC.rightWall==='brick'){
          let c=RC.rightWallColor||'#a0705a';
          if(y%5===0)c=K.brickLine; else if(y%5===1&&x%8===0)c=K.brickLine;
          else if(y%5===3&&(x+4)%8===0)c=K.brickLine; else if((x+y)%7===0)c=K.brickHi;
          r(x,y,1,1,c);
        } else {
          let c=RC.rightWallColor||'#c4a882';
          if(x%12===0)c=K.woodLine; else if((x+y*3)%17===0)c=K.woodHi;
          r(x,y,1,1,c);
        }
      }
      r(0,42,CW,2,K.trim); r(0,41,CW,1,K.trimHi);
    }

    function floor() {
      for(let y=44;y<CH;y++) for(let x=0;x<CW;x++){
        if(RC.floorStyle==='checker') r(x,y,1,1,((x+y)%2===0)?RC.floorColorA:RC.floorColorB);
        else {
          let c=RC.floorColorA; if(x%8===0)c=RC.floorColorB;
          r(x,y,1,1,c);
        }
      }
      if(RC.showRug){
        for(let y=62;y<80;y++) for(let x=70;x<115;x++){
          let c=RC.rugColor;
          if(x===70||x===114||y===62||y===79||(x+y)%4===0) c=lighten(RC.rugColor,20);
          r(x,y,1,1,c);
        }
      }
    }

    function win(x,y,w,h){
      if(!RC.showWindows)return;
      r(x-1,y-1,w+2,h+2,K.winFrame);
      r(x,y,w,h,RC.nightSky?K.winBg:K.winBgDay);
      r(x+w/2,y,1,h,'#7a6a4a'); r(x,y+h/2,w,1,'#7a6a4a');
      if(RC.nightSky) [[3,3],[w-4,5],[5,h-4],[w-6,2]].forEach(([sx,sy])=>px(x+sx,y+sy,K.star));
    }

    function desk(x,y){ r(x,y,30,2,K.deskTop); r(x,y+2,30,8,K.deskFront); r(x+1,y+10,2,5,K.deskLeg); r(x+27,y+10,2,5,K.deskLeg); r(x+2,y+4,12,1,'#6a5038'); r(x+2,y+7,12,1,'#6a5038'); px(x+8,y+3,K.trimHi); px(x+8,y+6,K.trimHi); }
    function mon(x,y,sc){ r(x,y,10,8,K.mon); r(x+1,y+1,8,6,sc); r(x+4,y+8,2,2,K.mon); r(x+2,y+10,6,1,'#555'); }
    function chair(x,y){ r(x,y,10,3,K.chrBack); r(x+1,y+3,8,5,K.chrSeat); r(x+1,y+8,2,3,K.chrLeg); r(x+7,y+8,2,3,K.chrLeg); }
    function couch(x,y){ r(x,y,30,4,K.couch); r(x,y+4,30,8,K.couchDk); r(x-2,y+2,4,10,K.couch); r(x+28,y+2,4,10,K.couch); r(x+4,y+5,8,4,K.couchPil); r(x+18,y+5,8,4,K.couchPil); }
    function coffeeMach(x,y){ if(!RC.showCoffeeMachine)return; r(x,y,8,12,K.coffee); r(x,y,8,2,K.coffeeDk); r(x+2,y+3,4,4,K.coffeeDk); px(x+6,y+4,K.coffeeRed); px(x+6,y+6,K.srvG); r(x+2,y+9,3,2,'#ddd'); r(x+5,y+10,1,1,'#ddd'); }
    function bookshelf(x,y){ if(!RC.showBookshelf)return; r(x,y,14,30,K.shelf); for(let row=0;row<4;row++){ let sy=y+2+row*7; r(x+1,sy+5,12,1,K.shelf); let bx=x+1; for(let b=0;b<4;b++){ let bh=4+Math.floor(Math.sin(row*3+b*7)*1.5); r(bx,sy+5-bh,3,bh,K.books[(row*4+b)%6]); bx+=3; } } }
    function plant(x,y){ if(!RC.showPlants)return; r(x+1,y+5,4,4,K.pot); r(x+2,y+8,2,1,K.potDk); for(let i=0;i<5;i++) r(x+3+Math.sin(i*1.8)*3,y+Math.cos(i*1.3)*3,2,3,i%2?K.plant:K.plantDk); }
    function lamp(x,y){ r(x+2,y,6,4,K.lampShade); r(x+4,y+4,2,8,K.lampPole); r(x+2,y+12,6,1,K.lampPole); px(x+4,y+3,K.lamp); px(x+5,y+3,K.lamp); }
    function cat(x,y){ if(!RC.showCat)return; r(x,y+2,10,4,K.cat); r(x+1,y+3,8,2,K.catDk); r(x+8,y,4,4,K.cat); px(x+8,y-1,K.catEar); px(x+11,y-1,K.catEar); r(x+9,y+1,1,1,'#222'); r(x+11,y+1,1,1,'#222'); r(x-2,y+3,3,1,K.cat); px(x-3,y+2,K.cat); r(x-4,y+5,16,3,K.catBed); r(x-3,y+4,14,1,K.catBedIn); }
    function serverRack(x,y){ r(x,y,10,24,K.srv); r(x,y,10,1,'#555'); const lc=[K.srvG,K.srvG,K.srvY,K.srvY,K.srvR]; for(let i=0;i<5;i++){ r(x+1,y+2+i*4,8,3,K.srvSlot); if(Math.sin(Date.now()/(400+i*200)+i)>0) px(x+8,y+3+i*4,lc[i]); } }
    function drawFrame(x,y,w,h,c){ r(x,y,w,h,K.frame); r(x+1,y+1,w-2,h-2,c||K.photo); }
    function sign(x,y,text){ r(x,y,30,10,K.signBg); r(x,y,30,1,K.signBdr); r(x,y+9,30,1,K.signBdr); ctx.fillStyle=K.signTxt; ctx.font='5px monospace'; ctx.fillText(text,x+2,y+7); }
    function poster(x,y){ if(!RC.showPosters)return; r(x,y,12,16,K.frame); r(x+1,y+1,10,14,K.poster); r(x+3,y+3,6,6,K.posterArt); r(x+2,y+11,8,2,'#6a5a3a'); }

    // ---- Agent drawing with identity ----
    function drawAgent(x, y, id, identity, bubbleInfo) {
      let ax = Math.round(x), ay = Math.round(y);
      const I = identity;

      // Shadow
      r(ax+1,ay+13,8,2,'#00000020');

      // Movement detection
      let moving = false;
      const p2 = posRef.current[id], t2 = tgtRef.current[id];
      if(p2&&t2){ moving = Math.sqrt((t2.x-p2.x)**2+(t2.y-p2.y)**2) > 1; }
      let lo = moving ? Math.sin(Date.now()/150) : 0;

      // Legs
      r(ax+2,ay+11+lo,2,3,'#444'); r(ax+6,ay+11-lo,2,3,'#444');
      r(ax+2,ay+13,2,1,'#333'); r(ax+6,ay+13,2,1,'#333');

      // Body
      r(ax+1,ay+5,8,7,I.shirt);
      r(ax+2,ay+6,6,5,I.shirtDark);

      // Arms with movement
      let ab = moving ? Math.sin(Date.now()/200) : 0;
      r(ax-1,ay+5+ab,2,5,I.shirt);
      r(ax+9,ay+5-ab,2,5,I.shirt);

      // Head
      r(ax+1,ay,8,6,I.skin);

      // Hair
      r(ax+1,ay-1,8,1,I.hair);
      r(ax,ay,1,3,I.hair);
      r(ax+9,ay,1,3,I.hair);

      // Eyes
      px(ax+3,ay+2,'#333');
      px(ax+6,ay+2,'#333');

      // Mouth
      px(ax+4,ay+4,'#cc8866');
      px(ax+5,ay+4,'#cc8866');

      // Accessories
      if (I.accessory === 'glasses') {
        px(ax+2,ay+2,'#4466aa'); px(ax+3,ay+2,'#4466aa');
        px(ax+5,ay+2,'#4466aa'); px(ax+6,ay+2,'#4466aa'); // changed eye to look like glasses frames
        px(ax+7,ay+2,'#4466aa');
        px(ax+4,ay+2,'#667799'); // bridge
      }
      if (I.accessory === 'headphones') {
        px(ax,ay-1,'#555'); px(ax+9,ay-1,'#555'); // over ears
        px(ax,ay,  '#555'); px(ax+9,ay,  '#555');
        px(ax,ay+1,'#444'); px(ax+9,ay+1,'#444');
        r(ax+1,ay-2,8,1,'#555'); // headband
      }
      if (I.accessory === 'hat') {
        r(ax-1,ay-3,12,2,'#665544'); // brim
        r(ax+1,ay-5,8,3,'#554433'); // crown
      }

      // Name tag
      const name = I.displayName;
      const badgeStr = I.badge ? I.badge + ' ' : '';
      const tagText = badgeStr + (name.length > 12 ? name.substring(0,10)+'..' : name);
      const tw = tagText.length * 3 + 4;
      const tx = ax + 5 - tw/2;
      r(Math.max(1,tx), ay-14, tw, 7, '#000000aa');
      ctx.fillStyle = I.shirt;
      ctx.font = '4px monospace';
      ctx.fillText(tagText, Math.max(3,tx+2), ay-9);

      // Bubble
      if (bubbleInfo?.show && bubbleInfo?.text) {
        let bt = bubbleInfo.text.length > 18 ? bubbleInfo.text.substring(0,16)+'..' : bubbleInfo.text;
        let bw = bt.length*3+6, bx = ax+5-bw/2, by = ay-22;
        if(bx<2)bx=2; if(bx+bw>CW-2)bx=CW-2-bw;
        r(bx,by,bw,7,'#fff'); r(bx+Math.floor(bw/2),by+7,2,2,'#fff');
        ctx.fillStyle='#333'; ctx.font='4px monospace'; ctx.fillText(bt,bx+3,by+5);
      }
    }

    // ---- Main draw loop ----
    function draw() {
      ctx.clearRect(0,0,cv.width,cv.height);
      ctx.save(); ctx.scale(PX,PX);

      walls(); floor();
      r(64,0,1,CH,'#7a6050'); r(65,0,1,CH,'#8a7060');
      r(129,0,1,CH,'#8a7a5a'); r(130,0,1,CH,'#9a8a6a');

      win(15,8,16,14); win(82,8,16,14); win(148,8,16,14);
      drawFrame(38,6,10,8); drawFrame(50,8,8,7,'#88aa88');
      poster(110,4); sign(135,27,RC.signText);

      // Extra custom frames
      for (const f of RC.extraFrames) drawFrame(f.x, f.y, f.w, f.h, f.color);

      // Ceiling lights
      [[32],[92],[152]].forEach(([lx])=>r(lx,0,10,1,'#4a4255'));

      // Left room
      desk(10,48); mon(13,42,K.scrGreen); mon(24,41,K.scrBlue);
      chair(16,60); lamp(2,30); cat(42,72); plant(52,38);
      r(42,50,15,2,K.deskTop); r(42,52,15,5,K.deskFront);
      r(44,44,10,6,K.mon); r(45,45,8,4,'#331a22');
      ctx.fillStyle='#cc3355';
      ctx.beginPath(); ctx.moveTo(48,46); ctx.lineTo(51,47.5); ctx.lineTo(48,49); ctx.fill();

      // Center room
      couch(75,66); coffeeMach(68,48);
      r(80,58,20,3,K.deskTop); r(82,61,2,3,K.deskLeg); r(96,61,2,3,K.deskLeg);
      r(84,56,3,2,'#ddd'); r(90,57,3,2,'#eeddcc');
      bookshelf(110,12);
      r(96,44,12,4,K.chrBack); r(97,48,10,6,K.chrSeat);
      r(95,46,2,8,'#b8a888'); r(107,46,2,8,'#b8a888');
      plant(68,34); lamp(122,32); plant(124,76);

      // Right room
      r(135,56,22,2,K.deskTop); r(135,58,22,6,K.deskFront);
      r(136,64,2,4,K.deskLeg); r(155,64,2,4,K.deskLeg);
      mon(138,50,K.scrGreen); mon(148,49,K.scrGreen); chair(140,68);
      r(150,78,18,2,K.deskTop); r(150,80,18,5,K.deskFront);
      mon(153,72,K.scrBlue); r(163,73,5,4,'#33aadd'); px(164,74,'#fff');
      serverRack(155,22); serverRack(167,22);
      r(175,50,10,18,'#888');
      r(176,52,8,4,'#777'); r(176,57,8,4,'#777'); r(176,62,8,4,'#777');
      px(180,54,'#aa8855'); px(180,59,'#aa8855'); px(180,64,'#aa8855');
      plant(178,36);

      // Zone labels
      ctx.font='4px monospace'; ctx.fillStyle='#ffffff20';
      ctx.fillText('work',18,76); ctx.fillText('media',42,64);
      ctx.fillText('break',83,84); ctx.fillText('library',96,62);
      ctx.fillText('data',140,76); ctx.fillText('comms',152,92);

      // Draw all agents (sorted by Y for depth)
      const agentEntries = Object.keys(posRef.current)
        .filter(id => id !== '_def')
        .map(id => ({ id, pos: posRef.current[id], tgt: tgtRef.current[id] }))
        .sort((a, b) => (a.pos?.y || 0) - (b.pos?.y || 0));

      for (const { id, pos: p2, tgt: t2 } of agentEntries) {
        if (p2 && t2) {
          const dx = t2.x - p2.x, dy = t2.y - p2.y;
          if (Math.sqrt(dx*dx+dy*dy) > 0.5) { p2.x += dx*0.04; p2.y += dy*0.04; }
          const idx = agentOrder.current.indexOf(id);
          const identity = getIdentity(id, idx >= 0 ? idx : 0);
          drawAgent(p2.x, p2.y + Math.sin(Date.now()/300 + idx*1.5)*0.8, id, identity, bubRef.current[id]);
        }
      }

      // Default agent when no data
      if (agentEntries.length === 0) {
        if (!bubRef.current._def) bubRef.current._def = { text: 'Waiting for data...', show: true };
        drawAgent(88, 68+Math.sin(Date.now()/300)*0.8, '_def', AGENT_IDENTITIES.main || DEFAULT_IDENTITY, bubRef.current._def);
      }

      ctx.restore();
      anim = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(anim);
  }, []);

  return <canvas ref={ref} width={CW*PX} height={CH*PX}
    style={{width:'100%',maxWidth:'760px',display:'block',margin:'0 auto',borderRadius:'8px',imageRendering:'pixelated'}} />;
}

function lighten(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.min(255, r+amt); g = Math.min(255, g+amt); b = Math.min(255, b+amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ===========================================================
// MAIN APP
// ===========================================================
export default function App() {
  const { state, connected, reconnecting } = useBridge(BRIDGE_WS);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Build agent summary for location bar
  const agentList = state ? Object.values(state.agents) : [];
  const agentSummary = agentList.map(a => {
    const zone = resolveZone(a);
    const zi = ZONES[zone] || ZONES.idle;
    const sc = STATUS_CFG[a.status] || STATUS_CFG.offline;
    const identity = getIdentity(a.id, Object.keys(state.agents).indexOf(a.id));
    return { ...a, zone, zi, sc, identity };
  });

  return (
    <div style={st.root}>
      <style>{css}</style>

      <header style={st.header}>
        <div style={st.hLeft}>
          <span style={{fontSize:'24px'}}>&#9876;&#65039;</span>
          <div>
            <h1 style={st.title}>OPENCLAW MISSION CONTROL</h1>
            <p style={st.sub}>{state?.gateway?.version||'Connecting...'}</p>
          </div>
        </div>
        <div style={st.badge}>
          <div style={{...st.dot,backgroundColor:connected?'#00ff88':reconnecting?'#ffaa00':'#ff4444',boxShadow:connected?'0 0 8px #00ff88':'none'}}/>
          <span style={{...st.badgeTxt,color:connected?'#00ff88':reconnecting?'#ffaa00':'#ff4444'}}>
            {connected?'LIVE':reconnecting?'RECONNECTING':'DISCONNECTED'}
          </span>
        </div>
      </header>

      <div style={st.scene}>
        <OfficeCanvas agents={state?.agents} />

        {/* Agent location indicators */}
        <div style={st.locBar}>
          {agentSummary.length === 0 ? (
            <span style={{fontSize:'10px',color:'#555'}}>No agents connected</span>
          ) : (
            agentSummary.map(a => (
              <div key={a.id} style={st.locChip}>
                <div style={{...st.locChipDot,backgroundColor:a.sc.color}} />
                <span style={{...st.locChipName,color:a.identity.shirt}}>{a.identity.displayName}</span>
                <span style={st.locChipZone}>{a.zi.label}</span>
                {a.currentTool && <span style={st.locChipTool}>{a.currentTool.name}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {state ? (
        <div style={st.panels}>
          {/* Activity Feed */}
          <div style={{...st.panel,flex:2,minWidth:'260px'}}>
            <div style={st.ph}><span style={st.phi}>&#128225;</span><span style={st.pht}>ACTIVITY FEED</span></div>
            <div style={st.feedScroll}>
              {(!state.activityLog||state.activityLog.length===0)?<div style={st.empty}>Waiting for events...</div>:
              state.activityLog.slice(0,30).map((e,i)=>(
                <div key={i} style={{...st.fi,opacity:Math.max(0.3,1-i*0.02)}}>
                  <span style={st.fiIcon}>{{session:'🚀',prompt:'💬',tool:'🔧',error:'❌'}[e.type]||'•'}</span>
                  <span style={st.fiAgent}>{e.agentName}</span>
                  <span style={st.fiMsg}>{e.message}</span>
                  <span style={st.fiTime}>{rel(e.timestamp,now)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget + Gateway */}
          <div style={{...st.panel,flex:1,minWidth:'210px'}}>
            <div style={st.ph}><span style={st.phi}>&#128176;</span><span style={st.pht}>API BUDGET</span></div>
            {Object.values(state.budget).length===0?<div style={st.empty}>No usage yet</div>:
            Object.values(state.budget).map(p=>{
              const pct=p.limits?.monthlyTokens?Math.min(100,(p.tokensUsed/p.limits.monthlyTokens)*100):0;
              const bc=pct>85?'#ff4444':pct>60?'#ffaa00':'#00ff88';
              return(
                <div key={p.provider} style={st.bRow}>
                  <div style={st.bHead}><span style={st.bName}>{p.provider}</span><span style={st.bCost}>${p.costUsd.toFixed(2)}{p.limits?.monthlyUsd?` / $${p.limits.monthlyUsd}`:''}</span></div>
                  <div style={st.barTrack}><div style={{...st.barFill,width:`${pct}%`,backgroundColor:bc,boxShadow:`0 0 6px ${bc}40`}}/></div>
                  <div style={st.bFoot}><span>{fmtTok(p.tokensUsed)} tok</span><span>{p.callCount} calls</span><span>{pct.toFixed(0)}%</span></div>
                </div>
              );
            })}
            <div style={{...st.ph,marginTop:'14px'}}><span style={st.phi}>&#127959;&#65039;</span><span style={st.pht}>GATEWAY</span></div>
            <div style={st.gwRow}>
              <div style={{width:8,height:8,borderRadius:'50%',background:state.gateway.status==='running'?'#00ff88':'#ff4444'}}/>
              <span style={{color:state.gateway.status==='running'?'#00ff88':'#ff4444',fontSize:'11px',fontWeight:600}}>{state.gateway.status?.toUpperCase()||'UNKNOWN'}</span>
              {state.gateway.telegram?.connected&&<span style={{fontSize:'9px',color:'#33aadd'}}>{state.gateway.telegram.bot}</span>}
              <span style={{fontSize:'9px',color:'#444',marginLeft:'auto'}}>{state.gateway.version||''}</span>
            </div>
          </div>

          {/* Tools */}
          <div style={{...st.panel,flex:1,minWidth:'190px'}}>
            <div style={st.ph}><span style={st.phi}>&#128736;&#65039;</span><span style={st.pht}>TOOLS</span></div>
            {Object.entries(state.tools.stationCounts||{}).length>0&&(
              <div style={st.stGrid}>
                {Object.entries(state.tools.stationCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([n,c])=>(
                  <div key={n} style={st.stCard}><div style={st.stCount}>{c}</div><div style={st.stName}>{n}</div></div>
                ))}
              </div>
            )}
            <div style={{fontSize:'9px',color:'#555',letterSpacing:'1px',marginBottom:'6px'}}>Recent</div>
            {(state.tools.recent||[]).slice(0,6).map((t,i)=>(
              <div key={i} style={{...st.tRow,borderLeftColor:t.isError?'#ff4444':'#00ff8840'}}>
                <span style={{fontSize:'10px'}}>{t.station?.icon||'🔧'}</span>
                <span style={st.tName}>{t.name}</span>
                {t.duration&&<span style={st.tDur}>{(t.duration/1000).toFixed(1)}s</span>}
                {t.isError&&<span style={st.tErr}>ERR</span>}
              </div>
            ))}
            {(state.tools.recent||[]).length===0&&<div style={st.empty}>No calls yet</div>}
          </div>
        </div>
      ):(
        <div style={{textAlign:'center',padding:'20px'}}>
          <p style={{fontSize:'13px',color:'#888'}}>{reconnecting?'Reconnecting...':'Connecting to bridge...'}</p>
          <p style={{fontSize:'10px',color:'#444',marginTop:'8px'}}>Run: <code style={{background:'#1a1a2e',padding:'2px 6px',borderRadius:'3px',color:'#00ff88',fontSize:'10px'}}>cd bridge && npm start</code></p>
        </div>
      )}
    </div>
  );
}

function rel(ts,n){ const d=n-new Date(ts).getTime(); if(d<1000)return'now'; if(d<6e4)return`${Math.floor(d/1000)}s`; if(d<36e5)return`${Math.floor(d/6e4)}m`; if(d<864e5)return`${Math.floor(d/36e5)}h`; return`${Math.floor(d/864e5)}d`; }
function fmtTok(n){ if(n>=1e6)return`${(n/1e6).toFixed(1)}M`; if(n>=1e3)return`${(n/1e3).toFixed(0)}K`; return''+n; }

const css=`*{margin:0;padding:0;box-sizing:border-box}html,body,#root{height:100%}body{background:#0a0a0f;color:#ccc;font-family:'JetBrains Mono','Courier New',monospace;-webkit-font-smoothing:antialiased}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#333;border-radius:2px}`;

const st={
  root:{minHeight:'100vh',display:'flex',flexDirection:'column',padding:'12px',gap:'12px',maxWidth:'1200px',margin:'0 auto'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',background:'linear-gradient(135deg,#0d0d1a,#141428)',border:'1px solid #1a1a2e',borderRadius:'8px'},
  hLeft:{display:'flex',alignItems:'center',gap:'10px'},
  title:{fontSize:'13px',fontWeight:700,color:'#fff',letterSpacing:'3px'},
  sub:{fontSize:'10px',color:'#555',marginTop:'2px'},
  badge:{display:'flex',alignItems:'center',gap:'6px',padding:'5px 10px',background:'#111',borderRadius:'16px',border:'1px solid #222'},
  dot:{width:'7px',height:'7px',borderRadius:'50%'},
  badgeTxt:{fontSize:'9px',fontWeight:700,letterSpacing:'2px'},
  scene:{background:'#0e0e1a',border:'1px solid #1a1a2e',borderRadius:'8px',padding:'12px',overflow:'hidden'},
  locBar:{display:'flex',alignItems:'center',gap:'6px',padding:'8px 10px',marginTop:'8px',background:'#0a0a14',borderRadius:'6px',flexWrap:'wrap'},
  locChip:{display:'flex',alignItems:'center',gap:'5px',padding:'3px 8px',background:'#111',borderRadius:'10px',border:'1px solid #1a1a2e'},
  locChipDot:{width:'6px',height:'6px',borderRadius:'50%',flexShrink:0},
  locChipName:{fontSize:'9px',fontWeight:700},
  locChipZone:{fontSize:'9px',color:'#888'},
  locChipTool:{fontSize:'8px',color:'#ffaa00'},
  panels:{display:'flex',gap:'12px',flexWrap:'wrap'},
  panel:{background:'linear-gradient(180deg,#0e0e1a,#0a0a14)',border:'1px solid #1a1a2e',borderRadius:'8px',padding:'14px'},
  ph:{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px',paddingBottom:'8px',borderBottom:'1px solid #1a1a2e'},
  phi:{fontSize:'13px'},pht:{fontSize:'10px',fontWeight:600,color:'#888',letterSpacing:'2px',flex:1},
  feedScroll:{maxHeight:'250px',overflowY:'auto'},
  fi:{display:'flex',alignItems:'flex-start',gap:'6px',padding:'5px 0',borderBottom:'1px solid #111',fontSize:'10px'},
  fiIcon:{fontSize:'11px',flexShrink:0},fiAgent:{color:'#888',fontWeight:600,flexShrink:0,minWidth:'50px'},
  fiMsg:{color:'#aaa',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  fiTime:{color:'#333',flexShrink:0,fontSize:'9px'},
  bRow:{marginBottom:'14px'},bHead:{display:'flex',justifyContent:'space-between',marginBottom:'4px'},
  bName:{fontSize:'11px',fontWeight:600,color:'#ddd'},bCost:{fontSize:'10px',color:'#888'},
  barTrack:{height:'5px',background:'#111',borderRadius:'3px',overflow:'hidden',marginBottom:'3px'},
  barFill:{height:'100%',borderRadius:'3px',transition:'width 0.5s ease'},
  bFoot:{display:'flex',justifyContent:'space-between',fontSize:'8px',color:'#444'},
  gwRow:{display:'flex',alignItems:'center',gap:'8px',padding:'6px 8px',background:'#0c0c18',borderRadius:'4px'},
  stGrid:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'4px',marginBottom:'10px'},
  stCard:{background:'#0c0c18',borderRadius:'5px',padding:'6px',textAlign:'center'},
  stCount:{fontSize:'16px',fontWeight:700,color:'#fff'},stName:{fontSize:'7px',color:'#666',letterSpacing:'0.5px',marginTop:'1px'},
  tRow:{display:'flex',alignItems:'center',gap:'6px',padding:'4px 6px',borderLeft:'2px solid #00ff8840',marginBottom:'3px',fontSize:'10px'},
  tName:{color:'#aaa',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  tDur:{color:'#555',fontSize:'9px'},tErr:{color:'#ff4444',fontSize:'8px',fontWeight:700,letterSpacing:'1px'},
  empty:{color:'#333',fontSize:'11px',padding:'16px 0',textAlign:'center'},
};
