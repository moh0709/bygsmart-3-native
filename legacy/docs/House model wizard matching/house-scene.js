/* <house-stage> — programmatic cutaway house for the Byggeapp project wizard.
 * Registers a custom element that owns a three.js scene, procedural PBR
 * textures, zone-based selection and its own orbit controls.
 *
 * Public surface (mirrors HouseModel3D.tsx in the app):
 *   window.__houseStage                      instance, also 'housestage:ready'
 *   stage.setSelected(idArray)               controlled selection state
 *   stage.setHover(zoneId | null)            external (drawer) hover
 *   stage.flashMarker(zoneId)                "valgt" marker from the drawer
 *   stage.resetView() / setAutoRotate(bool) / setLighting('nat'|'dag')
 *   stage.setViewMode('orbit'|'pan'|'grid')
 * Events on window:
 *   housestage:hover   {zoneId, x, y}
 *   housestage:toggle  {zoneId, x, y}
 */
(function () {
  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';

  const ZONES = {
    tag_og_skorsten: { name: 'Tag & Skorsten', desc: 'Tagbelægning, tagkonstruktion', color: '#f97316' },
    loft_tagetage: { name: 'Loft & Tagetage', desc: 'Spær, undertag, isolering', color: '#fb923c' },
    solceller_energi: { name: 'Solceller & Energi', desc: 'Solceller, inverter, kabling', color: '#facc15' },
    facade_overetage: { name: 'Facade 1. Sal', desc: 'Beklædning, isolering, puds, maleri', color: '#38bdf8' },
    facade_stueetage: { name: 'Facade Stueetage', desc: 'Murværk, isolering, facade', color: '#22d3ee' },
    vinduer_overetage: { name: 'Vinduer 1. Sal', desc: 'Vinduer, karme, lysninger', color: '#a78bfa' },
    vinduer_doere_stueetage: { name: 'Vinduer & Døre Stue', desc: 'Vinduer, døre, porte', color: '#c084fc' },
    altan_balkon: { name: 'Altan & Balkon', desc: 'Dæk, værn, membran', color: '#34d399' },
    garage_carport: { name: 'Garage & Carport', desc: 'Port, gulv, tag', color: '#4ade80' },
    terrasse_udendoers: { name: 'Terrasse & Udendørs', desc: 'Trædæk, trapper, værn', color: '#2dd4bf' },
    indkoersel_belaegning: { name: 'Indkørsel & Belægning', desc: 'Fliser, asfalt, grus', color: '#94a3b8' },
    fundament_sokkel: { name: 'Fundament & Sokkel', desc: 'Gravearbejde, fundament', color: '#f472b6' },
    kaelder_udvendig: { name: 'Kælder Udvendig', desc: 'Kælderydervægge, gulv', color: '#60a5fa' },
    kloak_forsyning: { name: 'Kloak & Forsyning', desc: 'El, VVS, ventilation, afløb', color: '#f87171' },
    ladestander_elbil: { name: 'Ladestander & Elbil', desc: 'Ladeboks, kabling, gruppe', color: '#22c55e' },
    skorsten_aftraek: { name: 'Skorsten & Aftræk', desc: 'Skorsten, inddækning, hat', color: '#fdba74' },
    tagrender_nedloeb: { name: 'Tagrender & Nedløb', desc: 'Render, nedløb, brønde', color: '#fcd34d' },
    ovenlys_tagvinduer: { name: 'Ovenlys & Tagvinduer', desc: 'Tagvinduer, inddækning', color: '#818cf8' },
    pergola_solafskaermning: { name: 'Pergola & Solafskærmning', desc: 'Pergola, markise, screens', color: '#2dd4bf' },
    hegn_laage: { name: 'Hegn & Låge', desc: 'Stolper, rækværk, låge', color: '#a3e635' },
    beplantning: { name: 'Beplantning', desc: 'Træer, buske, bede', color: '#4d7c0f' },
    udebelysning: { name: 'Udebelysning', desc: 'Havelamper, facadelamper', color: '#fde68a' },
    koekken: { name: 'Køkken', desc: 'Skabe, bordplade, hvidevarer', color: '#fb923c' },
    badevaerelse: { name: 'Badeværelse', desc: 'Fliser, sanitet, bruseniche', color: '#38bdf8' },
    trapper_indvendig: { name: 'Trapper Indvendig', desc: 'Trappeløb, trin, gelænder', color: '#d8b4fe' },
    ventilation_anlaeg: { name: 'Ventilationsanlæg', desc: 'Aggregat, kanaler, hætter', color: '#67e8f9' },
    varme_vvs: { name: 'Varme & VVS', desc: 'Varmtvandsbeholder, rør', color: '#fca5a5' },
    varmepumpe_udedel: { name: 'Varmepumpe', desc: 'Udedel, sokkel, rørføring', color: '#f43f5e' },
    graesplaene: { name: 'Græsplæne', desc: 'Såning, muld, klipning', color: '#65a30d' },
    haek_levende: { name: 'Hæk & Levende Hegn', desc: 'Hæk, klipning, rødder', color: '#3f6212' },
    stier_traedesten: { name: 'Stier & Trædesten', desc: 'Trædesten, grus, kantsten', color: '#a8a29e' },
    indvendige_vaegge: { name: 'Indvendige Vægge', desc: 'Skillevægge, foring, puds', color: '#e879f9' },
    etagedaek_gulve: { name: 'Etagedæk & Gulve', desc: 'Bjælkelag, dæk, gulvopbygning', color: '#c084fc' },
    skabe_garderobe: { name: 'Skabe & Garderobe', desc: 'Garderobe, reoler, opbevaring', color: '#f0abfc' },
    hvidevarer: { name: 'Hvidevarer', desc: 'Køl, ovn, kogeplade, emhætte', color: '#94a3b8' },
    indvendig_belysning: { name: 'Indvendig Belysning', desc: 'Pendler, spots, lamper', color: '#fef08a' },
    skure_udhus: { name: 'Skur & Udhus', desc: 'Redskabsskur, tag, dør', color: '#0d9488' },
    regnvand_faskine: { name: 'Regnvand & Faskine', desc: 'Regnvandstønde, faskine, dræn', color: '#22d3ee' },
    baerende_bjaelker: { name: 'Bærende Bjælker', desc: 'Overliggere, remme, udveksling', color: '#a855f7' },
    soejler_baerende: { name: 'Søjler & Bærelinjer', desc: 'Søjler, understøtning', color: '#7c3aed' },
    el_installation: { name: 'El-installation', desc: 'Tavle, grupper, føringsveje', color: '#fbbf24' },
    stikledninger_forsyning: { name: 'Stikledninger & Målere', desc: 'Vand, el, fiber, målerskab', color: '#06b6d4' },
    stillads_adgang: { name: 'Stillads & Adgang', desc: 'Stillads, stiger, adgangsveje', color: '#f97316' },
    byggepladshegn: { name: 'Byggepladshegn', desc: 'Afskærmning, låge, skiltning', color: '#eab308' },
    skurvogn_materialer: { name: 'Skurvogn & Materialer', desc: 'Skurvogn, oplag, paller', color: '#78716c' },
    container_affald: { name: 'Container & Affald', desc: 'Container, bortkørsel, deponi', color: '#ea580c' },
    sortering_genbrug: { name: 'Sortering & Genbrug', desc: 'Fraktioner, big bags, genbrug', color: '#84cc16' },
    nedrivning_indvendig: { name: 'Nedrivning Indvendig', desc: 'Nedrivning, støvvægge, rydning', color: '#f87171' },
    asbest_miljosanering: { name: 'Asbest & Miljøsanering', desc: 'Asbest, PCB, bly, skimmel', color: '#dc2626' },
    bortkoersel_jord: { name: 'Bortkørsel af Jord', desc: 'Opgravet jord, analyser, deponi', color: '#92400e' },
    inventar_moebler: { name: 'Inventar & Møbler', desc: 'Køkken, bad, fast inventar', color: '#fbbf24' }
  };
  window.HOUSE_ZONES = ZONES;

  /* ---------------------------------------------------------------- textures */
  const QKEY = 'byggeapp.house3d.kvalitet';
  const PROFILE = {
    hoj: { tex: 256, aniso: 8, dpr: 1.65, aa: true, shadow: 1024, lite: false, clouds: 12, stars: [1500, 260, 40], env: true },
    mobil: { tex: 128, aniso: 4, dpr: 1.2, aa: false, shadow: 512, lite: true, clouds: 6, stars: [520, 110, 18], env: false }
  };
  function storedQuality() {
    try { const v = localStorage.getItem(QKEY); if (v === 'hoj' || v === 'mobil') return v; } catch (e) { /* private mode */ }
    return null;
  }
  function detectQuality() {
    const stored = storedQuality();
    if (stored) return stored;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) <= 700;
    const lowMem = (navigator.deviceMemory || 8) <= 4;
    return (coarse && small) || lowMem ? 'mobil' : 'hoj';   // phone → Mobil, tablet/desktop → Høj
  }
  window.houseQuality = { get: detectQuality, KEY: QKEY };

  const cv = (s) => { const c = document.createElement('canvas'); c.width = c.height = s; return c; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function grain(ctx, s, count, alpha, size) {
    for (let i = 0; i < count; i++) {
      const g = Math.random() * 255;
      ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, size, size);
    }
  }

  const GEN = {
    roof(s) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      x.fillStyle = '#23272c'; x.fillRect(0, 0, s, s);
      hx.fillStyle = '#303030'; hx.fillRect(0, 0, s, s);
      const rows = 8, tw = s / 6, th = s / rows;
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < 7; i++) {
          const px = i * tw - (r % 2 ? tw / 2 : 0), py = r * th;
          const v = rnd(-10, 12);
          x.fillStyle = `rgb(${58 + v},${62 + v},${68 + v})`;
          x.fillRect(px + 1, py + 2, tw - 2, th - 3);
          hx.fillStyle = `rgb(${170 + v * 2},${170 + v * 2},${170 + v * 2})`;
          hx.fillRect(px + 1, py + 2, tw - 2, th - 3);
          x.fillStyle = 'rgba(10,12,14,0.5)';
          x.fillRect(px + 1, py + th - 4, tw - 2, 3);
        }
        x.fillStyle = 'rgba(8,10,12,0.55)'; x.fillRect(0, r * th, s, 2);
        hx.fillStyle = '#101010'; hx.fillRect(0, r * th, s, 2);
      }
      grain(x, s, 5000, 0.05, 2);
      return { color: c, height: h, strength: 2.2 };
    },
    brick(s) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      x.fillStyle = '#dfdcd5'; x.fillRect(0, 0, s, s);
      hx.fillStyle = '#5a5a5a'; hx.fillRect(0, 0, s, s);
      const bw = s / 4, bh = s / 10;
      for (let r = 0; r < 10; r++) {
        for (let i = -1; i < 5; i++) {
          const px = i * bw + (r % 2 ? bw / 2 : 0), py = r * bh;
          const v = rnd(-7, 7);
          x.fillStyle = `rgb(${243 + v},${241 + v},${236 + v})`;
          x.fillRect(px + 2, py + 2, bw - 4, bh - 4);
          hx.fillStyle = `rgb(${210 + v},${210 + v},${210 + v})`;
          hx.fillRect(px + 2, py + 2, bw - 4, bh - 4);
        }
      }
      grain(x, s, 9000, 0.05, 2);
      return { color: c, height: h, strength: 1.5 };
    },
    wood(s, base) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      const rows = 5, ph = s / rows;
      for (let r = 0; r < rows; r++) {
        const v = rnd(-14, 14);
        x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
        x.fillRect(0, r * ph, s, ph);
        hx.fillStyle = `rgb(${196 + v},${196 + v},${196 + v})`;
        hx.fillRect(0, r * ph, s, ph);
        for (let g = 0; g < 26; g++) {
          x.strokeStyle = `rgba(${base[0] - 40},${base[1] - 34},${base[2] - 28},${rnd(0.06, 0.22)})`;
          x.lineWidth = rnd(0.6, 2.2);
          x.beginPath();
          const y0 = r * ph + rnd(2, ph - 2);
          x.moveTo(0, y0);
          x.bezierCurveTo(s * 0.3, y0 + rnd(-4, 4), s * 0.6, y0 + rnd(-4, 4), s, y0 + rnd(-3, 3));
          x.stroke();
        }
        x.fillStyle = 'rgba(30,20,12,0.45)'; x.fillRect(0, r * ph, s, 2);
        hx.fillStyle = '#121212'; hx.fillRect(0, r * ph, s, 2);
      }
      grain(x, s, 4000, 0.04, 2);
      return { color: c, height: h, strength: 1.1 };
    },
    concrete(s) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      x.fillStyle = '#b3b7bb'; x.fillRect(0, 0, s, s);
      hx.fillStyle = '#808080'; hx.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) {
        const v = rnd(-16, 12);
        x.fillStyle = `rgba(${176 + v},${180 + v},${185 + v},0.5)`;
        x.beginPath(); x.arc(Math.random() * s, Math.random() * s, rnd(6, 34), 0, 6.3); x.fill();
      }
      grain(x, s, 16000, 0.07, 2); grain(hx, s, 9000, 0.12, 2);
      return { color: c, height: h, strength: 0.8 };
    },
    grass(s) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      x.fillStyle = '#4a7d3a'; x.fillRect(0, 0, s, s);
      hx.fillStyle = '#666'; hx.fillRect(0, 0, s, s);
      for (let i = 0; i < 4200; i++) {
        const px = Math.random() * s, py = Math.random() * s, l = rnd(2, 7);
        x.strokeStyle = `rgb(${rnd(46, 96) | 0},${rnd(92, 150) | 0},${rnd(40, 72) | 0})`;
        x.lineWidth = rnd(0.8, 1.8);
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-2, 2), py - l); x.stroke();
        hx.strokeStyle = `rgba(255,255,255,${rnd(0.05, 0.25)})`;
        hx.lineWidth = 1.4; hx.beginPath(); hx.moveTo(px, py); hx.lineTo(px + rnd(-2, 2), py - l); hx.stroke();
      }
      return { color: c, height: h, strength: 1.4 };
    },
    dirt(s) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      x.fillStyle = '#5d452f'; x.fillRect(0, 0, s, s);
      hx.fillStyle = '#6a6a6a'; hx.fillRect(0, 0, s, s);
      for (let b = 0; b < 14; b++) {
        const v = rnd(-14, 16);
        x.fillStyle = `rgba(${95 + v},${72 + v},${52 + v},0.75)`;
        x.fillRect(0, b * (s / 14) + rnd(-3, 3), s, s / 14 + 4);
      }
      for (let i = 0; i < 380; i++) {
        const g = rnd(0.15, 0.5);
        x.fillStyle = `rgba(${120 * g | 0},${104 * g | 0},${88 * g | 0},0.8)`;
        x.beginPath(); x.arc(Math.random() * s, Math.random() * s, rnd(1.5, 5), 0, 6.3); x.fill();
      }
      grain(x, s, 18000, 0.08, 2); grain(hx, s, 14000, 0.2, 3);
      return { color: c, height: h, strength: 1.8 };
    },
    gravel(s) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      x.fillStyle = '#7e8286'; x.fillRect(0, 0, s, s);
      hx.fillStyle = '#5c5c5c'; hx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const g = rnd(0.55, 1.15), r = rnd(1.4, 4.4), px = Math.random() * s, py = Math.random() * s;
        x.fillStyle = `rgb(${(132 * g) | 0},${(136 * g) | 0},${(140 * g) | 0})`;
        x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill();
        hx.fillStyle = `rgba(255,255,255,${(g - 0.5) * 0.5})`;
        hx.beginPath(); hx.arc(px, py, r, 0, 6.3); hx.fill();
      }
      return { color: c, height: h, strength: 1.6 };
    },
    tiles(s) {
      const c = cv(s), x = c.getContext('2d'), h = cv(s), hx = h.getContext('2d');
      x.fillStyle = '#8d9195'; x.fillRect(0, 0, s, s);
      hx.fillStyle = '#2a2a2a'; hx.fillRect(0, 0, s, s);
      const n = 4, t = s / n;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const v = rnd(-12, 12);
        x.fillStyle = `rgb(${150 + v},${153 + v},${157 + v})`;
        x.fillRect(a * t + 3, b * t + 3, t - 6, t - 6);
        hx.fillStyle = `rgb(${200 + v},${200 + v},${200 + v})`;
        hx.fillRect(a * t + 3, b * t + 3, t - 6, t - 6);
      }
      grain(x, s, 12000, 0.06, 2);
      return { color: c, height: h, strength: 1.5 };
    }
  };

  function normalMapFrom(heightCanvas, strength) {
    const s = heightCanvas.width;
    const src = heightCanvas.getContext('2d').getImageData(0, 0, s, s).data;
    const out = cv(s), octx = out.getContext('2d'), img = octx.createImageData(s, s);
    const H = (x, y) => src[((((y + s) % s) * s + ((x + s) % s)) * 4)] / 255;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(-dx, -dy, 1), i = (y * s + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  /* ------------------------------------------------------------------ element */
  class HouseStage extends HTMLElement {
    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      this.style.display = 'block';
      this.style.position = 'relative';
      this.style.width = '100%';
      this.style.height = '100%';
      this.style.cursor = 'grab';
      this._overlay = document.createElement('div');
      this._overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
      this.appendChild(this._overlay);
      this._selected = new Set();
      this._hover = null;
      this._boot();
    }

    async _boot() {
      const THREE = await import(THREE_URL);
      this.T = THREE;
      const w = this.clientWidth || 960, h = this.clientHeight || 600;

      this.quality = this.quality || detectQuality();
      const P = this.P = PROFILE[this.quality];
      const renderer = new THREE.WebGLRenderer({
        antialias: P.aa, alpha: true, preserveDrawingBuffer: true,
        powerPreference: P.lite ? 'default' : 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, P.dpr));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = false;   // static scene: shadows are re-baked on demand
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
      this.insertBefore(renderer.domElement, this._overlay);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x06101a, 0.026);
      this.scene = scene;

      const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 240);
      this.camera = camera;
      this.target = new THREE.Vector3(0.55, 2.5, 0);
      this.targetTo = this.target.clone();
      this.stageMode = 'udvendig';
      this.level = 'stue';
      this.insideRoom = null;
      this.rMin = this.exteriorRMin || 13; this.rMax = this.exteriorRMax || 30;
      this.sph = { r: 22.0, theta: Math.atan2(8.4, 10.5), phi: 1.22 };
      this.HOME = { r: 22.0, theta: Math.atan2(8.4, 10.5), phi: 1.22, t: [0.55, 2.5, 0] };
      this.PLAN = {
        kaelder: { r: 19.5, phi: 0.21, t: [0.95, -2.2, 0] },
        stue: { r: 19.5, phi: 0.21, t: [0.95, 0.6, 0] },
        etage1: { r: 18.5, phi: 0.21, t: [0.7, 3.4, 0] }
      };
      this.sphTo = Object.assign({}, this.sph);
      this._applyCamera();

      this._makeLights();
      this._makeSky();
      this._makeMaterials();
      this.house = new THREE.Group();
      this.K = 1;                          // never scale the group non-uniformly
      scene.add(this.house);
      this.pickables = [];
      this.byZone = {};
      this.anchors = {};
      this.rooms = [
        { lvl: 'kaelder', p: [-1.2, -1.5, -0.5], t: 'Hobbyrum', a: 14, edge: { axis: 'x', at: 1.6, dir: 1 } },
        { lvl: 'kaelder', p: [1.4, -1.5, -1.35], t: 'Teknikrum', a: 6, edge: { axis: 'x', at: -0.4, dir: -1 } },
        { lvl: 'kaelder', p: [-2.8, -1.5, -0.7], t: 'Bryggers', a: 5, edge: { axis: 'x', at: -2.2, dir: 1 } },
        { lvl: 'kaelder', p: [-3.05, -1.5, 1.15], t: 'Gæstetoilet', a: 2, edge: { axis: 'x', at: -1.2, dir: 1 } },
        { lvl: 'kaelder', p: [3.7, -1.5, 0.4], t: 'Garage', a: 11, edge: { axis: 'z', at: 3.1 } },
        { lvl: 'stue', p: [0.6, 1.5, -0.95], t: 'Køkken', a: 10 },
        { lvl: 'stue', p: [-2.5, 1.5, -0.6], t: 'Spisestue', a: 9 },
        { lvl: 'stue', p: [-2.37, 1.5, 1.3], t: 'Stue', a: 11 },
        { lvl: 'stue', p: [1.85, 1.5, 0.75], t: 'Trappe', a: 4 },
        { lvl: 'stue', p: [0.35, 1.5, 1.75], t: 'Entré', a: 5 },
        { lvl: 'stue', p: [-2.0, 0.9, 2.6], t: 'Terrasse', a: 8, edge: { axis: 'x', at: -4.4, dir: 1 } },
        { lvl: 'stue', p: [4.0, 0.9, 0.4], t: 'Altan', a: 11, edge: { axis: 'z', at: 2.9 } },
        { lvl: 'etage1', p: [-2.5, 4.3, 0.7], t: 'Soveværelse', a: 13 },
        { lvl: 'etage1', p: [-0.25, 4.3, -0.5], t: 'Badeværelse', a: 7 },
        { lvl: 'etage1', p: [1.6, 4.3, 0.8], t: 'Loftstue', a: 10 }
      ];
      this.layer = 'alle';
      this._build();
      this._computeAnchors();
      this._classify();
      this._mergeBatches();
      (() => {
        const box = new THREE.Box3().setFromObject(this.house);
        const c = box.getCenter(new THREE.Vector3());
        const sph = box.getBoundingSphere(new THREE.Sphere());
        const vFov = this.camera.fov * Math.PI / 180;
        const r = Math.min(34, (sph.radius * 1.0) / Math.sin(vFov / 2));
        this.HOME = { r, theta: Math.atan2(8.4, 10.5), phi: 1.22, t: [c.x, c.y + 0.4, c.z] };
        // deterministic fit: grow r until all eight bbox corners are inside the frame
        const corners = [];
        [box.min.x, box.max.x].forEach((x) => [box.min.y, box.max.y].forEach((y) =>
          [box.min.z, box.max.z].forEach((z) => corners.push(new THREE.Vector3(x, y, z)))));
        let fit = Math.max(12, sph.radius * 1.2);
        for (let i = 0; i < 16; i++) {
          this.sph = { r: fit, theta: Math.atan2(8.4, 10.5), phi: 1.22 };
          this.target.set(c.x, c.y + 0.4, c.z);
          this._applyCamera();
          this.camera.updateMatrixWorld(true);
          let worst = 0;
          corners.forEach((p) => {
            const v = p.clone().project(this.camera);
            worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
          });
          if (worst <= 0.94) break;
          fit *= 1.06;
        }
        this.exteriorR = Math.min(38, fit);
        this.HOME.r = this.exteriorR;
        this.exteriorRMin = this.exteriorR * 0.45;
        this.exteriorRMax = this.exteriorR * 1.5;
        this.rMin = this.exteriorRMin;
        this.rMax = this.exteriorRMax;
        this.sph = { r: this.HOME.r, theta: this.HOME.theta, phi: this.HOME.phi };
        this.sphTo = { r: this.HOME.r, theta: this.HOME.theta, phi: this.HOME.phi };
        this.target.set(c.x, c.y + 0.4, c.z);
        this.targetTo.copy(this.target);
        this._applyCamera();
      })();

      this._grid = new THREE.GridHelper(24, 24, 0x1d3b5c, 0x142a42);
      this._grid.position.y = -3.09;
      this._grid.visible = false;
      scene.add(this._grid);

      this._raycaster = new THREE.Raycaster();
      this._pointer = new THREE.Vector2();
      if (!this._inputBound) { this._bindInput(); this._inputBound = true; }

      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this);

      this._clock = new THREE.Clock();
      renderer.setAnimationLoop(() => this._frame());
      this.renderer.shadowMap.needsUpdate = true;
      this.invalidate(3);
      window.__houseStage = this;
      window.dispatchEvent(new CustomEvent('housestage:ready', { detail: { stage: this } }));
    }

    /* ------------------------------------------------------------ lighting */
    _makeLights() {
      const T = this.T, s = this.scene;
      this.lights = {};
      const amb = new T.AmbientLight(0x8fb4d6, 0.42); s.add(amb);
      const hemi = new T.HemisphereLight(0x2a5c85, 0x070d14, 0.5); s.add(hemi);
      const key = new T.DirectionalLight(0xd8ecff, 1.25);
      key.position.set(9, 12, 7.5);
      key.castShadow = true;
      key.shadow.mapSize.set(this.P.shadow, this.P.shadow);
      const c = key.shadow.camera;
      c.left = -11; c.right = 11; c.top = 11; c.bottom = -11; c.near = 1; c.far = 34;
      key.shadow.bias = -0.0012;
      key.shadow.radius = 3;
      s.add(key);
      const fill = new T.DirectionalLight(0x9dc2e8, 0.35); fill.position.set(-8, 5, 6); s.add(fill);
      const rim = new T.DirectionalLight(0x4d7ea8, 0.3); rim.position.set(-4, 3, -9); s.add(rim);
      this.lights = { amb, hemi, key, fill, rim, warm: [] };
      const warmSpots = [
        [-1.4, 1.7, 0.7, 7], [1.3, 1.7, -0.6, 6], [-2.6, 1.6, -0.5, 4.5],
        [-2.4, 4.3, 0.3, 5], [0.4, 4.3, -1.0, 4.5], [1.5, 4.6, 0.9, 5],
        [0.35, -0.95, 1.15, 4.6], [-2.4, -1.15, 0.6, 2.2], [3.5, -0.75, 1.7, 5.5],
        [1.4, 6.0, 0.2, 3.5], [-2.2, 6.1, 0.4, 2.4], [4.1, 1.3, 0.4, 2.6], [-1.6, 1.2, 2.7, 2.2]
      ];
      const spots = this.P.lite ? warmSpots.filter((_, i) => i % 2 === 0 || i < 3) : warmSpots;
      spots.forEach(([x, y, z, i]) => {
        const p = new T.PointLight(0xffb877, i, 7.5, 2);
        p.position.set(x, y, z);
        s.add(p);
        this.lights.warm.push(p);
      });
      this._baseIntensity = {
        amb: amb.intensity, hemi: hemi.intensity, key: key.intensity,
        fill: fill.intensity, rim: rim.intensity, warm: spots.map((v) => v[3])
      };
    }

    _makeSky() {
      const T = this.T;
      const W = this.P.lite ? 640 : 1024, H = this.P.lite ? 400 : 640;
      const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
      const tex = (canvas) => { const t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; return t; };

      // ---------- gradient backdrops (featureless, so they may stay screen-fixed)
      const day = mkCanvas(W, H), dx = day.getContext('2d');
      let g = dx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0d4790'); g.addColorStop(0.3, '#2b76bd');
      g.addColorStop(0.58, '#71aadb'); g.addColorStop(0.82, '#b9d7ea');
      g.addColorStop(1, '#e2ecf1');
      dx.fillStyle = g; dx.fillRect(0, 0, W, H);

      const night = mkCanvas(W, H), nx = night.getContext('2d');
      g = nx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#01050b'); g.addColorStop(0.44, '#050f1d');
      g.addColorStop(0.74, '#0b1f33'); g.addColorStop(1, '#122c45');
      nx.fillStyle = g; nx.fillRect(0, 0, W, H);

      this._skyTex = { dag: tex(day), nat: tex(night) };
      this._bd = new T.Mesh(
        new T.PlaneGeometry(1, 1),
        new T.MeshBasicMaterial({ map: this._skyTex.nat, fog: false, depthWrite: false, toneMapped: false })
      );
      this._bd.name = 'himmel';
      this._bd.renderOrder = -1;
      this.scene.add(this._bd);

      /* ---------- world-space sky: it parallaxes when the model is rotated ----
         The wizard camera looks down at the model, so the visible background
         band sits BELOW the horizon — celestial objects therefore live at
         negative elevation. */
      const R2 = 105;
      const at = (azDeg, elDeg, r) => {
        const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180, d = r || R2;
        return new T.Vector3(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
      };
      this._world = new T.Group();
      this.scene.add(this._world);

      // stars — real points, so they stay pixel-sharp at any zoom
      const mkStars = (count, size, elFrom, elTo, bright) => {
        const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const v = at(Math.random() * 360, elFrom + Math.random() * (elTo - elFrom), R2 * rnd(0.92, 1.06));
          pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
          const w = rnd(bright ? 0.85 : 0.3, 1), tint = rnd(0.86, 1);
          col[i * 3] = w; col[i * 3 + 1] = w * rnd(0.94, 1); col[i * 3 + 2] = w * tint;
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(pos, 3));
        geo.setAttribute('color', new T.BufferAttribute(col, 3));
        const pts = new T.Points(geo, new T.PointsMaterial({
          size, sizeAttenuation: false, vertexColors: true, fog: false,
          transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false
        }));
        this._world.add(pts);
        return pts;
      };
      const SC = this.P.stars;
      this._stars = [
        mkStars(SC[0], 1.7, -62, 14, false),
        mkStars(SC[1], 2.9, -58, 12, true),
        mkStars(SC[2], 4.4, -50, 8, true)
      ];

      // moon
      const MS = 512, mC = mkCanvas(MS), mc = mC.getContext('2d');
      const cxp = MS / 2, cyp = MS / 2, mr = MS * 0.42;
      let mg = mc.createRadialGradient(cxp - mr * 0.32, cyp - mr * 0.34, mr * 0.05, cxp, cyp, mr);
      mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.45, '#f2f5fb');
      mg.addColorStop(0.82, '#dde5f1'); mg.addColorStop(1, '#c2cfe2');
      mc.fillStyle = mg; mc.beginPath(); mc.arc(cxp, cyp, mr, 0, 6.3); mc.fill();
      mc.save();
      mc.beginPath(); mc.arc(cxp, cyp, mr, 0, 6.3); mc.clip();
      // maria
      const maria = [[-0.30, -0.28, 0.30], [-0.05, -0.42, 0.20], [0.18, -0.16, 0.24],
        [-0.34, 0.12, 0.22], [0.05, 0.10, 0.17], [0.30, 0.30, 0.19], [-0.12, 0.38, 0.15]];
      maria.forEach((m) => {
        const px = cxp + m[0] * mr, py = cyp + m[1] * mr, r = m[2] * mr;
        const gg = mc.createRadialGradient(px, py, 0, px, py, r);
        gg.addColorStop(0, 'rgba(122,140,168,0.42)');
        gg.addColorStop(0.6, 'rgba(132,150,178,0.26)');
        gg.addColorStop(1, 'rgba(140,158,186,0)');
        mc.fillStyle = gg; mc.beginPath(); mc.arc(px, py, r, 0, 6.3); mc.fill();
      });
      // craters with lit rims
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * 6.3, d = Math.sqrt(Math.random()) * mr * 0.94;
        const px = cxp + Math.cos(a) * d, py = cyp + Math.sin(a) * d, r = rnd(mr * 0.02, mr * 0.075);
        mc.fillStyle = 'rgba(105,122,150,0.3)';
        mc.beginPath(); mc.arc(px, py, r, 0, 6.3); mc.fill();
        mc.strokeStyle = 'rgba(255,255,255,0.4)'; mc.lineWidth = Math.max(1, r * 0.28);
        mc.beginPath(); mc.arc(px - r * 0.12, py - r * 0.12, r * 0.92, 2.4, 5.6); mc.stroke();
      }
      // rays from a young crater + limb shading
      mc.strokeStyle = 'rgba(255,255,255,0.16)'; mc.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * 6.3, l = rnd(mr * 0.15, mr * 0.5);
        mc.beginPath();
        mc.moveTo(cxp - mr * 0.05, cyp + mr * 0.5);
        mc.lineTo(cxp - mr * 0.05 + Math.cos(a) * l, cyp + mr * 0.5 + Math.sin(a) * l);
        mc.stroke();
      }
      let lg = mc.createRadialGradient(cxp - mr * 0.25, cyp - mr * 0.3, mr * 0.4, cxp + mr * 0.15, cyp + mr * 0.2, mr * 1.12);
      lg.addColorStop(0, 'rgba(10,16,30,0)'); lg.addColorStop(0.72, 'rgba(10,16,30,0.1)');
      lg.addColorStop(1, 'rgba(8,14,26,0.45)');
      mc.fillStyle = lg; mc.fillRect(0, 0, MS, MS);
      mc.restore();

      const spr = (canvas, w, h, pos, additive, op) => {
        const m = new T.Sprite(new T.SpriteMaterial({
          map: tex(canvas), transparent: true, depthWrite: false, fog: false, toneMapped: false,
          opacity: op == null ? 1 : op, blending: additive ? T.AdditiveBlending : T.NormalBlending
        }));
        m.scale.set(w, h, 1);
        m.position.copy(pos);
        this._world.add(m);
        return m;
      };
      const haloC = mkCanvas(256), hc = haloC.getContext('2d');
      let hg = hc.createRadialGradient(128, 128, 20, 128, 128, 128);
      hg.addColorStop(0, 'rgba(188,214,248,0.5)'); hg.addColorStop(0.35, 'rgba(150,184,228,0.16)');
      hg.addColorStop(1, 'rgba(150,184,228,0)');
      hc.fillStyle = hg; hc.fillRect(0, 0, 256, 256);
      const moonPos = at(206, -8.5);
      this._moonHalo = spr(haloC, 30, 30, moonPos, true);
      this._moon = spr(mC, 9.5, 9.5, moonPos, false);

      // sun
      const sC = mkCanvas(256), sc2 = sC.getContext('2d');
      let sg = sc2.createRadialGradient(128, 128, 0, 128, 128, 128);
      sg.addColorStop(0, 'rgba(255,253,244,1)'); sg.addColorStop(0.11, 'rgba(255,251,232,1)');
      sg.addColorStop(0.16, 'rgba(255,238,190,0.9)'); sg.addColorStop(0.34, 'rgba(255,226,166,0.3)');
      sg.addColorStop(0.66, 'rgba(255,228,180,0.1)'); sg.addColorStop(1, 'rgba(255,232,190,0)');
      sc2.fillStyle = sg; sc2.fillRect(0, 0, 256, 256);
      this._sun = spr(sC, 15, 15, at(212, -5), true);

      // drifting clouds, high above the house
      const cloudC = mkCanvas(512, 256), cc = cloudC.getContext('2d');
      for (let i = 0; i < 18; i++) {
        const px = rnd(120, 392), py = rnd(112, 158), r = rnd(38, 92);
        cc.save();
        cc.translate(px, py);
        cc.scale(1, 0.55);
        const gg = cc.createRadialGradient(0, -r * 0.22, 0, 0, 0, r);
        gg.addColorStop(0, 'rgba(255,255,255,0.95)');
        gg.addColorStop(0.4, 'rgba(255,255,255,0.62)');
        gg.addColorStop(0.72, 'rgba(240,246,253,0.2)');
        gg.addColorStop(1, 'rgba(232,241,250,0)');
        cc.fillStyle = gg;
        cc.beginPath(); cc.arc(0, 0, r, 0, 6.3); cc.fill();
        cc.restore();
      }
      this._cloudGroup = new T.Group();
      this._world.add(this._cloudGroup);
      this._clouds = [];
      const CLOUDS = [[10, -3, 40], [45, -6.5, 32], [78, -2.5, 46], [112, -7.5, 34], [145, -4, 42], [178, -8, 30],
        [210, -3.5, 44], [242, -7, 36], [275, -2.5, 48], [305, -6, 32], [332, -9, 38], [355, -5, 42]];
      (this.P.clouds >= CLOUDS.length ? CLOUDS : CLOUDS.filter((_, i) => i % 2 === 0))
        .forEach((c) => {
          const p = at(c[0], c[1], R2 * rnd(0.72, 0.95));
          const m = new T.Sprite(new T.SpriteMaterial({
            map: tex(cloudC), transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0.9
          }));
          m.scale.set(c[2], c[2] * 0.5, 1);
          m.position.copy(p);
          m.userData.y0 = p.y;
          m.userData.ph = Math.random() * 6.3;
          this._cloudGroup.add(m);
          this._clouds.push(m);
        });

      // shooting star
      const stC = mkCanvas(256, 64), stx = stC.getContext('2d');
      let tg = stx.createLinearGradient(0, 32, 256, 32);
      tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(0.55, 'rgba(206,226,255,0.5)');
      tg.addColorStop(0.9, 'rgba(255,255,255,0.95)'); tg.addColorStop(1, 'rgba(255,255,255,0)');
      stx.fillStyle = tg; stx.fillRect(0, 28, 256, 8);
      tg = stx.createRadialGradient(232, 32, 0, 232, 32, 22);
      tg.addColorStop(0, 'rgba(255,255,255,1)'); tg.addColorStop(0.4, 'rgba(224,238,255,0.5)');
      tg.addColorStop(1, 'rgba(200,225,255,0)');
      stx.fillStyle = tg; stx.beginPath(); stx.arc(232, 32, 22, 0, 6.3); stx.fill();
      this._shootSpr = spr(stC, 26, 6.5, at(0, -12), true, 0);
      this._shootSpr.visible = false;
      this._shoot = { t: 0, next: rnd(6, 16), active: false, p0: new T.Vector3(), p1: new T.Vector3() };
      this._t = 0;
      if (this.P.env) {
        const eqt = tex(day);
        eqt.mapping = T.EquirectangularReflectionMapping;
        const pmrem = new T.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        this.scene.environment = pmrem.fromEquirectangular(eqt).texture;
        this.scene.environmentIntensity = 0.22;
        pmrem.dispose();
        eqt.dispose();
      }
      this.setLighting('nat');
    }

    _skyFrame(dt) {
      if (!this._world) return;
      const T = this.T;
      this._t += dt;
      const day = this._lightMode === 'dag';
      if (day) {
        this._drift = (this._drift || 0) + dt;
        const step = this.P.lite ? 0.1 : 0.05;          // ~10 fps mobile, ~20 fps desktop
        if (this._drift >= step) {
          this._cloudGroup.rotation.y += this._drift * 0.0075;
          this._clouds.forEach((c) => {
            c.position.y = c.userData.y0 + Math.sin(this._t * 0.11 + c.userData.ph) * 1.6;
          });
          this._drift = 0;
          this.invalidate(1);
        }
      } else {
        const sh = this._shoot;
        sh.t += dt;
        if (sh.active) {
          const k = sh.t / 1.15;
          if (k >= 1) { sh.active = false; sh.t = 0; sh.next = rnd(45, 75); this._shootSpr.visible = false; }
          else {
            this._shootSpr.position.lerpVectors(sh.p0, sh.p1, k);
            this._shootSpr.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.95;
          }
        } else if (sh.t > sh.next) {
          const az = Math.random() * 360, el = rnd(-34, 4);
          const az2 = az + rnd(14, 30) * (Math.random() < 0.5 ? -1 : 1), el2 = el - rnd(8, 20);
          const p = (a, e) => new T.Vector3(
            Math.sin(a * Math.PI / 180) * Math.cos(e * Math.PI / 180) * 100,
            Math.sin(e * Math.PI / 180) * 100,
            Math.cos(a * Math.PI / 180) * Math.cos(e * Math.PI / 180) * 100
          );
          sh.p0.copy(p(az, el)); sh.p1.copy(p(az2, el2));
          this.invalidate(2);
          const a0 = sh.p0.clone().project(this.camera), a1 = sh.p1.clone().project(this.camera);
          this._shootSpr.material.rotation = -Math.atan2(a1.y - a0.y, (a1.x - a0.x) * (this.camera.aspect || 1));
          this._shootSpr.position.copy(sh.p0);
          this._shootSpr.material.opacity = 0;
          this._shootSpr.visible = true;
          sh.active = true; sh.t = 0;
        }
      }
    }

    setLighting(mode) {
      const b = this._baseIntensity, l = this.lights, T = this.T;
      if (!l) return;
      const day = mode === 'dag';
      l.amb.intensity = b.amb * (day ? 1.05 : 1);
      l.amb.color.set(day ? 0xcfe0f2 : 0x8fb4d6);
      l.hemi.intensity = b.hemi * (day ? 1.45 : 1);
      l.hemi.color.set(day ? 0x9ecbf5 : 0x2a5c85);
      l.hemi.groundColor.set(day ? 0x5d6b57 : 0x070d14);
      l.key.intensity = b.key * (day ? 1.95 : 1);
      l.key.color.set(day ? 0xffeec9 : 0xd8ecff);
      l.fill.intensity = b.fill * (day ? 1.7 : 1);
      l.rim.intensity = b.rim * (day ? 1.8 : 1);
      l.warm.forEach((p, i) => { p.intensity = b.warm[i] * (day ? 0.3 : 1); });
      if (this.scene && this.scene.fog) this.scene.fog.color = new T.Color(day ? 0x9dc3dd : 0x06101a);
      this._lightMode = day ? 'dag' : 'nat';
      if (this._bd) {
        this._bd.material.map = this._skyTex[day ? 'dag' : 'nat'];
        this._bd.material.needsUpdate = true;
      }
      if (this._stars) this._stars.forEach((p) => { p.visible = !day; });
      if (this._moon) { this._moon.visible = !day; this._moonHalo.visible = !day; }
      if (this._sun) this._sun.visible = day;
      if (this._clouds) this._clouds.forEach((c) => { c.visible = day; });
      if (this._shootSpr) { this._shootSpr.visible = false; if (this._shoot) { this._shoot.active = false; this._shoot.t = 0; } }
      if (this.renderer) {
        this.renderer.toneMappingExposure = day ? 0.99 : 1.02;
        this.renderer.shadowMap.needsUpdate = true;
      }
      this.invalidate();
    }

    /* ----------------------------------------------------------- materials */
    _makeMaterials() {
      const T = this.T;
      const TS = this.P.tex;
      const aniso = Math.min(this.P.aniso, this.renderer.capabilities.getMaxAnisotropy());
      const build = (gen, density, opts) => {
        const g = gen(TS);
        const map = new T.CanvasTexture(g.color);
        map.colorSpace = T.SRGBColorSpace;
        const nrm = new T.CanvasTexture(normalMapFrom(g.height, g.strength * 3));
        [map, nrm].forEach((t) => {
          t.wrapS = t.wrapT = T.RepeatWrapping;
          t.anisotropy = aniso;
        });
        return Object.assign({ map, normalMap: nrm, density }, opts);
      };
      // one shared micro-normal so flat colours (plaster, lacquer, fabric) stop reading as plastic
      (() => {
        const h = cv(128), hx = h.getContext('2d');
        hx.fillStyle = '#808080'; hx.fillRect(0, 0, 128, 128);
        grain(hx, 128, 9000, 0.5, 1);
        const t = new T.CanvasTexture(normalMapFrom(h, 1.1));
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(3, 3);
        t.anisotropy = aniso;
        this._detailNormal = t;
      })();
      this.fam = {
        roof: build(GEN.roof, 0.85, { roughness: 0.82, metalness: 0.04 }),
        brick: build(GEN.brick, 1.15, { roughness: 0.78, metalness: 0 }),
        wood: build((s) => GEN.wood(s, [196, 152, 96]), 0.9, { roughness: 0.66, metalness: 0 }),
        deck: build((s) => GEN.wood(s, [158, 112, 68]), 0.8, { roughness: 0.7, metalness: 0 }),
        floor: build((s) => GEN.wood(s, [178, 126, 76]), 0.65, { roughness: 0.5, metalness: 0 }),
        concrete: build(GEN.concrete, 0.55, { roughness: 0.86, metalness: 0 }),
        grass: build(GEN.grass, 0.5, { roughness: 0.9, metalness: 0 }),
        dirt: build(GEN.dirt, 0.45, { roughness: 0.95, metalness: 0 }),
        gravel: build(GEN.gravel, 0.7, { roughness: 0.9, metalness: 0 }),
        tiles: build(GEN.tiles, 0.62, { roughness: 0.72, metalness: 0.02 })
      };
      const plain = (color, roughness, metalness, extra) =>
        Object.assign({ color, roughness, metalness, plain: true }, extra || {});
      this.solid = {
        plaster: plain(0xe9e6df, 0.9, 0),
        white: plain(0xf4f2ee, 0.55, 0),
        metal: plain(0x2b3037, 0.42, 0.72),
        steel: plain(0x9aa4ad, 0.32, 0.85),
        dark: plain(0x11151b, 0.6, 0.2),
        frame: plain(0x23272d, 0.45, 0.4),
        fabric: plain(0xc7c1b5, 0.94, 0),
        fabricDark: plain(0x8d8579, 0.94, 0),
        rug: plain(0xd6cfc1, 0.98, 0),
        leaf: plain(0x3d6b33, 0.9, 0),
        leafDark: plain(0x2f5629, 0.9, 0),
        bark: plain(0x4a3a2c, 0.92, 0),
        pot: plain(0xa9614a, 0.85, 0),
        car: plain(0x14181e, 0.28, 0.6),
        tyre: plain(0x0d0f12, 0.9, 0),
        solar: plain(0x101a2c, 0.22, 0.6),
        insulation: plain(0xd9c98f, 0.98, 0),
        lampWarm: plain(0x2a2620, 0.5, 0.3, { emissive: 0xffb060, emissiveIntensity: 1.6 }),
        headlight: plain(0xf2f6ff, 0.2, 0.2, { emissive: 0xdfe9ff, emissiveIntensity: 1.3 }),
        taillight: plain(0x5c1114, 0.3, 0.2, { emissive: 0xff2d2d, emissiveIntensity: 1.1 }),
        rim: plain(0xb9c2ca, 0.28, 0.9),
        skipSteel: plain(0x9a4a12, 0.62, 0.35),
        hutGrey: plain(0x6b7280, 0.7, 0.15),
        signal: plain(0xd97706, 0.6, 0.1),
        hazard: plain(0xb91c1c, 0.6, 0.05),
        bagWhite: plain(0xdfe3e8, 0.9, 0),
        sheet: plain(0xe8eef5, 0.5, 0),
        chrome: plain(0xced6dd, 0.2, 0.95),
        flowerA: plain(0xd1667f, 0.85, 0),
        flowerB: plain(0xe8b93f, 0.85, 0),
        flowerC: plain(0xa96fc4, 0.85, 0),
        soilBed: plain(0x4a3728, 0.95, 0)
      };
      this._matCache = new Map();
      this._geoCache = new Map();
      this._edgeMat = new T.LineBasicMaterial({ color: 0x7dbcff, transparent: true, opacity: 1 });
      this._glass = new T.MeshPhysicalMaterial({
        color: 0xbcd7e8, transparent: true, opacity: 0.17, roughness: 0.05,
        metalness: 0, side: T.DoubleSide, depthWrite: false
      });
      this._glassDark = new T.MeshPhysicalMaterial({
        color: 0x6d8698, transparent: true, opacity: 0.3, roughness: 0.1,
        metalness: 0.1, side: T.DoubleSide, depthWrite: false
      });
    }

    /* One material per zone+family. Selection emissive is a per-zone signal, so
       zone-scoped sharing gives identical behaviour with ~6x fewer materials. */
    _material(famKey, zoneId) {
      const T = this.T;
      if (famKey === 'glass') return this._glass;
      if (famKey === 'glassDark') return this._glassDark;
      const spec = this.fam[famKey] || this.solid[famKey];
      if (!spec) throw new Error('unknown material ' + famKey);
      const key = famKey + '|' + (zoneId || '');
      if (this._matCache.has(key)) return this._matCache.get(key);
      const m = new T.MeshStandardMaterial({
        color: spec.plain ? spec.color : 0xffffff,
        roughness: spec.roughness,
        metalness: spec.metalness || 0,
        map: spec.map || null,
        normalMap: spec.normalMap || this._detailNormal || null
      });
      const ns = spec.normalMap ? (zoneId ? 0.42 : 0.38) : 0.12;
      m.normalScale = new T.Vector2(ns, ns);
      if (spec.emissive) { m.emissive = new T.Color(spec.emissive); m.emissiveIntensity = spec.emissiveIntensity; }
      this._matCache.set(key, m);
      return m;
    }

    _boxGeo(w, h, d, density) {
      const key = w + '|' + h + '|' + d + '|' + density;
      if (this._geoCache.has(key)) return this._geoCache.get(key);
      const g = new this.T.BoxGeometry(w, h, d);
      if (density) {
        const uv = g.attributes.uv;
        const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
          const idx = f * 4 + i;
          uv.setXY(idx, uv.getX(idx) * dims[f][0] * density, uv.getY(idx) * dims[f][1] * density);
        }
        uv.needsUpdate = true;
      }
      this._geoCache.set(key, g);
      return g;
    }

    /* ------------------------------------------------------------- part api */
    _add(zoneId, mat, pos, size, opts) {
      const o = opts || {};
      const spec = this.fam[mat] || this.solid[mat];
      const density = spec && spec.density ? spec.density : 0;
      const geo = o.geo || this._boxGeo(size[0], size[1], size[2], density);
      const material = o.material || this._material(mat, zoneId);
      const mesh = new this.T.Mesh(geo, material);
      mesh.position.set(pos[0], pos[1], pos[2]);
      if (o.rot) mesh.rotation.set(o.rot[0] || 0, o.rot[1] || 0, o.rot[2] || 0);
      const NO_SHADOW = {
        inventar_moebler: 1, kloak_forsyning: 1, ladestander_elbil: 1, koekken: 1, badevaerelse: 1,
        udebelysning: 1, ventilation_anlaeg: 1, varme_vvs: 1, hvidevarer: 1,
        indvendig_belysning: 1, skabe_garderobe: 1, regnvand_faskine: 1,
        el_installation: 1, stikledninger_forsyning: 1, sortering_genbrug: 1, asbest_miljosanering: 1
      };
      mesh.castShadow = o.shadow !== false && !NO_SHADOW[zoneId] &&
        Math.max(size[0], size[1], size[2]) >= 0.4 && !/^bil_|potte|stol|lampe|pude|blomst/.test(o.name || '');
      mesh.receiveShadow = true;
      mesh.name = o.name || (zoneId || mat);
      if (zoneId) {
        mesh.userData.zoneId = zoneId;
        mesh.userData.baseEmissive = 0;
        this.pickables.push(mesh);
        (this.byZone[zoneId] || (this.byZone[zoneId] = [])).push(mesh);
      }
      this.house.add(mesh);
      return mesh;
    }

    _cyl(zoneId, mat, pos, r, h, seg, opts) {
      const geo = new this.T.CylinderGeometry(r, (opts && opts.r2) != null ? opts.r2 : r, h, seg || 16);
      return this._add(zoneId, mat, pos, [r * 2, h, r * 2], Object.assign({ geo }, opts || {}));
    }

    _blob(zoneId, mat, pos, r, detail) {
      const geo = new this.T.IcosahedronGeometry(r, detail || 0);
      return this._add(zoneId, mat, pos, [r, r, r], { geo });
    }

    /* --------------------------------------------------------------- build */
    _build() {
      const T = this.T;
      const A = this._add.bind(this), C = this._cyl.bind(this), B = this._blob.bind(this);
      // hollow window frame in a wall facing +/-X
      const FR = (zone, x, y, z, h, d, t, n) => {
        A(zone, 'frame', [x, y + h / 2 - t / 2, z], [0.14, t, d], { name: n + '_top' });
        A(zone, 'frame', [x, y - h / 2 + t / 2, z], [0.14, t, d], { name: n + '_bund' });
        A(zone, 'frame', [x, y, z - d / 2 + t / 2], [0.14, h - 2 * t, t], { name: n + '_a' });
        A(zone, 'frame', [x, y, z + d / 2 - t / 2], [0.14, h - 2 * t, t], { name: n + '_b' });
      };

      /* ---- site levels ------------------------------------------------- */
      const G = 0;         // lawn top
      const FF = 0.35;     // ground-floor finished level
      const LOW = -2.55;   // lower terrain / garage floor
      const BF = -2.45;    // basement floor top
      const F1 = 3.15;     // first floor level
      const EAVE = 5.35;

      // soil masses (static) — the plate is cut open in front of the basement
      A(null, 'dirt', [-4.975, -1.61, -0.1], [2.45, 2.98, 7.0], { name: 'terraen_vest' });
      A(null, 'dirt', [-0.5, -1.61, -2.84], [6.5, 2.98, 1.53], { name: 'terraen_nord' });
      A(null, 'dirt', [-2.575, -1.61, 2.74], [2.35, 2.98, 1.33], { name: 'terraen_sydvest' });
      A(null, 'dirt', [4.375, -2.9, 0.9], [3.25, 0.4, 9.0], { name: 'terraen_ost' });
      A(null, 'concrete', [2.63, -1.35, -2.85], [0.26, 2.5, 1.5], { name: 'stoettemur_nord' });

      // lawn + garden
      A('graesplaene', 'grass', [-4.975, -0.06, -0.1], [2.45, 0.16, 7.0], { name: 'plaene_vest' });
      A('graesplaene', 'grass', [-0.5, -0.06, -2.84], [6.5, 0.16, 1.53], { name: 'plaene_nord' });
      A('graesplaene', 'grass', [-2.575, -0.06, 2.74], [2.35, 0.16, 1.33], { name: 'plaene_syd' });
      A('haek_levende', 'leafDark', [-1.3, 0.58, -3.28], [8.2, 1.3, 0.42], { name: 'haek_nord' });
      A('haek_levende', 'leafDark', [5.95, -2.05, 1.1], [0.36, 1.1, 8.0], { name: 'haek_skel' });
      [[-4.7, 1.9], [-4.3, 1.1], [-4.75, 0.3], [-4.35, -0.5], [-4.7, -1.3]].forEach((p, i) =>
        A('stier_traedesten', 'tiles', [p[0], 0.04, p[1]], [0.55, 0.08, 0.42], { name: 'traedesten_' + i }));
      [[-5.85, 1.55, 0.34], [-5.5, 2.55, 0.26], [-4.15, 1.95, 0.3], [-5.95, -0.9, 0.32], [-6.0, -0.1, 0.26]].forEach((p) => {
        B('beplantning', 'leaf', [p[0], p[2] * 0.7, p[1]], p[2], 1);
      });
      // tree
      C('beplantning', 'bark', [-4.95, 1.35, 2.45], 0.2, 2.7, 10, { r2: 0.28, name: 'traestamme' });
      [[-4.95, 3.3, 2.45, 1.05], [-5.7, 2.95, 2.1, 0.68], [-4.35, 3.0, 2.95, 0.7], [-5.1, 3.95, 2.8, 0.62], [-4.55, 3.8, 1.95, 0.58]]
        .forEach((p) => B('beplantning', 'leaf', [p[0], p[1], p[2]], p[3], 1));

      // driveway / paving
      A('indkoersel_belaegning', 'gravel', [4.3, LOW + 0.05, 3.75], [3.2, 0.14, 3.3], { name: 'indkoersel' });
      A('indkoersel_belaegning', 'tiles', [4.3, LOW + 0.07, 1.2], [3.3, 0.14, 1.8], { name: 'forplads_fliser' });
      A('indkoersel_belaegning', 'concrete', [4.1, LOW - 0.06, 1.9], [2.9, 0.12, 0.2], { name: 'belaegningskant' });
      // car ramp: rises 25 % out of the sunken court and is cut by the plate edge
      for (let i = 0; i < 6; i++) {
        const zc = 3.25 + (i + 0.5) * 0.358;
        const h = (-2.48 + (i + 0.5) * 0.164) + 2.7;
        A(null, 'dirt', [3.65, -2.7 + h / 2, zc], [1.94, h, 0.362], { name: 'terraen_rampefyld_' + i });
      }
      A('indkoersel_belaegning', 'concrete', [3.65, -1.99, 4.325], [1.8, 0.2, 2.37], { rot: [-0.43, 0, 0], name: 'garagerampe' });
      [2.79, 4.51].forEach((x, i) =>
        A('indkoersel_belaegning', 'concrete', [x, -1.85, 4.325], [0.14, 0.28, 2.37], { rot: [-0.43, 0, 0], name: 'rampekant_' + i }));
      A('indkoersel_belaegning', 'gravel', [3.65, LOW + 0.04, 2.75], [1.8, 0.16, 0.8], { name: 'rampe_forplads' });
      A('kloak_forsyning', 'steel', [3.35, -2.42, 2.36], [1.5, 0.08, 0.22], { name: 'linjeafloeb' });

      /* ---- foundation / plinth ---------------------------------------- */
      const HX0 = -3.75, HX1 = 2.5, HZ0 = -2.075, HZ1 = 2.075;
      const hw = HX1 - HX0, hd = HZ1 - HZ0, hcx = (HX0 + HX1) / 2, hcz = (HZ0 + HZ1) / 2;
      A('fundament_sokkel', 'concrete', [hcx, -2.7, hcz], [hw + 0.5, 0.34, hd + 0.5], { name: 'fundament_saal' });
      [[hcx, HZ0 + 0.14, hw, 0.28], [hcx, HZ1 - 0.14, hw, 0.28]].forEach((p, i) =>
        A('fundament_sokkel', 'concrete', [p[0], 0.12, p[1]], [p[2], 0.46, p[3]], { name: 'sokkel_z' + i }));
      [[HX0 + 0.14, hcz, 0.28, hd], [HX1 - 0.14, hcz, 0.28, hd]].forEach((p, i) =>
        A('fundament_sokkel', 'concrete', [p[0], 0.12, p[1]], [p[2], 0.46, p[3]], { name: 'sokkel_x' + i }));

      /* ---- basement ---------------------------------------------------- */
      A('etagedaek_gulve', 'concrete', [hcx, BF - 0.09, hcz], [hw, 0.18, hd], { name: 'kaeldergulv' });
      A('kaelder_udvendig', 'concrete', [hcx, -1.15, HZ0 + 0.11], [hw, 2.44, 0.22], { name: 'kaeldervaeg_nord' });
      A('kaelder_udvendig', 'concrete', [HX0 + 0.11, -1.15, hcz], [0.22, 2.44, hd], { name: 'kaeldervaeg_vest' });
      A('kaelder_udvendig', 'concrete', [HX1 - 0.11, -1.15, hcz], [0.22, 2.44, hd], { name: 'kaeldervaeg_ost' });
      A('kaelder_udvendig', 'concrete', [HX0 + 0.7, -1.15, HZ1 - 0.11], [1.4, 2.44, 0.22], { name: 'kaeldervaeg_syd_a' });
      A('kaelder_udvendig', 'concrete', [HX1 - 0.7, -1.15, HZ1 - 0.11], [1.4, 2.44, 0.22], { name: 'kaeldervaeg_syd_b' });
      A('etagedaek_gulve', 'concrete', [hcx, 0.16, hcz], [hw, 0.38, hd], { name: 'etagedaek_kaelder' });

      // utilities
      C('kloak_forsyning', 'steel', [-3.3, -1.3, -1.72], 0.075, 2.2, 12, { name: 'faldstamme' });
      C('varme_vvs', 'steel', [-1.6, -2.25, -1.86], 0.06, 3.2, 12, { rot: [0, 0, Math.PI / 2], name: 'vandroer' });
      A('el_installation', 'metal', [-2.85, -1.55, -1.78], [0.5, 0.7, 0.24], { name: 'el_tavle' });
      A('el_installation', 'frame', [-2.85, -1.55, -1.65], [0.44, 0.6, 0.03], { name: 'el_tavle_laage' });
      A('el_installation', 'steel', [-2.85, -1.08, -1.8], [0.14, 0.24, 0.1], { name: 'el_stigrende' });
      [-2.0, -0.6, 0.8].forEach((x, i) =>
        A('el_installation', 'steel', [x, -0.28, -1.82], [1.3, 0.06, 0.12], { name: 'kabelbakke_' + i }));
      A('el_installation', 'steel', [1.2, -0.9, -1.86], [0.16, 1.3, 0.06], { name: 'el_foeringsvej_lodret' });
      A('varme_vvs', 'steel', [1.5, -1.9, -1.8], [0.55, 1.0, 0.4], { name: 'varmtvandsbeholder' });
      C('kloak_forsyning', 'steel', [1.05, -2.3, 0.9], 0.09, 2.9, 12, { rot: [Math.PI / 2, 0, 0], name: 'kloakledning' });

      // basement furniture
      A('inventar_moebler', 'wood', [-1.25, -1.72, -1.35], [1.5, 0.08, 0.68], { name: 'vaerkstedsbord' });
      [[-1.9, -1.9], [-0.6, -1.9]].forEach((p, i) =>
        A('inventar_moebler', 'metal', [p[0], -2.15, -1.35], [0.08, 0.62, 0.6], { name: 'bordben' + i }));
      A('inventar_moebler', 'wood', [-0.15, -1.95, -0.65], [0.42, 0.06, 0.42], { name: 'skammel' });
      C('inventar_moebler', 'metal', [-0.15, -2.2, -0.65], 0.05, 0.5, 8, { name: 'skammelben' });
      A('skabe_garderobe', 'metal', [0.75, -1.6, -1.72], [1.1, 1.7, 0.36], { name: 'reol_kaelder' });
      [-1.6, -1.15, -0.7].forEach((z, i) =>
        A('skabe_garderobe', 'metal', [0.75, -1.6, z], [1.06, 0.04, 0.34], { name: 'reol_hylde_' + i }));
      A('inventar_moebler', 'wood', [0.35, -1.72, 1.15], [0.95, 0.07, 0.95], { name: 'kaelderbord' });
      [[-0.12, 1.15], [0.82, 1.15]].forEach((p, i) => {
        A('inventar_moebler', 'wood', [p[0], -1.95, p[1]], [0.4, 0.05, 0.4], { name: 'kaelderstol_saede' + i });
        A('inventar_moebler', 'wood', [p[0], -1.7, p[1] + 0.18], [0.4, 0.45, 0.05], { name: 'kaelderstol_ryg' + i });
      });
      C('indvendig_belysning', 'lampWarm', [0.35, -0.98, 1.15], 0.17, 0.14, 12, { r2: 0.05, name: 'pendel_kaelder' });
      C('indvendig_belysning', 'metal', [0.35, -0.72, 1.15], 0.012, 0.4, 6, { name: 'pendel_ledning' });
      [[-2.3, 0.9], [1.6, 0.9]].forEach((p, i) =>
        A('soejler_baerende', 'concrete', [p[0], -1.15, p[1]], [0.34, 2.44, 0.34], { name: 'kaeldersoejle_' + i }));

      // utility room and guest WC (one of each room type)
      A('indvendige_vaegge', 'plaster', [-2.0, -1.25, -0.65], [0.12, 2.4, 2.6], { name: 'skillevaeg_bryggers' });
      A('indvendige_vaegge', 'plaster', [-2.85, -1.25, 0.62], [1.66, 2.4, 0.12], { name: 'skillevaeg_gaestetoilet' });
      A('hvidevarer', 'white', [-3.3, -2.02, -1.3], [0.6, 0.85, 0.6], { name: 'vaskemaskine' });
      A('hvidevarer', 'white', [-2.62, -2.02, -1.3], [0.6, 0.85, 0.6], { name: 'toerretumbler' });
      A('hvidevarer', 'frame', [-3.3, -2.02, -0.98], [0.42, 0.42, 0.03], { name: 'vaskemaskine_laage' });
      A('hvidevarer', 'frame', [-2.62, -2.02, -0.98], [0.42, 0.42, 0.03], { name: 'toerretumbler_laage' });
      A('badevaerelse', 'white', [-3.35, -2.2, -0.15], [0.5, 0.5, 0.42], { name: 'bryggersvask' });
      C('badevaerelse', 'chrome', [-3.35, -1.88, -0.15], 0.018, 0.24, 8, { name: 'bryggersarmatur' });
      A('badevaerelse', 'white', [-3.32, -2.28, 1.15], [0.36, 0.4, 0.52], { name: 'gaestetoilet_skaal' });
      A('badevaerelse', 'white', [-3.32, -2.06, 1.15], [0.34, 0.05, 0.46], { name: 'gaestetoilet_saede' });
      A('badevaerelse', 'white', [-3.5, -1.94, 1.15], [0.14, 0.48, 0.4], { name: 'gaestetoilet_cisterne' });
      A('badevaerelse', 'white', [-2.75, -1.95, 1.35], [0.4, 0.14, 0.3], { name: 'gaestetoilet_haandvask' });
      A('badevaerelse', 'tiles', [-3.1, -2.42, 1.1], [1.0, 0.05, 0.9], { name: 'gaestetoilet_gulvfliser' });

      /* ---- ground floor ----------------------------------------------- */
      const gTop = 2.95;
      A('etagedaek_gulve', 'floor', [hcx, FF - 0.03, hcz], [hw - 0.44, 0.06, hd - 0.44], { name: 'gulv_stue' });
      // north wall + windows
      A('facade_stueetage', 'brick', [hcx, (FF + gTop) / 2, HZ0 + 0.11], [hw, gTop - FF, 0.22], { name: 'facade_nord_stue' });
      // west gable: piers + header + sliding doors
      A('facade_stueetage', 'brick', [HX0 + 0.11, (FF + gTop) / 2, -1.72], [0.22, gTop - FF, 0.71], { name: 'facade_vest_stue_a' });
      A('facade_stueetage', 'brick', [HX0 + 0.11, (FF + gTop) / 2, 1.76], [0.22, gTop - FF, 0.63], { name: 'facade_vest_stue_b' });
      A('baerende_bjaelker', 'brick', [HX0 + 0.11, 2.75, 0.02], [0.22, 0.4, 2.85], { name: 'facade_vest_stue_overligger' });
      FR('vinduer_doere_stueetage', HX0 + 0.11, 1.44, 0.02, 2.2, 2.85, 0.11, 'karm_vest_stue');
      A('vinduer_doere_stueetage', 'glass', [HX0 + 0.13, 1.44, 0.02], [0.06, 2.02, 2.65], { name: 'glas_vest_stue', shadow: false });
      A('vinduer_doere_stueetage', 'frame', [HX0 + 0.09, 1.44, 0.02], [0.08, 2.1, 0.08], { name: 'sprosse_vest_stue' });
      // east wall toward terrace: sliding doors
      A('facade_stueetage', 'brick', [HX1 - 0.11, (FF + gTop) / 2, -1.68], [0.22, gTop - FF, 0.8], { name: 'facade_ost_stue_a' });
      A('baerende_bjaelker', 'brick', [HX1 - 0.11, 2.75, 0.15], [0.22, 0.4, 3.05], { name: 'facade_ost_stue_overligger' });
      FR('vinduer_doere_stueetage', HX1 - 0.11, 1.44, 0.35, 2.2, 2.65, 0.11, 'karm_ost_stue');
      A('vinduer_doere_stueetage', 'glass', [HX1 - 0.13, 1.44, 0.35], [0.06, 2.02, 2.45], { name: 'glas_ost_stue', shadow: false });
      A('vinduer_doere_stueetage', 'frame', [HX1 - 0.09, 1.44, 0.35], [0.08, 2.1, 0.08], { name: 'sprosse_ost_stue' });
      // interior partitions (static)
      A('indvendige_vaegge', 'plaster', [-1.15, 1.65, -0.35], [0.12, 2.6, 3.2], { name: 'skillevaeg_stue_a' });
      A('indvendige_vaegge', 'plaster', [-2.155, 1.65, -1.15], [1.89, 2.6, 0.12], { name: 'skillevaeg_stue_b' });

      // kitchen — base run, appliances, island, pendants
      A('koekken', 'white', [0.36, 0.78, -1.65], [2.66, 0.86, 0.6], { name: 'koekken_korpus' });
      [-0.71, -0.16, 0.39, 0.94, 1.49].forEach((x, i) =>
        A('koekken', 'white', [x, 0.78, -1.335], [0.5, 0.8, 0.03], { name: 'koekken_laage_' + i }));
      [-0.71, -0.16, 0.39, 0.94, 1.49].forEach((x, i) =>
        A('koekken', 'chrome', [x, 1.12, -1.31], [0.3, 0.02, 0.02], { name: 'koekken_greb_' + i }));
      A('koekken', 'concrete', [0.36, 1.235, -1.63], [2.78, 0.05, 0.66], { name: 'bordplade' });
      A('koekken', 'tiles', [0.36, 1.52, -1.93], [2.78, 0.52, 0.03], { name: 'koekken_vaegfliser' });
      A('koekken', 'steel', [0.52, 1.245, -1.62], [0.46, 0.05, 0.38], { name: 'vask' });
      C('koekken', 'chrome', [0.52, 1.4, -1.78], 0.02, 0.28, 8, { name: 'armatur' });
      A('inventar_moebler', 'chrome', [0.52, 1.53, -1.71], [0.03, 0.03, 0.16], { name: 'armatur_tud' });
      A('hvidevarer', 'dark', [1.34, 1.27, -1.62], [0.56, 0.03, 0.42], { name: 'kogeplade' });
      [[1.2, -1.72], [1.48, -1.72], [1.2, -1.52], [1.48, -1.52]].forEach((p, i) =>
        C('hvidevarer', 'metal', [p[0], 1.29, p[1]], 0.08, 0.01, 12, { name: 'kogezone_' + i }));
      A('hvidevarer', 'metal', [1.34, 0.72, -1.33], [0.54, 0.56, 0.03], { name: 'ovn_front' });
      A('hvidevarer', 'chrome', [1.34, 0.98, -1.3], [0.5, 0.03, 0.03], { name: 'ovn_greb' });
      A('hvidevarer', 'white', [2.05, 1.25, -1.68], [0.64, 1.8, 0.6], { name: 'koeleskab' });
      A('hvidevarer', 'chrome', [1.74, 1.5, -1.68], [0.03, 0.5, 0.03], { name: 'koeleskab_greb' });
      A('koekken', 'white', [1.25, 2.06, -1.78], [1.35, 0.62, 0.34], { name: 'koekken_overskabe' });
      [0.95, 1.6].forEach((x, i) =>
        A('inventar_moebler', 'chrome', [x, 1.79, -1.6], [0.4, 0.02, 0.02], { name: 'overskab_greb_' + i }));
      A('hvidevarer', 'metal', [0.42, 1.95, -1.74], [0.6, 0.14, 0.44], { name: 'emhaette' });
      A('hvidevarer', 'metal', [0.42, 2.3, -1.84], [0.26, 0.56, 0.26], { name: 'emhaette_kanal' });
      A('koekken', 'white', [0.45, 0.78, -0.4], [2.0, 0.86, 0.8], { name: 'koekkenoe' });
      A('koekken', 'concrete', [0.45, 1.235, -0.4], [2.13, 0.05, 0.9], { name: 'oe_bordplade' });
      A('koekken', 'chrome', [0.45, 1.0, 0.02], [1.85, 0.02, 0.02], { name: 'oe_greb' });
      [0.0, 0.6, 1.2].forEach((x, i) => {
        C('koekken', 'wood', [x, 1.02, 0.22], 0.17, 0.05, 14, { name: 'barstol_saede_' + i });
        C('koekken', 'metal', [x, 0.68, 0.22], 0.04, 0.64, 8, { name: 'barstol_ben_' + i });
      });
      [0.0, 0.45, 0.9].forEach((x, i) => {
        C('indvendig_belysning', 'metal', [x, 2.35, -0.4], 0.012, 0.55, 6, { name: 'oe_pendel_ledning_' + i });
        C('indvendig_belysning', 'lampWarm', [x, 2.0, -0.4], 0.13, 0.16, 12, { r2: 0.05, name: 'oe_pendel_' + i });
      });

      // dining
      A('inventar_moebler', 'wood', [-2.55, 1.08, -0.55], [1.45, 0.07, 0.85], { name: 'spisebord' });
      [[-3.16, -0.9], [-1.94, -0.9], [-3.16, -0.2], [-1.94, -0.2]].forEach((p, i) =>
        A('inventar_moebler', 'wood', [p[0], 0.72, p[1]], [0.07, 0.68, 0.07], { name: 'spisebordben' + i }));
      [[-3.05, 0.15], [-2.05, 0.15], [-3.05, -1.25], [-2.05, -1.25]].forEach((p, i) => {
        A('inventar_moebler', 'fabric', [p[0], 0.79, p[1]], [0.44, 0.06, 0.44], { name: 'stol_saede' + i });
        A('inventar_moebler', 'wood', [p[0], 1.05, p[1] + (i > 1 ? -0.2 : 0.2)], [0.44, 0.5, 0.06], { name: 'stol_ryg' + i });
      });
      // lounge
      A('inventar_moebler', 'rug', [-2.37, 0.4, 1.2], [2.0, 0.03, 1.9], { name: 'taeppe_stue', shadow: false });
      A('inventar_moebler', 'fabric', [-2.37, 0.58, 1.82], [2.0, 0.42, 0.85], { name: 'sofa_saede' });
      A('inventar_moebler', 'fabric', [-2.37, 0.92, 2.14], [2.0, 0.72, 0.24], { name: 'sofa_ryg' });
      A('inventar_moebler', 'fabricDark', [-3.27, 0.85, 1.82], [0.2, 0.55, 0.85], { name: 'sofa_arm_a' });
      A('inventar_moebler', 'fabricDark', [-1.47, 0.85, 1.82], [0.2, 0.55, 0.85], { name: 'sofa_arm_b' });
      A('inventar_moebler', 'fabric', [-1.8, 0.58, 0.95], [0.85, 0.42, 0.85], { name: 'laenestol_saede' });
      A('inventar_moebler', 'fabric', [-2.22, 0.92, 0.95], [0.2, 0.72, 0.85], { name: 'laenestol_ryg' });
      A('inventar_moebler', 'wood', [-2.9, 0.72, 1.05], [0.9, 0.06, 0.58], { name: 'sofabord' });
      [[-3.27, 0.85], [-2.53, 0.85], [-3.27, 1.25], [-2.53, 1.25]].forEach((p, i) =>
        A('inventar_moebler', 'metal', [p[0], 0.53, p[1]], [0.05, 0.34, 0.05], { name: 'sofabordben' + i }));
      C('indvendig_belysning', 'metal', [-3.3, 1.05, 0.55], 0.03, 1.4, 8, { name: 'gulvlampe_stang' });
      C('indvendig_belysning', 'lampWarm', [-3.3, 1.82, 0.55], 0.16, 0.22, 12, { r2: 0.11, name: 'gulvlampe_skaerm' });
      // plants
      C('inventar_moebler', 'pot', [-0.3, 0.53, 1.9], 0.22, 0.36, 12, { name: 'potte_stue' });
      B('inventar_moebler', 'leaf', [-0.3, 0.95, 1.9], 0.36, 1);
      C('inventar_moebler', 'pot', [-3.35, 0.5, 1.55], 0.18, 0.3, 12, { name: 'potte_stue_b' });
      B('inventar_moebler', 'leafDark', [-3.35, 0.85, 1.55], 0.28, 1);
      // stairs
      for (let i = 0; i < 12; i++) {
        A('trapper_indvendig', 'wood', [1.85, FF + 0.12 + i * 0.235, 1.55 - i * 0.24], [0.95, 0.06, 0.28],
          { name: 'trappetrin_' + i });
      }

      /* ---- first floor ------------------------------------------------- */
      A('etagedaek_gulve', 'concrete', [hcx, gTop + 0.1, hcz], [hw, 0.2, hd], { name: 'etagedaek_1sal' });
      A('etagedaek_gulve', 'floor', [hcx, F1 - 0.03, hcz], [hw - 0.44, 0.06, hd - 0.44], { name: 'gulv_1sal' });
      A('facade_overetage', 'brick', [hcx, (F1 + EAVE) / 2, HZ0 + 0.11], [hw, EAVE - F1, 0.22], { name: 'facade_nord_1sal' });
      // west gable upper: piers, sill, header, two windows
      A('facade_overetage', 'brick', [HX0 + 0.11, (F1 + EAVE) / 2, -1.79], [0.22, EAVE - F1, 0.57], { name: 'facade_vest_1sal_a' });
      A('facade_overetage', 'brick', [HX0 + 0.11, (F1 + EAVE) / 2, 0.0], [0.22, EAVE - F1, 0.5], { name: 'facade_vest_1sal_b' });
      A('facade_overetage', 'brick', [HX0 + 0.11, (F1 + EAVE) / 2, 1.79], [0.22, EAVE - F1, 0.57], { name: 'facade_vest_1sal_c' });
      A('facade_overetage', 'brick', [HX0 + 0.11, F1 + 0.42, 0.0], [0.22, 0.84, 3.58], { name: 'facade_vest_1sal_brystning' });
      A('baerende_bjaelker', 'brick', [HX0 + 0.11, EAVE - 0.3, 0.0], [0.22, 0.6, 3.58], { name: 'facade_vest_1sal_overligger' });
      [-0.9, 0.9].forEach((z, i) => {
        FR('vinduer_overetage', HX0 + 0.11, 4.24, z, 1.06, 1.2, 0.09, 'karm_vest_1sal_' + i);
        A('vinduer_overetage', 'glass', [HX0 + 0.13, 4.24, z], [0.06, 0.9, 1.04], { name: 'glas_vest_1sal_' + i, shadow: false });
        A('vinduer_overetage', 'frame', [HX0 + 0.09, 4.24, z], [0.08, 0.94, 0.07], { name: 'sprosse_vest_1sal_' + i });
      });
      // east: glass wall to balcony
      A('facade_overetage', 'brick', [HX1 - 0.11, (F1 + EAVE) / 2, -1.72], [0.22, EAVE - F1, 0.71], { name: 'facade_ost_1sal_a' });
      A('baerende_bjaelker', 'brick', [HX1 - 0.11, EAVE - 0.28, 0.35], [0.22, 0.56, 2.7], { name: 'facade_ost_1sal_overligger' });
      FR('vinduer_overetage', HX1 - 0.11, 4.15, 0.35, 1.9, 2.7, 0.11, 'karm_ost_1sal');
      A('vinduer_overetage', 'glass', [HX1 - 0.13, 4.15, 0.35], [0.06, 1.74, 2.5], { name: 'glas_ost_1sal', shadow: false });
      A('vinduer_overetage', 'frame', [HX1 - 0.09, 4.15, 0.35], [0.08, 1.8, 0.08], { name: 'sprosse_ost_1sal' });
      A('indvendige_vaegge', 'plaster', [-0.95, 4.25, -0.15], [0.12, 2.2, 3.4], { name: 'skillevaeg_1sal' });
      A('indvendige_vaegge', 'plaster', [-2.35, 4.25, -0.15], [2.9, 2.2, 0.12], { name: 'skillevaeg_1sal_b' });

      // bathroom — tiled floor and walls, wc, vanity, shower, tub
      A('badevaerelse', 'tiles', [-0.22, F1 + 0.02, -0.5], [1.3, 0.05, 2.75], { name: 'bad_gulvfliser' });
      A('badevaerelse', 'tiles', [-0.86, 3.95, -0.5], [0.04, 1.55, 2.75], { name: 'bad_vaegfliser_vest' });
      A('badevaerelse', 'tiles', [-0.22, 3.95, -1.87], [1.3, 1.55, 0.04], { name: 'bad_vaegfliser_nord' });
      A('badevaerelse', 'white', [-0.24, 3.42, -1.5], [1.22, 0.5, 0.7], { name: 'badekar' });
      A('badevaerelse', 'glass', [-0.24, 3.66, -1.5], [1.06, 0.04, 0.56], { name: 'badekar_vand', shadow: false });
      C('badevaerelse', 'chrome', [-0.24, 3.8, -1.8], 0.018, 0.26, 8, { name: 'badekar_armatur' });
      A('badevaerelse', 'white', [-0.64, 3.47, -0.4], [0.44, 0.58, 0.9], { name: 'vaskeskab' });
      A('badevaerelse', 'concrete', [-0.64, 3.78, -0.4], [0.48, 0.05, 0.96], { name: 'vaskebord' });
      C('badevaerelse', 'white', [-0.64, 3.83, -0.4], 0.19, 0.09, 16, { name: 'haandvask' });
      C('badevaerelse', 'chrome', [-0.8, 3.94, -0.4], 0.017, 0.24, 8, { name: 'bad_armatur' });
      A('badevaerelse', 'glass', [-0.845, 4.18, -0.4], [0.03, 0.62, 0.8], { name: 'spejl', shadow: false });
      A('badevaerelse', 'white', [-0.6, 3.37, 0.62], [0.38, 0.42, 0.56], { name: 'toilet_skaal' });
      A('badevaerelse', 'white', [-0.6, 3.6, 0.62], [0.36, 0.05, 0.5], { name: 'toilet_saede' });
      A('badevaerelse', 'white', [-0.79, 3.72, 0.62], [0.16, 0.52, 0.42], { name: 'toilet_cisterne' });
      A('badevaerelse', 'chrome', [-0.7, 3.94, 0.62], [0.03, 0.08, 0.14], { name: 'toilet_skylleknap' });
      A('badevaerelse', 'tiles', [0.13, 3.2, 0.5], [0.66, 0.06, 0.74], { name: 'bruseniche_bund' });
      A('badevaerelse', 'glass', [-0.22, 3.78, 0.5], [0.04, 1.15, 0.74], { name: 'brusevaeg_a', shadow: false });
      A('badevaerelse', 'glass', [0.13, 3.78, 0.12], [0.66, 1.15, 0.04], { name: 'brusevaeg_b', shadow: false });
      C('badevaerelse', 'chrome', [0.3, 4.3, 0.5], 0.075, 0.04, 14, { name: 'brusehoved' });
      C('badevaerelse', 'chrome', [0.3, 4.12, 0.5], 0.016, 0.36, 8, { name: 'bruserarm' });
      [3.62, 3.8, 3.98].forEach((y, i) =>
        A('badevaerelse', 'chrome', [-0.84, y, 1.05], [0.05, 0.03, 0.42], { name: 'haandklaedetoerrer_' + i }));

      // bedroom
      A('inventar_moebler', 'wood', [-2.5, 3.42, 0.75], [1.62, 0.5, 2.0], { name: 'seng_ramme' });
      A('inventar_moebler', 'white', [-2.5, 3.74, 0.85], [1.5, 0.2, 1.8], { name: 'madras' });
      A('inventar_moebler', 'fabric', [-2.5, 3.86, 1.35], [1.45, 0.09, 0.8], { name: 'dyne' });
      [-2.85, -2.15].forEach((x, i) =>
        A('inventar_moebler', 'white', [x, 3.92, -0.02], [0.5, 0.16, 0.3], { name: 'pude' + i }));
      A('inventar_moebler', 'wood', [-3.35, 3.4, -0.15], [0.42, 0.46, 0.4], { name: 'natbord' });
      C('indvendig_belysning', 'lampWarm', [-3.35, 3.75, -0.15], 0.12, 0.16, 12, { r2: 0.07, name: 'natlampe' });
      // attic lounge (east, vaulted)
      A('inventar_moebler', 'rug', [1.5, F1 + 0.02, 0.9], [1.9, 0.03, 1.7], { name: 'taeppe_1sal', shadow: false });
      A('inventar_moebler', 'fabric', [1.55, 3.38, 0.45], [1.7, 0.4, 0.8], { name: 'sofa_1sal_saede' });
      A('inventar_moebler', 'fabric', [1.55, 3.7, 0.08], [1.7, 0.66, 0.22], { name: 'sofa_1sal_ryg' });
      A('inventar_moebler', 'wood', [1.55, 3.52, 1.45], [0.7, 0.05, 0.5], { name: 'sofabord_1sal' });
      C('indvendig_belysning', 'metal', [0.6, 3.85, 1.7], 0.03, 1.3, 8, { name: 'lampe_1sal_stang' });
      C('indvendig_belysning', 'lampWarm', [0.6, 4.58, 1.7], 0.15, 0.2, 12, { r2: 0.1, name: 'lampe_1sal_skaerm' });

      /* ---- roof, loft, solar ------------------------------------------ */
      const RIDGE_Y = 7.5, HALF = 2.375, RISE = RIDGE_Y - EAVE;
      const sl = Math.hypot(HALF, RISE), sa = Math.atan2(RISE, HALF), ratio = RISE / HALF;
      const RX0 = -3.95, RX1 = 2.7, rw = RX1 - RX0, rcx = (RX0 + RX1) / 2, roofY = (EAVE + RIDGE_Y) / 2;
      A('tag_og_skorsten', 'roof', [rcx, roofY, -HALF / 2], [rw, 0.2, sl], { rot: [-sa, 0, 0], name: 'tagflade_nord' });
      A('tag_og_skorsten', 'roof', [-2.075, roofY, HALF / 2], [3.75, 0.2, sl], { rot: [sa, 0, 0], name: 'tagflade_syd' });
      A('tag_og_skorsten', 'metal', [rcx, RIDGE_Y + 0.13, 0], [rw, 0.14, 0.34], { name: 'rygning' });
      A('tag_og_skorsten', 'frame', [rcx, EAVE - 0.1, -HALF - 0.03], [rw, 0.24, 0.12], { name: 'sternbraet_nord' });
      A('tag_og_skorsten', 'frame', [-2.075, EAVE - 0.1, HALF + 0.03], [3.75, 0.24, 0.12], { name: 'sternbraet_syd' });
      // gutters and downpipes (task: "Tagrender & nedløb")
      A('tagrender_nedloeb', 'steel', [rcx, EAVE - 0.3, -HALF - 0.1], [rw, 0.13, 0.17], { name: 'tagrende_nord' });
      A('tagrender_nedloeb', 'steel', [-2.075, EAVE - 0.3, HALF + 0.1], [3.75, 0.13, 0.17], { name: 'tagrende_syd' });
      [[-3.86, -HALF - 0.1], [2.61, -HALF - 0.1], [-3.86, HALF + 0.1]].forEach((p, i) => {
        C('tagrender_nedloeb', 'steel', [p[0], (EAVE - 0.36 + 0.1) / 2, p[1]], 0.052, EAVE - 0.46, 10, { name: 'nedloebsroer_' + i });
        A('tagrender_nedloeb', 'steel', [p[0], EAVE - 0.42, p[1]], [0.13, 0.14, 0.13], { name: 'nedloebstragt_' + i });
      });
      // roof vent (task: "Ventilationsanlæg")
      (() => {
        const z = -1.75, y = RIDGE_Y + z * ratio;
        C('ventilation_anlaeg', 'steel', [0.95, y + 0.26, z], 0.09, 0.5, 10, { name: 'ventilationshaette' });
        C('ventilation_anlaeg', 'metal', [0.95, y + 0.52, z], 0.16, 0.08, 12, { name: 'ventilationshat' });
      })();
      A('skorsten_aftraek', 'brick', [-1.25, 6.62, -0.5], [0.6, 2.7, 0.52], { name: 'skorsten' });
      A('skorsten_aftraek', 'metal', [-1.25, 8.03, -0.5], [0.76, 0.11, 0.68], { name: 'skorstenshat' });
      C('skorsten_aftraek', 'steel', [-1.25, 8.23, -0.5], 0.09, 0.3, 10, { name: 'aftraek' });

      const nr = 14;
      for (let i = 0; i < nr; i++) {
        const x = RX0 + 0.25 + i * ((rw - 0.5) / (nr - 1));
        A('loft_tagetage', 'wood', [x, roofY - 0.19, -HALF / 2], [0.09, 0.2, sl - 0.1], { rot: [-sa, 0, 0], name: 'spaer_nord_' + i });
        A('loft_tagetage', 'wood', [x, roofY - 0.19, HALF / 2], [0.09, 0.2, sl - 0.1], { rot: [sa, 0, 0], name: 'spaer_syd_' + i });
      }
      A('loft_tagetage', 'wood', [rcx, RIDGE_Y - 0.36, 0], [rw - 0.2, 0.34, 0.16], { name: 'aasbjaelke' });
      [-3.0, -1.6, 0.35, 1.85].forEach((x, i) =>
        A('loft_tagetage', 'wood', [x, 6.45, 0], [0.1, 0.16, 2.45], { name: 'hanebaand_' + i }));
      A('loft_tagetage', 'wood', [-2.05, EAVE + 0.15, 0], [3.5, 0.14, 3.9], { name: 'loftsdaek' });
      A('loft_tagetage', 'insulation', [-2.05, EAVE + 0.33, 0], [3.4, 0.22, 3.7], { name: 'isolering_loft' });
      [-HALF + 0.35, HALF - 0.35].forEach((z, i) =>
        A('baerende_bjaelker', 'wood', [rcx, EAVE + 0.08, z], [rw - 0.4, 0.16, 0.16], { name: 'rem_' + i }));
      (() => {
        const z = 1.25, y = RIDGE_Y - z * ratio;
        A('ovenlys_tagvinduer', 'frame', [-2.55, y + 0.13, z], [1.0, 0.1, 0.9], { rot: [sa, 0, 0], name: 'ovenlys_karm' });
        A('ovenlys_tagvinduer', 'glass', [-2.55, y + 0.2, z], [0.86, 0.05, 0.76], { rot: [sa, 0, 0], name: 'ovenlys_glas', shadow: false });
      })();
      [-2.6, -1.05].forEach((x, i) => {
        const z = -1.15, y = RIDGE_Y + z * ratio;
        A('solceller_energi', 'solar', [x, y + 0.15, z], [1.4, 0.06, 1.15], { rot: [-sa, 0, 0], name: 'solcellepanel_' + i });
      });
      (() => {
        const s2 = new T.Shape();
        s2.moveTo(-2.075, 0); s2.lineTo(2.075, 0); s2.lineTo(0, RISE); s2.closePath();
        const geo = new T.ExtrudeGeometry(s2, { depth: 0.22, bevelEnabled: false });
        geo.rotateY(-Math.PI / 2);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * this.fam.brick.density, uv.getY(i) * this.fam.brick.density);
        A('facade_overetage', 'brick', [-3.64, EAVE, 0], [0, 0, 0], { geo, name: 'gavltrekant_vest' });
      })();

      /* ---- garage + balcony ------------------------------------------- */
      const GX0 = 2.5, GX1 = 5.4, GZ0 = -1.6, GZ1 = 2.2;
      const gw = GX1 - GX0, gd = GZ1 - GZ0, gcx = (GX0 + GX1) / 2, gcz = (GZ0 + GZ1) / 2;
      A('garage_carport', 'concrete', [gcx, LOW + 0.06, gcz], [gw, 0.2, gd], { name: 'garagegulv' });
      A('garage_carport', 'brick', [gcx, -1.25, GZ0 + 0.11], [gw, 2.62, 0.22], { name: 'garagevaeg_nord' });
      A('garage_carport', 'brick', [GX1 - 0.11, -1.25, gcz], [0.22, 2.62, gd], { name: 'garagevaeg_ost' });
      A('garage_carport', 'brick', [GX0 + 0.11, -1.25, gcz], [0.22, 2.62, gd], { name: 'garagevaeg_vest' });
      A('garage_carport', 'brick', [GX1 - 0.5, -1.25, GZ1 - 0.11], [0.8, 2.62, 0.22], { name: 'garagevaeg_syd' });
      A('baerende_bjaelker', 'concrete', [GX0 + 0.55, 0.05, GZ1 - 0.11], [1.1, 0.6, 0.22], { name: 'portoverligger' });
      A('garage_carport', 'metal', [3.35, -0.42, GZ1 - 0.16], [1.55, 0.26, 0.14], { name: 'garageport_kasse' });
      A('garage_carport', 'metal', [3.35, -0.62, GZ1 - 0.16], [1.5, 0.16, 0.1], { name: 'garageport_lamel' });
      A('etagedaek_gulve', 'concrete', [gcx, 0.18, gcz], [gw, 0.34, gd], { name: 'garagedaek' });
      // car (static, decorative — parked nose-out in the garage)
      const cx = 3.62, cy0 = -2.28;
      A(null, 'car', [cx, cy0 + 0.42, 0.55], [1.82, 0.46, 3.9], { name: 'bil_underdel' });
      A(null, 'car', [cx, cy0 + 0.74, -0.62], [1.74, 0.26, 1.3], { name: 'bil_motorhjelm' });
      A(null, 'car', [cx, cy0 + 0.74, 1.75], [1.74, 0.28, 0.85], { name: 'bil_bagklap' });
      A(null, 'car', [cx, cy0 + 0.92, 0.62], [1.62, 0.44, 1.75], { name: 'bil_kabine' });
      A(null, 'car', [cx, cy0 + 1.14, 0.66], [1.5, 0.06, 1.5], { name: 'bil_tag' });
      A(null, 'glassDark', [cx, cy0 + 0.95, -0.32], [1.5, 0.42, 0.09], { name: 'bil_forrude', shadow: false });
      A(null, 'glassDark', [cx, cy0 + 0.95, 1.56], [1.46, 0.36, 0.09], { name: 'bil_bagrude', shadow: false });
      [-0.79, 0.79].forEach((dx, i) =>
        A(null, 'glassDark', [cx + dx, cy0 + 0.95, 0.66], [0.07, 0.34, 1.5], { name: 'bil_sidevindue_' + i, shadow: false }));
      A(null, 'metal', [cx, cy0 + 0.36, -1.42], [1.86, 0.22, 0.16], { name: 'bil_forkofanger' });
      A(null, 'metal', [cx, cy0 + 0.36, 2.52], [1.86, 0.22, 0.16], { name: 'bil_bagkofanger' });
      A(null, 'chrome', [cx, cy0 + 0.6, -1.44], [1.1, 0.14, 0.08], { name: 'bil_kølergitter' });
      [-0.58, 0.58].forEach((dx, i) => {
        A(null, 'headlight', [cx + dx, cy0 + 0.58, -1.46], [0.4, 0.13, 0.07], { name: 'bil_forlygte_' + i });
        A(null, 'taillight', [cx + dx, cy0 + 0.62, 2.54], [0.36, 0.12, 0.06], { name: 'bil_baglygte_' + i });
      });
      [-0.98, 0.98].forEach((dx, i) =>
        A(null, 'car', [cx + dx, cy0 + 0.92, -0.05], [0.2, 0.09, 0.11], { name: 'bil_sidespejl_' + i }));
      [[-0.86, -0.95], [0.86, -0.95], [-0.86, 1.95], [0.86, 1.95]].forEach((p, i) => {
        this._cyl(null, 'tyre', [cx + p[0], cy0 + 0.34, p[1]], 0.34, 0.22, 16, { rot: [0, 0, Math.PI / 2], name: 'bil_hjul_' + i });
        this._cyl(null, 'rim', [cx + p[0] * 1.06, cy0 + 0.34, p[1]], 0.19, 0.06, 14, { rot: [0, 0, Math.PI / 2], name: 'bil_faelg_' + i });
      });

      A(null, 'lampWarm', [3.5, -0.55, 1.9], [0.28, 0.08, 0.14], { name: 'garagelampe' });
      // slim the car down ~10 % across its width
      this.house.children.forEach((m) => {
        if (!/^bil_/.test(m.name)) return;
        m.position.x = cx + (m.position.x - cx) * 0.9;
        if (!/hjul|faelg/.test(m.name)) m.scale.x = 0.9;
      });

      // balcony / terrace over garage
      A('altan_balkon', 'deck', [gcx, FF - 0.03, gcz], [gw, 0.1, gd], { name: 'altandaek' });
      A('altan_balkon', 'concrete', [gcx, 0.14, GZ1 - 0.06], [gw, 0.28, 0.12], { name: 'altankant_syd' });
      A('altan_balkon', 'glass', [GX1 - 0.06, 0.9, gcz], [0.06, 1.05, gd - 0.2], { name: 'altanvaern_ost', shadow: false });
      A('altan_balkon', 'glass', [gcx, 0.9, GZ1 - 0.06], [gw - 0.2, 1.05, 0.06], { name: 'altanvaern_syd', shadow: false });
      A('altan_balkon', 'steel', [GX1 - 0.06, 1.44, gcz], [0.09, 0.08, gd - 0.2], { name: 'haandliste_ost' });
      A('altan_balkon', 'steel', [gcx, 1.44, GZ1 - 0.06], [gw - 0.2, 0.08, 0.09], { name: 'haandliste_syd' });
      [[GX1 - 0.18, GZ0 + 0.3], [GX1 - 0.18, GZ1 - 0.3], [GX0 + 0.3, GZ1 - 0.3]].forEach((p, i) =>
        A('pergola_solafskaermning', 'wood', [p[0], 1.53, p[1]], [0.13, 2.26, 0.13], { name: 'pergolastolpe_' + i }));
      A('pergola_solafskaermning', 'wood', [gcx, 2.72, GZ1 - 0.3], [gw - 0.3, 0.17, 0.11], { name: 'pergolabjaelke_syd' });
      A('pergola_solafskaermning', 'wood', [GX1 - 0.18, 2.72, gcz], [0.11, 0.17, gd - 0.5], { name: 'pergolabjaelke_ost' });
      for (let i = 0; i < 7; i++)
        A('pergola_solafskaermning', 'wood', [gcx, 2.84, GZ0 + 0.4 + i * 0.5], [gw - 0.2, 0.08, 0.07], { name: 'pergolaspaer_' + i });
      C('inventar_moebler', 'pot', [GX0 + 0.55, 0.62, GZ0 + 0.6], 0.24, 0.44, 12, { name: 'altanpotte' });
      B('inventar_moebler', 'leafDark', [GX0 + 0.55, 1.08, GZ0 + 0.6], 0.34, 1);
      A('inventar_moebler', 'fabric', [4.2, 0.62, GZ0 + 0.95], [1.4, 0.38, 0.75], { name: 'altansofa' });
      A('inventar_moebler', 'fabric', [4.2, 0.92, GZ0 + 0.62], [1.4, 0.6, 0.2], { name: 'altansofa_ryg' });
      A('inventar_moebler', 'wood', [4.2, 0.62, GZ0 + 1.95], [0.7, 0.05, 0.5], { name: 'altanbord' });

      /* ---- front terrace ---------------------------------------------- */
      A('terrasse_udendoers', 'deck', [-2.0, FF - 0.05, 2.55], [2.9, 0.1, 0.9], { name: 'terrassedaek' });
      A('terrasse_udendoers', 'wood', [-2.0, 0.18, 2.96], [2.9, 0.14, 0.12], { name: 'terrassekant' });
      [0.2, 0.05].forEach((y, i) =>
        A('terrasse_udendoers', 'deck', [-3.62, 0.22 - i * 0.16, 2.55], [0.44, 0.1, 0.9], { name: 'terrassetrin_' + i }));
      A('terrasse_udendoers', 'steel', [-2.0, 1.2, 2.98], [2.9, 0.07, 0.07], { name: 'terrassevaern_haandliste' });
      [-3.3, -2.35, -1.4, -0.65].forEach((x, i) =>
        A('terrasse_udendoers', 'steel', [x, 0.75, 2.98], [0.06, 1.0, 0.06], { name: 'vaernstolpe_' + i }));
      A('terrasse_udendoers', 'wood', [-0.85, 0.5, 2.6], [0.4, 0.4, 0.8], { name: 'terrassebaenk' });
      C('inventar_moebler', 'pot', [-1.4, 0.55, 2.72], 0.2, 0.34, 12, { name: 'terrassepotte' });
      B('inventar_moebler', 'leaf', [-1.4, 0.92, 2.72], 0.3, 1);

      /* ---- garden detail ----------------------------------------------- */
      // planting bed along the west facade
      A('beplantning', 'soilBed', [-4.08, 0.02, 1.05], [0.55, 0.2, 1.5], { name: 'blomsterbed' });
      A('beplantning', 'tiles', [-4.4, 0.03, 1.05], [0.14, 0.22, 1.5], { name: 'bedkant' });
      ['flowerA', 'flowerB', 'flowerC', 'flowerA', 'flowerB', 'flowerC', 'flowerA'].forEach((f, i) => {
        const z = 0.42 + i * 0.21;
        C('beplantning', 'leafDark', [-4.08, 0.2, z], 0.06, 0.28, 6, { name: 'staengel_' + i });
        B('beplantning', f, [-4.08, 0.42, z], 0.16, 0);
      });
      // hedge along the west boundary + low fence behind it
      for (let i = 0; i < 9; i++) {
        const z = -3.3 + i * 0.83;
        A('hegn_laage', 'wood', [-6.06, 0.42, z], [0.09, 0.85, 0.09], { name: 'hegnsstolpe_' + i });
      }
      [0.62, 0.28].forEach((y, i) =>
        A('hegn_laage', 'wood', [-6.06, y, -0.05], [0.06, 0.09, 7.0], { name: 'hegnsribbe_' + i }));
      // raised vegetable bed
      A('beplantning', 'wood', [-5.4, 0.16, 0.9], [1.5, 0.32, 1.0], { name: 'hoejbed' });
      A('beplantning', 'soilBed', [-5.4, 0.33, 0.9], [1.34, 0.06, 0.84], { name: 'hoejbed_jord' });
      [[-5.8, 0.65], [-5.4, 1.0], [-5.0, 0.7], [-5.6, 1.15], [-5.1, 1.15]].forEach((p, i) =>
        B('beplantning', 'leaf', [p[0], 0.44, p[1]], 0.17, 0));
      // garden bench under the tree
      A('beplantning', 'wood', [-5.55, 0.44, 1.5], [0.5, 0.07, 1.3], { name: 'havebaenk_saede' });
      A('beplantning', 'wood', [-5.78, 0.68, 1.5], [0.07, 0.45, 1.3], { name: 'havebaenk_ryg' });
      [1.0, 2.0].forEach((z, i) =>
        A('beplantning', 'wood', [-5.55, 0.24, z], [0.44, 0.34, 0.07], { name: 'havebaenk_ben_' + i }));
      // path lamps
      [[-4.62, 1.95], [-4.66, -1.35]].forEach((p, i) => {
        C('udebelysning', 'metal', [p[0], 0.48, p[1]], 0.045, 0.95, 8, { name: 'havelampe_stander_' + i });
        C('udebelysning', 'lampWarm', [p[0], 1.0, p[1]], 0.09, 0.14, 10, { name: 'havelampe_hoved_' + i });
      });
      // shrub row along the terrace edge + a second, smaller tree
      C('beplantning', 'bark', [-5.75, 0.85, 3.0], 0.13, 1.7, 8, { r2: 0.17, name: 'traestamme_2' });
      [[-5.75, 2.1, 3.0, 0.62], [-6.05, 1.85, 2.65, 0.4], [-5.35, 1.95, 3.25, 0.42]]
        .forEach((p) => B('beplantning', 'leaf', [p[0], p[1], p[2]], p[3], 1));

      // ventilation plant in the technical room
      A('ventilation_anlaeg', 'metal', [1.55, -1.95, -1.25], [0.72, 0.9, 0.5], { name: 'ventilationsanlaeg' });
      A('ventilation_anlaeg', 'steel', [1.55, -1.62, -1.02], [0.5, 0.08, 0.06], { name: 'ventilation_filterlaage' });
      [1.32, 1.78].forEach((x, i) =>
        C('ventilation_anlaeg', 'steel', [x, -1.1, -1.25], 0.075, 0.8, 10, { name: 'ventilationskanal_' + i }));
      C('ventilation_anlaeg', 'steel', [1.55, -0.75, -0.5], 0.075, 1.6, 10, { rot: [Math.PI / 2, 0, 0], name: 'ventilationskanal_vandret' });

      // heat pump outdoor unit on the west side
      A('fundament_sokkel', 'concrete', [-4.12, 0.06, -0.35], [0.7, 0.16, 0.85], { name: 'varmepumpe_sokkel' });
      A('varmepumpe_udedel', 'metal', [-4.12, 0.55, -0.35], [0.38, 0.82, 0.85], { name: 'varmepumpe_kabinet' });
      C('varmepumpe_udedel', 'steel', [-4.32, 0.6, -0.35], 0.28, 0.06, 16, { rot: [0, 0, Math.PI / 2], name: 'varmepumpe_ventilator' });
      [0.32, 0.58, 0.84].forEach((y, i) =>
        A('varmepumpe_udedel', 'steel', [-4.12, y, -0.79], [0.32, 0.03, 0.04], { name: 'varmepumpe_rist_' + i }));
      C('varmepumpe_udedel', 'steel', [-3.94, 0.5, -0.72], 0.045, 0.5, 8, { rot: [0, 0, 0.5], name: 'varmepumpe_roer' });

      // garden shed on the north lawn
      A('skure_udhus', 'deck', [-5.25, 0.06, -2.45], [1.8, 0.16, 1.1], { name: 'skur_gulv' });
      A('skure_udhus', 'wood', [-5.25, 1.0, -2.96], [1.8, 1.75, 0.1], { name: 'skur_bagvaeg' });
      A('skure_udhus', 'wood', [-6.1, 1.0, -2.45], [0.1, 1.75, 1.1], { name: 'skur_gavl_vest' });
      A('skure_udhus', 'wood', [-4.4, 1.0, -2.45], [0.1, 1.75, 1.1], { name: 'skur_gavl_ost' });
      A('skure_udhus', 'wood', [-5.78, 1.0, -1.95], [0.55, 1.75, 0.08], { name: 'skur_front' });
      A('skure_udhus', 'wood', [-4.92, 1.0, -1.95], [0.85, 1.75, 0.06], { name: 'skur_doer' });
      A('skure_udhus', 'steel', [-4.55, 1.0, -1.91], [0.06, 0.16, 0.04], { name: 'skur_greb' });
      A('skure_udhus', 'roof', [-5.25, 1.95, -2.45], [2.0, 0.1, 1.35], { rot: [0.22, 0, 0], name: 'skur_tag' });
      A('skure_udhus', 'frame', [-5.25, 1.86, -1.88], [2.0, 0.12, 0.08], { name: 'skur_sternbraet' });

      // rainwater: butt on the downpipe, soakaway lid on the lawn
      C('regnvand_faskine', 'metal', [-3.5, 0.42, 2.35], 0.3, 0.9, 14, { name: 'regnvandstoende' });
      C('regnvand_faskine', 'steel', [-3.5, 0.9, 2.35], 0.31, 0.05, 14, { name: 'regnvandstoende_laag' });
      C('regnvand_faskine', 'steel', [-3.68, 0.82, 2.35], 0.04, 0.4, 8, { rot: [0, 0, 1.15], name: 'regnvand_tilloeb' });
      C('regnvand_faskine', 'steel', [-3.5, 0.14, 2.35], 0.035, 0.3, 8, { name: 'regnvand_hane' });
      C('regnvand_faskine', 'concrete', [-4.55, 0.03, -0.4], 0.28, 0.1, 14, { name: 'faskine_daeksel' });
      C('regnvand_faskine', 'concrete', [2.05, 0.03, 2.2], 0.24, 0.1, 14, { name: 'rensebroend_daeksel' });

      /* ---- supply connections ------------------------------------------ */
      A('stikledninger_forsyning', 'hutGrey', [-3.98, 0.72, -0.55], [0.16, 0.85, 0.55], { name: 'maalerskab' });
      A('stikledninger_forsyning', 'frame', [-4.07, 0.72, -0.55], [0.03, 0.72, 0.44], { name: 'maalerskab_doer' });
      A('stikledninger_forsyning', 'signal', [-4.09, 0.95, -0.55], [0.02, 0.14, 0.2], { name: 'maalerskab_rude' });
      C('stikledninger_forsyning', 'concrete', [-5.62, 0.03, -1.5], 0.22, 0.1, 12, { name: 'vandmaalerbroend' });
      C('stikledninger_forsyning', 'concrete', [-5.25, 0.03, -0.55], 0.2, 0.1, 12, { name: 'stophane_daeksel' });
      A('stikledninger_forsyning', 'dirt', [-5.5, 0.02, -0.05], [1.0, 0.12, 0.28], { name: 'kabelgrav', shadow: false });
      A('stikledninger_forsyning', 'signal', [-6.02, 0.4, -0.05], [0.08, 0.8, 0.08], { name: 'markeringspael' });

      /* ---- scaffold on the west facade -------------------------------- */
      [-1.9, -1.3, -0.7, 0.1].forEach((z, i) => {
        [-4.4, -4.95].forEach((x, j) => {
          C('stillads_adgang', 'steel', [x, 2.85, z], 0.045, 5.7, 8, { name: 'stillads_spir_' + i + j });
        });
        A('stillads_adgang', 'steel', [-4.675, 2.62, z], [0.6, 0.05, 0.05], { name: 'stillads_tvaers_' + i });
      });
      [1.35, 2.62, 3.95, 5.25].forEach((y, i) => {
        [-4.4, -4.95].forEach((x, j) =>
          A('stillads_adgang', 'steel', [x, y, -0.9], [0.05, 0.05, 2.2], { name: 'stillads_laengde_' + i + j }));
      });
      [2.7, 4.03].forEach((y, i) => {
        A('stillads_adgang', 'deck', [-4.675, y, -0.9], [0.6, 0.06, 2.2], { name: 'stillads_daek_' + i });
        A('stillads_adgang', 'wood', [-4.965, y + 0.14, -0.9], [0.04, 0.22, 2.2], { name: 'stillads_fodliste_' + i });
        A('stillads_adgang', 'steel', [-4.955, y + 0.98, -0.9], [0.05, 0.05, 2.2], { name: 'stillads_haandliste_' + i });
      });
      for (let i = 0; i < 9; i++) {
        A('stillads_adgang', 'steel', [-4.675, 0.35 + i * 0.3, 0.42], [0.5, 0.04, 0.04], { name: 'stige_trin_' + i });
      }
      [-4.475, -4.875].forEach((x, i) =>
        C('stillads_adgang', 'steel', [x, 1.6, 0.42], 0.035, 3.2, 8, { name: 'stige_vange_' + i }));

      /* ---- BygSmart.com artwork, shared by the site board and the hut --- */
      const logoMat = (() => {
        const c = cv(512); c.height = 128;
        const x = c.getContext('2d');
        x.fillStyle = '#0f172a'; x.fillRect(0, 0, 512, 128);
        x.fillStyle = '#2563eb';
        x.beginPath(); x.roundRect(20, 30, 68, 68, 19); x.fill();
        x.fillStyle = '#ffffff'; x.textBaseline = 'middle';
        x.font = '700 50px "Segoe UI", system-ui, sans-serif';
        x.fillText('B', 38, 65);
        x.font = '700 46px "Segoe UI", system-ui, sans-serif';
        const wordX = 104, wordW = x.measureText('BygSmart').width;   // measured with THIS font active
        x.fillText('BygSmart', wordX, 62);
        x.fillStyle = '#93c5fd';
        x.font = '600 30px "Segoe UI", system-ui, sans-serif';
        x.fillText('.com', wordX + wordW + 4, 66);
        const t = new T.CanvasTexture(c);
        t.colorSpace = T.SRGBColorSpace;
        t.anisotropy = Math.min(this.P.aniso, this.renderer.capabilities.getMaxAnisotropy());
        return new T.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.05 });
      })();

      const textSign = (label) => {
        const c = cv(512); c.height = 128;
        const x = c.getContext('2d');
        x.fillStyle = '#111b2b'; x.fillRect(0, 0, 512, 128);
        x.strokeStyle = '#eab308'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 118);
        x.fillStyle = '#f8fafc'; x.textBaseline = 'middle'; x.textAlign = 'center';
        x.font = '700 58px "Segoe UI", system-ui, sans-serif';
        x.fillText(label, 256, 66);
        const t = new T.CanvasTexture(c);
        t.colorSpace = T.SRGBColorSpace;
        t.anisotropy = Math.min(this.P.aniso, this.renderer.capabilities.getMaxAnisotropy());
        return new T.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.05 });
      };

      /* ---- site fence, hut and material stack ------------------------- */
      for (let i = 0; i < 3; i++) {
        const x = -4.6 + i * 0.72;
        A('byggepladshegn', 'steel', [x, 0.88, 3.05], [0.66, 1.7, 0.05], { name: 'hegnspanel_' + i });
        A('byggepladshegn', 'steel', [x - 0.34, 0.88, 3.05], [0.06, 1.7, 0.09], { name: 'hegnsfod_' + i });
      }
      A('byggepladshegn', 'hutGrey', [-3.88, 1.3, 3.092], [1.4, 0.4, 0.03], { material: logoMat, name: 'byggeplads_skilt' });
      A('byggepladshegn', 'hutGrey', [-4.6, 0.78, 3.092], [0.62, 0.28, 0.03], { material: textSign('Byggepladshegn'), name: 'hegnsskilt' });
      A('skurvogn_materialer', 'hutGrey', [4.55, -1.675, -2.55], [2.2, 2.05, 0.78], { name: 'skurvogn' });
      A('skurvogn_materialer', 'frame', [3.85, -1.79, -2.14], [0.7, 1.8, 0.06], { name: 'skurvogn_doer' });
      A('skurvogn_materialer', 'glassDark', [5.25, -1.37, -2.14], [0.7, 0.5, 0.05], { name: 'skurvogn_vindue', shadow: false });
      A('skurvogn_materialer', 'steel', [3.85, -2.63, -2.02], [0.8, 0.16, 0.22], { name: 'skurvogn_trappe' });
      A('skurvogn_materialer', 'wood', [5.25, -2.58, -1.95], [0.8, 0.25, 0.58], { name: 'palle_1' });
      A('skurvogn_materialer', 'brick', [5.25, -2.3, -1.95], [0.76, 0.35, 0.52], { name: 'stak_tegl' });
      A('skurvogn_materialer', 'insulation', [5.25, -1.96, -1.95], [0.8, 0.35, 0.55], { name: 'stak_isolering' });

      A('skurvogn_materialer', 'hutGrey', [4.55, -1.28, -2.145], [1.5, 0.38, 0.03], { material: logoMat, name: 'skurvogn_logo' });

      /* ---- waste, demolition, remediation ----------------------------- */
      A('container_affald', 'skipSteel', [5.2, -1.955, 2.6], [0.75, 0.95, 1.0], { name: 'affaldscontainer' });
      A('container_affald', 'skipSteel', [5.2, -1.5, 2.6], [0.7, 0.16, 0.95], { name: 'container_kant' });
      A('container_affald', 'signal', [5.2, -1.955, 3.09], [0.5, 0.3, 0.04], { name: 'container_maerkat' });
      A('container_affald', 'dark', [5.2, -1.62, 2.6], [0.6, 0.12, 0.8], { name: 'container_indhold', shadow: false });
      [[5.2, 4.55], [5.2, 5.05]].forEach((p, i) => {
        A('sortering_genbrug', 'hutGrey', [p[0], -2.12, p[1]], [0.42, 0.62, 0.42], { name: 'affaldsbeholder_' + i });
        A('sortering_genbrug', 'signal', [p[0], -1.81, p[1]], [0.44, 0.05, 0.44], { name: 'beholder_laag_' + i });
      });
      A('sortering_genbrug', 'bagWhite', [5.2, -2.03, 4.05], [0.68, 0.8, 0.68], { name: 'big_bag' });
      A('nedrivning_indvendig', 'sheet', [-0.55, -1.35, 1.9], [1.5, 2.2, 0.04], { name: 'stoevvaeg_plast', shadow: false });
      A('nedrivning_indvendig', 'concrete', [-1.35, -2.25, 1.55], [1.0, 0.42, 0.8], { name: 'nedrivningsaffald' });
      A('nedrivning_indvendig', 'metal', [-0.45, -2.25, 1.75], [0.48, 0.4, 0.7], { name: 'trilleboer' });
      C('nedrivning_indvendig', 'tyre', [-0.45, -2.4, 1.42], 0.14, 0.08, 12, { rot: [0, 0, Math.PI / 2], name: 'trilleboer_hjul' });
      A('asbest_miljosanering', 'bagWhite', [5.2, -2.18, 3.45], [0.68, 0.5, 0.46], { name: 'asbestsaek_1' });
      A('asbest_miljosanering', 'bagWhite', [5.2, -1.83, 3.45], [0.55, 0.3, 0.38], { name: 'asbestsaek_2' });
      A('asbest_miljosanering', 'hazard', [5.2, -1.3, 3.2], [0.42, 0.3, 0.03], { name: 'advarselsskilt' });
      C('asbest_miljosanering', 'steel', [5.2, -1.8, 3.2], 0.025, 0.7, 8, { name: 'skiltestander' });
      B('bortkoersel_jord', 'dirt', [2.95, -2.5, -2.45], 0.34, 1);
      B('bortkoersel_jord', 'dirt', [2.98, -2.58, -2.95], 0.3, 1);
      A('bortkoersel_jord', 'sheet', [2.95, -2.28, -2.6], [0.8, 0.05, 0.8], { name: 'jorddaekning', shadow: false });

      // EV charging
      A('ladestander_elbil', 'metal', [5.05, -1.25, 2.02], [0.26, 0.42, 0.16], { name: 'ladeboks' });
      A('ladestander_elbil', 'lampWarm', [5.05, -1.12, 1.93], [0.12, 0.03, 0.02], { name: 'ladeboks_status' });
      C('ladestander_elbil', 'dark', [5.05, -1.55, 1.94], 0.035, 0.5, 8, { rot: [0.35, 0, 0], name: 'ladekabel' });
      A('ladestander_elbil', 'metal', [4.7, -2.0, 2.5], [0.16, 1.1, 0.16], { name: 'ladestander' });
      A('ladestander_elbil', 'lampWarm', [4.7, -1.62, 2.41], [0.08, 0.14, 0.02], { name: 'ladestander_display' });
      A('ladestander_elbil', 'steel', [4.7, -2.5, 2.5], [0.26, 0.1, 0.26], { name: 'ladestander_fod' });

      // exterior wall lamps
      A('udebelysning', 'lampWarm', [HX1 - 0.02, 1.9, -1.5], [0.1, 0.2, 0.16], { name: 'udelampe_ost' });
      A('udebelysning', 'lampWarm', [-0.2, -1.1, HZ1 - 0.02], [0.16, 0.2, 0.1], { name: 'kaelderlampe' });
    }

    _computeAnchors() {
      const T = this.T;
      Object.keys(this.byZone).forEach((z) => {
        const box = new T.Box3();
        this.byZone[z].forEach((m) => box.expandByObject(m));
        const c = new T.Vector3();
        box.getCenter(c);
        this.anchors[z] = c;
      });
    }

    /* --------------------------------------------------------- selection */
    setSelected(ids) {
      this._selected = new Set(ids || []);
      this._applyState();
      this.invalidate();
    }

    setHover(zoneId) {
      if (this._hover === zoneId) return;
      this._hover = zoneId || null;
      this._applyState();
      this.invalidate();
    }

    _applyState() {
      const T = this.T;
      Object.keys(this.byZone).forEach((zone) => {
        const sel = this._selected.has(zone), hov = this._hover === zone;
        const col = new T.Color(ZONES[zone] ? ZONES[zone].color : '#60a5fa');
        this.byZone[zone].forEach((m) => {
          const mat = m.material;
          if (!mat.emissive) return;
          if (sel) {
            mat.emissive.copy(col); mat.emissiveIntensity = hov ? 0.2 : 0.13;
          } else if (hov) {
            mat.emissive.copy(col); mat.emissiveIntensity = 0.06;
          } else {
            mat.emissive.setRGB(0, 0, 0); mat.emissiveIntensity = 0;
          }
          if (sel && !m.userData.edges) {
            const e = new T.LineSegments(new T.EdgesGeometry(m.geometry, 25), this._edgeMat);
            e.raycast = () => {};
            m.add(e);
            m.userData.edges = e;
          }
          if (m.userData.edges) m.userData.edges.visible = sel;
        });
      });
    }

    /* ------------------------------------------------------------ marker */
    flashMarker(zoneId, screen) {
      const a = this.anchors[zoneId];
      if (!a) return;
      if (this._marker) this._marker.remove();
      const el = document.createElement('div');
      el.textContent = 'valgt';
      el.style.cssText = 'position:absolute;transform:translate(-50%,-140%);padding:4px 9px;border-radius:999px;' +
        'background:rgba(37,99,235,0.94);color:#fff;font:600 11px/1 Inter,system-ui,sans-serif;' +
        'letter-spacing:0.06em;text-transform:uppercase;opacity:0;transition:opacity 180ms ease;' +
        'box-shadow:0 6px 18px rgba(9,17,29,0.6)';
      this._overlay.appendChild(el);
      this._marker = el;
      this._markerAnchor = a.clone();
      setTimeout(() => { el.style.opacity = '1'; this.invalidate(); }, 20);
      clearTimeout(this._markerT1); clearTimeout(this._markerT2);
      this._markerT1 = setTimeout(() => { el.style.opacity = '0'; }, 4820);
      this._markerT2 = setTimeout(() => { el.remove(); if (this._marker === el) { this._marker = null; } }, 5000);
    }

    /* ------------------------------------------------------------- input */
    _bindInput() {
      const el = this;
      let dragging = false, panning = false, moved = 0, lastX = 0, lastY = 0;
      let pinch = null, twoFinger = null;
      const clampR = (r) => Math.max(this.rMin || 13, Math.min(this.rMax || 30, r));
      const rotate = (dx, dy) => {
        this.sphTo.theta -= dx * 0.0055;
        this.sphTo.phi = Math.max(this.insideRoom ? 0.75 : (this.stageMode === 'plan' ? 0.08 : 0.62),
          Math.min(this.insideRoom ? 2.4 : 1.46, this.sphTo.phi - dy * 0.004));
        this.invalidate(3);
      };
      const pan = (dx, dy) => {
        const s2 = Math.max(0.004, (this.sph.r || 20) * 0.0016);
        const right = new this.T.Vector3().subVectors(this.camera.position, this.target)
          .cross(new this.T.Vector3(0, 1, 0)).normalize();
        this.targetTo.addScaledVector(right, -dx * s2);
        this.targetTo.y = Math.max(-3.2, Math.min(8, this.targetTo.y + dy * s2));
        this.targetTo.x = Math.max(-8, Math.min(8, this.targetTo.x));
        this.targetTo.z = Math.max(-8, Math.min(8, this.targetTo.z));
        this.invalidate(3);
      };
      const clearPress = () => { clearTimeout(this._pressT); this._pressT = null; };

      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('pointerdown', (e) => {
        dragging = true;
        panning = e.button === 2 || e.button === 1 || this.viewMode === 'pan';
        moved = 0; lastX = e.clientX; lastY = e.clientY;
        this._autoRotate = false;
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
        el.style.cursor = panning ? 'move' : 'grabbing';
        if (!panning && e.button === 0) {
          clearPress();
          this._pressT = setTimeout(() => {
            this._pressT = null;
            if (moved <= 5) this._offerRoom(e);
          }, 480);
        }
      });
      el.addEventListener('pointermove', (e) => {
        if (dragging) {
          const dx = e.clientX - lastX, dy = e.clientY - lastY;
          moved += Math.abs(dx) + Math.abs(dy);
          lastX = e.clientX; lastY = e.clientY;
          if (moved > 5) clearPress();
          if (panning) pan(dx, dy); else rotate(dx, dy);
          return;
        }
        this._pick(e, false);
      });
      el.addEventListener('pointerup', (e) => {
        clearPress();
        dragging = false;
        el.style.cursor = 'grab';
        if (moved <= 4 && !panning) this._pick(e, true);
      });
      el.addEventListener('pointercancel', () => { clearPress(); dragging = false; });
      el.addEventListener('pointerleave', () => {
        clearPress();
        this.setHover(null);
        window.dispatchEvent(new CustomEvent('housestage:hover', { detail: { zoneId: null, x: 0, y: 0 } }));
      });
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.sphTo.r = clampR(this.sphTo.r * (1 + Math.sign(e.deltaY) * 0.06));
        this.invalidate(3);
      }, { passive: false });
      el.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          clearPress();
          dragging = false;
          const a = e.touches[0], b = e.touches[1];
          pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
          twoFinger = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        }
      }, { passive: true });
      el.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinch) {
          const a = e.touches[0], b = e.touches[1];
          const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
          if (!this.insideRoom && Math.abs(d - pinch.d) > 2) this.sphTo.r = clampR(this.sphTo.r * (pinch.d / d));
          pan(mx - twoFinger.x, my - twoFinger.y);      // two fingers slide in 2D
          pinch.d = d; twoFinger = { x: mx, y: my };
        }
      }, { passive: true });
      el.addEventListener('touchend', () => { pinch = null; twoFinger = null; });
    }

    /* long press: offer to step inside the nearest room */
    _offerRoom(e) {
      const rect = this.getBoundingClientRect();
      this._pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const hit = this._raycaster.intersectObjects(this.house.children, false)[0];
      if (!hit || !this.rooms) return;
      let best = -1, bestD = Infinity;
      this.rooms.forEach((r, i) => {
        const d = hit.point.distanceToSquared(new this.T.Vector3(r.p[0], r.p[1], r.p[2]));
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best < 0) return;
      window.dispatchEvent(new CustomEvent('housestage:longpress', {
        detail: { index: best, room: this.rooms[best].t, x: e.clientX, y: e.clientY }
      }));
    }

    _announceRoom(index) {
      const r = this.insideRoom;
      window.dispatchEvent(new CustomEvent('housestage:room', {
        detail: r ? { room: r.t, index: index == null ? -1 : index } : null
      }));
    }

    enterRoom(index) {
      const r = this.rooms && this.rooms[index];
      if (!r) return;
      const FLOOR = { kaelder: -2.45, stue: 0.35, etage1: 3.15 };
      const K = this.K || 1;
      const eyeY = (FLOOR[r.lvl] != null ? FLOOR[r.lvl] : 0.35) + 1.5;
      // stand on the room's own open edge and look in along that axis
      const e = r.edge || { axis: 'z', at: 2.9 };
      const along = e.axis === 'x' ? r.p[0] : r.p[2];
      const dir = e.dir != null ? e.dir : (e.at >= along ? 1 : -1);
      const dist = Math.max(0.9, Math.abs(e.at - along) * K + 1.6);   // step back from the edge
      const theta = e.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      this.insideRoom = r;
      this.eye = null;                                   // orbit rig, so zoom works
      this.rMin = 0.7;
      this.rMax = dist + 8;
      this.sphTo = { r: dist, theta: theta, phi: 1.57 };
      this.sph = { r: dist, theta: theta, phi: 1.57 };
      this.targetTo.set(r.p[0] * K, eyeY, r.p[2] * K);
      this.target.copy(this.targetTo);
      if (this.camera) {
        const area = r.a || 10;
        this.camera.fov = area <= 4 ? 58 : (area <= 8 ? 52 : 46);
        this.camera.updateProjectionMatrix();
      }
      this._applyVisibility();
      this._syncRoomLabels();
      this._announceRoom(index);
      this.invalidate(3);
    }

    exitRoom() {
      this.insideRoom = null;
      this.eye = null;
      if (this.camera && this.camera.fov !== 38) { this.camera.fov = 38; this.camera.updateProjectionMatrix(); }
      this.rMin = this.exteriorRMin || 13; this.rMax = this.exteriorRMax || 30;
      const h = this.HOME;
      this.sphTo = { r: h.r, theta: h.theta, phi: h.phi };
      this.targetTo.set(h.t[0], h.t[1], h.t[2]);
      this._applyVisibility();
      this._syncRoomLabels();
      this._announceRoom(null);
      this.invalidate(3);
    }

    _pick(e, isClick) {
      const rect = this.getBoundingClientRect();
      this._pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const hit = this._raycaster.intersectObjects(this.pickables, false)[0];
      const zoneId = hit ? hit.object.userData.zoneId : null;
      if (!isClick) {
        this.setHover(zoneId);
        this.style.cursor = zoneId ? 'pointer' : 'grab';
        window.dispatchEvent(new CustomEvent('housestage:hover', {
          detail: { zoneId, x: e.clientX, y: e.clientY }
        }));
        return;
      }
      if (!zoneId) return;
      this._markerAnchor = hit.point.clone();
      this.flashMarker(zoneId);
      this._markerAnchor = hit.point.clone();
      window.dispatchEvent(new CustomEvent('housestage:toggle', { detail: { zoneId, x: e.clientX, y: e.clientY } }));
    }

    /* ------------------------------------------------------------ camera */
    _applyCamera() {
      const s = this.sph;
      if (this.insideRoom && this.eye) {
        const sinP = Math.sin(s.phi);
        this.camera.position.copy(this.eye);
        this.camera.lookAt(
          this.eye.x + sinP * Math.sin(s.theta),
          this.eye.y + Math.cos(s.phi),
          this.eye.z + sinP * Math.cos(s.theta)
        );
        return;
      }
      const sinP = Math.sin(s.phi);
      this.camera.position.set(
        this.target.x + s.r * sinP * Math.sin(s.theta),
        this.target.y + s.r * Math.cos(s.phi),
        this.target.z + s.r * sinP * Math.cos(s.theta)
      );
      this.camera.lookAt(this.target);
    }

    resetView() {
      if (this.insideRoom) { this.exitRoom(); return; }   // exitRoom announces
      if (this.stageMode === 'plan') { this.setStageMode('plan', this.level); return; }
      const h = this.HOME;
      this.sphTo = { r: h.r, theta: h.theta, phi: h.phi };
      this.targetTo.set(h.t[0], h.t[1], h.t[2]);
    }

    /* plan ("3D plantegning") mode: roof off, one level at a time, seen from above */
    setStageMode(mode, level) {
      const wasInside = !!this.insideRoom;
      this.insideRoom = null;
      this.eye = null;
      if (wasInside && this.camera && this.camera.fov !== 38) { this.camera.fov = 38; this.camera.updateProjectionMatrix(); }
      this.rMin = this.exteriorRMin || 13; this.rMax = this.exteriorRMax || 30;
      if (wasInside) this._announceRoom(null);
      this.stageMode = mode === 'plan' ? 'plan' : 'udvendig';
      if (level) this.level = level;
      if (this.stageMode === 'plan') {
        const p = this.PLAN[this.level] || this.PLAN.stue;
        this.sphTo = { r: p.r, theta: 0.02, phi: p.phi };
        this.targetTo.set(p.t[0], p.t[1], p.t[2]);
      } else {
        const h = this.HOME;
        this.sphTo = { r: h.r, theta: h.theta, phi: h.phi };
        this.targetTo.set(h.t[0], h.t[1], h.t[2]);
      }
      this._applyVisibility();
      this._syncRoomLabels();
      this.invalidate();
    }

    _classify() {
      const T = this.T, box = new T.Box3();
      const roofZones = { tag_og_skorsten: 1, loft_tagetage: 1, solceller_energi: 1 };
      const siteZones = { have_hegn: 1, indkoersel_belaegning: 1, fundament_sokkel: 1 };
      this.house.children.forEach((m) => {
        if (!m.isMesh) return;
        const z = m.userData.zoneId;
        box.setFromObject(m);
        const cy = (box.min.y + box.max.y) / 2;
        let lvl;
        if (roofZones[z]) lvl = 'tag';
        else if (siteZones[z] || /terraen|stoettemur/.test(m.name)) lvl = 'site';
        else if (cy < 0.15) lvl = 'kaelder';
        else if (cy < 3.05) lvl = 'stue';
        else if (cy < 5.5) lvl = 'etage1';
        else lvl = 'tag';
        m.userData.level = lvl;
        m.userData.cy = cy;
        m.userData.by = box.min.y;
        m.userData.layer = this._layerOf(m, z);
        m.userData.cutVis = {
          kaelder: box.min.y <= -0.9,
          stue: box.min.y <= 1.9,
          etage1: box.min.y <= 4.7
        };
      });
    }

    _mergeBatches() {
      const T = this.T;
      const groups = new Map();
      this.house.children.slice().forEach(function (m) {
        if (!m.isMesh) return;
        const u = m.userData;
        const key = [u.zoneId || '-', m.material.uuid, u.level, u.layer, m.castShadow ? 1 : 0,
          u.cutVis.kaelder ? 1 : 0, u.cutVis.stue ? 1 : 0, u.cutVis.etage1 ? 1 : 0].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
      });
      this.house.updateMatrixWorld(true);
      const merged = [];
      groups.forEach(function (list) {
        if (list.length < 2) { merged.push(list[0]); return; }
        const pos = [], nor = [], uvs = [];
        list.forEach(function (m) {
          const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
          g.applyMatrix4(m.matrixWorld);
          const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
          for (let i = 0; i < p.count; i++) {
            pos.push(p.getX(i), p.getY(i), p.getZ(i));
            if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i));
            if (t) uvs.push(t.getX(i), t.getY(i));
          }
          g.dispose();
        });
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        if (nor.length) geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
        if (uvs.length) geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        const first = list[0];
        const mesh = new T.Mesh(geo, first.material);
        mesh.castShadow = first.castShadow;
        mesh.receiveShadow = true;
        mesh.name = (first.userData.zoneId || first.name || 'batch') + '_batch';
        mesh.userData = Object.assign({}, first.userData);
        mesh.userData.batchOf = list.length;
        merged.push(mesh);
      });
      this.house.clear();
      this.byZone = {};
      this.pickables.length = 0;
      const self = this;
      merged.forEach(function (m) {
        self.house.add(m);
        const z = m.userData.zoneId;
        if (z) {
          self.pickables.push(m);
          (self.byZone[z] || (self.byZone[z] = [])).push(m);
        }
      });
    }

    _layerOf(m, zone) {
      const LZ = {
        have_hegn: 'terraen', indkoersel_belaegning: 'terraen',
        fundament_sokkel: 'fundament', kaelder_udvendig: 'fundament',
        loft_tagetage: 'konstruktion',
        tag_og_skorsten: 'klimaskaerm', facade_overetage: 'klimaskaerm', facade_stueetage: 'klimaskaerm',
        vinduer_overetage: 'klimaskaerm', vinduer_doere_stueetage: 'klimaskaerm',
        altan_balkon: 'tilbygning', garage_carport: 'tilbygning', terrasse_udendoers: 'tilbygning',
        solceller_energi: 'installationer', kloak_forsyning: 'installationer', ladestander_elbil: 'installationer',
        inventar_moebler: 'inventar',
        skorsten_aftraek: 'klimaskaerm', tagrender_nedloeb: 'klimaskaerm', ovenlys_tagvinduer: 'klimaskaerm',
        pergola_solafskaermning: 'tilbygning', hegn_laage: 'terraen', beplantning: 'terraen',
        udebelysning: 'installationer', ventilation_anlaeg: 'installationer', varme_vvs: 'installationer',
        koekken: 'inventar', badevaerelse: 'inventar', trapper_indvendig: 'inventar',
        graesplaene: 'terraen', haek_levende: 'terraen', stier_traedesten: 'terraen',
        indvendige_vaegge: 'inventar', etagedaek_gulve: 'konstruktion', skabe_garderobe: 'inventar',
        hvidevarer: 'inventar', indvendig_belysning: 'installationer', skure_udhus: 'tilbygning',
        regnvand_faskine: 'installationer', varmepumpe_udedel: 'installationer',
        baerende_bjaelker: 'konstruktion', soejler_baerende: 'konstruktion',
        el_installation: 'installationer', stikledninger_forsyning: 'installationer',
        stillads_adgang: 'byggeplads', byggepladshegn: 'byggeplads', skurvogn_materialer: 'byggeplads',
        container_affald: 'byggeplads', sortering_genbrug: 'byggeplads', nedrivning_indvendig: 'byggeplads',
        asbest_miljosanering: 'byggeplads', bortkoersel_jord: 'byggeplads'
      };
      const n = m.name || '';
      if (/isolering/.test(n)) return 'klimaskaerm';
      if (zone) return LZ[zone] || 'konstruktion';
      if (/terraen|stoettemur/.test(n)) return 'terraen';
      if (/skillevaeg|trappevaeg|bil_/.test(n)) return 'inventar';
      return 'konstruktion';
    }

    setLayer(layer) {
      this.layer = layer || 'alle';
      this._applyVisibility();
      this.invalidate();
    }

    _syncRoomLabels() {
      if (this._roomEls) this._roomEls.forEach((o) => o.el.remove());
      this._roomEls = [];
      if (this.stageMode !== 'plan' || !this.rooms) return;
      this.rooms.filter((r) => r.lvl === this.level).forEach((r) => {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);padding:4px 10px 5px;border-radius:8px;' +
          'background:rgba(8,16,28,0.74);border:1px solid rgba(148,180,220,0.16);color:#dce8f6;' +
          'font:600 11.5px/1.25 "Segoe UI",system-ui,sans-serif;letter-spacing:0.03em;white-space:nowrap;' +
          'text-align:center;box-shadow:0 4px 14px rgba(4,10,18,0.5)';
        el.appendChild(document.createTextNode(r.t));
        if (r.a) {
          const sub = document.createElement('div');
          sub.textContent = r.a + ' m²';
          sub.style.cssText = 'font-weight:500;font-size:10px;color:#8ba2bd;margin-top:2px';
          el.appendChild(sub);
        }
        this._overlay.appendChild(el);
        this._roomEls.push({ el, v: new this.T.Vector3(r.p[0] * this.K, r.p[1], r.p[2] * this.K) });
      });
    }

    _applyVisibility() {
      const order = { kaelder: 0, stue: 1, etage1: 2 };
      const floorY = { kaelder: -2.45, stue: 0.35, etage1: 3.15 };
      const plan = this.stageMode === 'plan';
      const inside = !!this.insideRoom;
      const max = order[this.level] != null ? order[this.level] : 1;
      const base = floorY[this.level] != null ? floorY[this.level] : 0.35;
      const siteMax = base + 3.4;
      const cut = base + 1.55;   // plan cut height, like a real floor plan
      this.pickables.length = 0;
      this.house.children.forEach((m) => {
        if (!m.isMesh) return;
        const lvl = m.userData.level;
        const lay = this.layer && this.layer !== 'alle'
          ? (m.userData.layer === this.layer || m.userData.layer === 'terraen') : true;
        const vis = !lay ? false
          : inside ? lvl !== 'tag'
          : !plan ? true
          : lvl === 'site' ? m.userData.cy <= siteMax
          : m.userData.cutVis[this.level] === false ? false
            : lvl === 'tag' ? false
              : order[lvl] <= max;
        m.visible = vis;
        if (vis && m.userData.zoneId) this.pickables.push(m);
      });
      if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
      this.invalidate();
    }

    setAutoRotate(v) { this._autoRotate = !!v; this.invalidate(); }
    setViewMode(m) {
      this.viewMode = m;
      if (this._grid) this._grid.visible = m === 'grid';
      this.invalidate();
    }

    setQuality(q) {
      if ((q !== 'hoj' && q !== 'mobil') || q === this.quality) return;
      try { localStorage.setItem(QKEY, q); } catch (e) { /* private mode */ }
      this.quality = q;
      const keep = {
        selected: Array.from(this._selected || []), hover: this._hover,
        mode: this.stageMode, level: this.level, layer: this.layer,
        light: this._lightMode || 'nat', sph: Object.assign({}, this.sphTo), target: this.targetTo.clone()
      };
      this._teardown();
      this._boot().then(() => {
        this.setLighting(keep.light);
        this.setLayer(keep.layer);
        this.setStageMode(keep.mode, keep.level);
        this.setSelected(keep.selected);
        this.setHover(keep.hover);
        this.sphTo = keep.sph;
        this.sph = Object.assign({}, keep.sph);
        this.targetTo.copy(keep.target);
        this.target.copy(keep.target);
        this.invalidate(3);
      });
    }

    _teardown() {
      if (this._ro) this._ro.disconnect();
      if (this.renderer) {
        this.renderer.setAnimationLoop(null);
        if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        this.renderer.dispose();
      }
      if (this._overlay) this._overlay.innerHTML = '';
      this._marker = null;
      this._roomEls = [];
      this.renderer = null;
      this.scene = null;
      this._matCache = null;
      this._geoCache = null;
    }

    _resize() {
      const w = this.clientWidth, h = this.clientHeight;
      if (!w || !h || !this.renderer) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.invalidate(3);
    }

    invalidate(n) { this._needs = Math.max(this._needs || 0, n || 2); }

    _frame() {
      const dt = Math.min(this._clock.getDelta(), 0.05);
      if (this._autoRotate) this.sphTo.theta += 0.28 * 0.65 * dt;
      const settled = Math.abs(this.sphTo.r - this.sph.r) < 0.002 &&
        Math.abs(this.sphTo.theta - this.sph.theta) < 0.0004 &&
        Math.abs(this.sphTo.phi - this.sph.phi) < 0.0004 &&
        this.target.distanceToSquared(this.targetTo) < 1e-6;
      this.sph.r += (this.sphTo.r - this.sph.r) * 0.12;
      this.sph.theta += (this.sphTo.theta - this.sph.theta) * 0.14;
      this.sph.phi += (this.sphTo.phi - this.sph.phi) * 0.14;
      this.target.lerp(this.targetTo, 0.11);
      this._applyCamera();
      this._skyFrame(dt);
      if (this._bd) {
        const cam = this.camera, T2 = this.T, D = 120;
        const fwd = new T2.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        this._bd.position.copy(cam.position).addScaledVector(fwd, D);
        this._bd.quaternion.copy(cam.quaternion);
        const hh = 2 * D * Math.tan((cam.fov * Math.PI / 180) / 2) * 1.04;
        this._bd.scale.set(hh * cam.aspect, hh, 1);
      }
      // static scene: only draw when something actually changed
      const busy = this._autoRotate || !settled || !!this._marker || (this._shoot && this._shoot.active);
      if (!busy && (this._needs || 0) <= 0) return;
      this._needs = busy ? 1 : (this._needs || 1) - 1;
      if (this._roomEls && this._roomEls.length) {
        const rr = this.getBoundingClientRect();
        this._roomEls.forEach((o) => {
          const p = o.v.clone().project(this.camera);
          o.el.style.left = ((p.x * 0.5 + 0.5) * rr.width) + 'px';
          o.el.style.top = ((-p.y * 0.5 + 0.5) * rr.height) + 'px';
        });
      }
      if (this._marker && this._markerAnchor) {
        const p = this._markerAnchor.clone().project(this.camera);
        const rect = this.getBoundingClientRect();
        this._marker.style.left = ((p.x * 0.5 + 0.5) * rect.width) + 'px';
        this._marker.style.top = ((-p.y * 0.5 + 0.5) * rect.height) + 'px';
      }
      this.renderer.render(this.scene, this.camera);
    }
  }

  if (!customElements.get('house-stage')) customElements.define('house-stage', HouseStage);
})();
