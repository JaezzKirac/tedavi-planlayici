// 3D çene sahnesi (Three.js r128). React'ten bağımsız, imperatif bir sınıf gibi çalışır.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { clamp, lerp, ease } from "../lib/anim.js";
import logoUrl from "../logo/clinic-group-logo-ldvLUm8e.webp";
import { activeTooth } from "../data/timeline.js";
import { bridgeK } from "../data/teeth.js";

/* ---- diş ölçüleri (mm) ---- */
const DIM={
  U:{w:[8.6,6.6,7.6,7,6.6,10.2,9.2,8.6],d:[7,6.2,8,9,9,11,10.6,10],h:[10.5,9,10,8.2,7.6,7.2,6.8,6.4]},
  L:{w:[5.4,5.9,6.9,7,7.2,11,10.4,10],d:[6,6.3,7.5,7.6,8,10.4,10,9.6],h:[9,9.4,10.5,8.4,7.8,7.4,7,6.6]}
};

const OV_T = { x: 0, y: 17, z: -4 }, OV_P = { x: 0, y: 60, z: 150 };
const BRAND = 0x8ea2ff; // Clinic Group lacivertinin sahnedeki parlak tonu
const MOBILE = Math.min(window.screen?.width || 1e4, window.screen?.height || 1e4) < 700;
const REDUCED = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Kalite kademeleri: kare hızı düşerse sırayla bir alta inilir. pr: çözünürlük üst sınırı, shadow: gölge.
// Alt kademede başlayan sahnede yüzey malzemeleri de sadeleşir (bkz. phys). Seçim sekme kapanana kadar hatırlanır.
const TIERS = [{ pr: 1.5, shadow: true }, { pr: 1, shadow: true }, { pr: 1, shadow: false }, { pr: 0.75, shadow: false }];
const TIER_KEY = "jawTier", SLOW_MS = 34, WINDOW_MS = 1500, SETTLE_MS = 1500; // 34 ms ≈ 29 fps
const readTier = () => { try { return Math.min(TIERS.length - 1, +sessionStorage.getItem(TIER_KEY) || 0); } catch { return 0; } };
const saveTier = (x) => { try { sessionStorage.setItem(TIER_KEY, x); } catch { /* gizli pencere */ } };

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {HTMLElement} o.container   canvas'ı saran kutu (boyut için)
 * @param {HTMLElement} o.labelEl     diş numarası etiketi (imperatif güncellenir)
 * @param {HTMLElement} o.leaderEl    etiketten dişe uzanan çizgi
 * @param {HTMLElement} o.xrayEl      "Röntgen görünüm" rozeti
 * @param {(dt:number)=>{t:number,e:object,idle:boolean,playing:boolean}} o.driver  her karede zaman ve aktif olayı verir
 */
export function createJawScene({ canvas, container, labelEl, leaderEl, xrayEl, driver }) {
  let renderer, tier = readTier();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: tier < TIERS.length - 1, alpha: true });
  } catch (err) {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const pixelRatio = () => Math.min(TIERS[tier].pr, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixelRatio());
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // yalnızca dişler hareket ederken güncellenir

  const M = {}, GEO = {};
  let PLAN = {}, TE = {}, FMR = null, MOUTH = {}, gumOp = 1, raf = 0, cap = null, dead = false; // cap: video kaydı durumu

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 800);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 16; controls.maxDistance = 200;
  controls.target.set(OV_T.x, OV_T.y, OV_T.z);
  controls.addEventListener("start", () => { G.tw = null; G.sway = null; G.auto = false; }); // elle döndürünce otomatik kamera bırakır
  controls.addEventListener("change", () => { G.dirty = true; });

  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(roomEnv(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xa8dcff, 0x3a1a22, 0.35));
  const fill = new THREE.DirectionalLight(0xff9c8c, 0.35); fill.position.set(0, -40, 80); scene.add(fill);
  const key = new THREE.DirectionalLight(0xfff0dc, 1.55); key.position.set(25, 90, 70); key.castShadow = TIERS[tier].shadow;
  key.shadow.mapSize.set(MOBILE ? 512 : 1024, MOBILE ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 260 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7f9cff, 1.5); rim.position.set(-20, 40, -90); scene.add(rim);

  mkMats();
  const G = { renderer, scene, camera, controls, auto: true, root: null, T: {}, bur: mkBur(), scan: null, tw: null, last: performance.now() };
  G.scan = new THREE.Mesh(new THREE.PlaneGeometry(80, 70), M.scan); G.scan.visible = false; scene.add(G.scan);
  scene.add(G.bur);
  G.file=new THREE.Group();
  {const nd=new THREE.Mesh(new THREE.CylinderGeometry(.16,.04,15,10),M.endo);nd.position.y=-7.5;const hd=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,2.2,16),M.endoHandle);hd.position.y=1.1;G.file.add(nd,hd);}
  G.file.visible=false;scene.add(G.file);
  // zemin: modelin altında yumuşak gölge ve hafif marka renginde hale
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(240, 200), new THREE.MeshBasicMaterial({ map: radialTex([[0, "rgba(142,162,255,.32)"], [1, "rgba(142,162,255,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.rotation.x = -Math.PI / 2; halo.position.set(0, -25.8, -8); scene.add(halo);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(140, 120), new THREE.MeshBasicMaterial({ map: radialTex([[0, "rgba(0,0,0,.6)"], [.55, "rgba(0,0,0,.28)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.set(0, -25.5, -8); scene.add(contact);
  // dişlerin arkasında duran soluk logo panosu; model döndükçe sahnede sabit kalır
  const logoCv = document.createElement("canvas"); logoCv.width = 1250; logoCv.height = 374;
  const logoTex = new THREE.CanvasTexture(logoCv);
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false });
  const logoBoard = new THREE.Mesh(new THREE.PlaneGeometry(130, 130 * 374 / 1250), logoMat);
  logoBoard.position.set(0, 26, -78); logoBoard.lookAt(OV_P.x, OV_P.y, OV_P.z); logoBoard.visible = false; scene.add(logoBoard);
  const logoImg = new Image();
  logoImg.onload = () => {
    // lacivert logoyu beyaza çevir (yalnız saydamlığı kullanılır)
    const x = logoCv.getContext("2d");
    x.drawImage(logoImg, 0, 0, logoCv.width, logoCv.height);
    x.globalCompositeOperation = "source-in"; x.fillStyle = "#fff"; x.fillRect(0, 0, logoCv.width, logoCv.height);
    logoTex.needsUpdate = true; logoBoard.visible = true; G.dirty = true;
  };
  logoImg.src = logoUrl;
  // işlem gören dişin çevresindeki halka
  G.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 64), M.ring); G.ring.rotation.x = Math.PI / 2; G.ring.visible = false;

  function resize() {
    if (cap) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    G.dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  // sayfa kaydırılıp 3D ekran dışına çıkınca çizim durur
  let onScreen = true;
  const io = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; G.dirty = true; });
  io.observe(container);
  // kare süresi ölçümü: yavaşsa bir alt kaliteye iner
  let winStart = 0, winFrames = 0, settleUntil = performance.now() + SETTLE_MS;
  function watchSpeed(now, ms) {
    if (tier >= TIERS.length - 1 || now < settleUntil) return;
    if (ms > 2000) { winFrames = 0; return; } // sekme değişimi gibi uzun aralıklar sayılmaz
    if (!winFrames) winStart = now - ms;
    winFrames++;
    if (now - winStart < WINDOW_MS) return;
    const slow = (now - winStart) / winFrames > SLOW_MS;
    winFrames = 0;
    if (!slow) return;
    tier++; saveTier(tier); settleUntil = now + SETTLE_MS;
    renderer.setPixelRatio(pixelRatio()); resize();
    if (key.castShadow && !TIERS[tier].shadow) key.castShadow = false;
  }

  function roomEnv(){
    const s=new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(20,20,20),new THREE.MeshBasicMaterial({color:0x5f6469,side:THREE.BackSide})));
    const L=(w,h,x,y,z,i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(i,i,i),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);s.add(m);};
    L(12,6,0,9.5,2,5);L(6,9,-9.5,2,4,3);L(6,9,9.5,3,-2,2.4);L(12,4,0,-1,9.5,1.6);L(8,4,0,1,-9.5,1.2);
    return s;
  }
  function noiseTex(size,blur,rx,ry){
    const cv=document.createElement("canvas");cv.width=cv.height=size;const x=cv.getContext("2d");
    const img=x.createImageData(size,size);
    for(let i=0;i<size*size;i++){const v=110+Math.random()*90;img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=v;img.data[i*4+3]=255;}
    x.putImageData(img,0,0);
    if(blur){try{x.filter=`blur(${blur}px)`;x.drawImage(cv,0,0);x.filter="none";}catch(e){}}
    const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);return t;
  }
  function radialTex(stops){
    const cv=document.createElement("canvas");cv.width=cv.height=256;const x=cv.getContext("2d");
    const g=x.createRadialGradient(128,128,0,128,128,128);stops.forEach(([o,c])=>g.addColorStop(o,c));
    x.fillStyle=g;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(cv);
  }
  function scanTex(){
    const cv=document.createElement("canvas");cv.width=cv.height=256;const x=cv.getContext("2d");
    const g=x.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,"rgba(255,255,255,.55)");g.addColorStop(.6,"rgba(255,255,255,.18)");g.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=g;x.fillRect(0,0,256,256);x.fillStyle="rgba(255,255,255,.9)";x.fillRect(20,126,216,3);
    return new THREE.CanvasTexture(cv);
  }
  // zayıf bilgisayarda ağır fiziksel malzeme yerine sade olanı (parlak üst kat ve kabartma yok)
  function phys(o){
    if(tier<2)return new THREE.MeshPhysicalMaterial(o);
    const {clearcoat,clearcoatRoughness,bumpMap,bumpScale,...r}=o;
    return new THREE.MeshStandardMaterial(r);
  }
  function mkMats(){
    const gumN=noiseTex(128,.6,40,3);
    M.enamel=phys({color:0xffffff,vertexColors:true,roughness:.36,clearcoat:.75,clearcoatRoughness:.2,envMapIntensity:.55});
    M.zirc=phys({color:0xfff9ee,vertexColors:true,roughness:.2,clearcoat:1,clearcoatRoughness:.06,transparent:true,envMapIntensity:.8});
    M.metal=new THREE.MeshStandardMaterial({color:0xc3ccd6,metalness:1,roughness:.24,envMapIntensity:1.3});
    M.metalDark=new THREE.MeshStandardMaterial({color:0x4b555e,metalness:.8,roughness:.4});
    M.gum=phys({color:0xffffff,vertexColors:true,side:THREE.DoubleSide,roughness:.36,clearcoat:.9,clearcoatRoughness:.18,bumpMap:gumN,bumpScale:.05,transparent:true,envMapIntensity:.55});
    M.base=phys({color:0x0e1436,roughness:.45,clearcoat:.5,clearcoatRoughness:.35,envMapIntensity:.3});
    M.bone=new THREE.MeshStandardMaterial({color:0xd8bf92,roughness:.8,transparent:true,envMapIntensity:.5});
    M.root=new THREE.MeshStandardMaterial({color:0xdcc49a,roughness:.55,envMapIntensity:.5,transparent:true,opacity:.75});
    M.decay=new THREE.MeshStandardMaterial({color:0x3e2614,roughness:.9,transparent:true});
    M.glow=new THREE.MeshBasicMaterial({color:BRAND,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    M.ring=new THREE.MeshBasicMaterial({color:BRAND,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    M.scan=new THREE.MeshBasicMaterial({color:BRAND,map:scanTex(),transparent:true,opacity:.55,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
    M.diamond=new THREE.MeshStandardMaterial({color:0xd4b25c,metalness:.9,roughness:.45});
    M.hand=phys({color:0xe9edf0,metalness:.2,roughness:.3,clearcoat:.8});
    M.graft=new THREE.MeshStandardMaterial({color:0xf3ecdc,roughness:.85,transparent:true,envMapIntensity:.5});
    M.membrane=phys({color:0xf5f7fa,roughness:.35,clearcoat:.6,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
    // All-on-X köprüsü: geçici (akrilik) ve kalıcı (zirkonyum), dişeti kısmı pembe
    M.bTemp=phys({color:0xf6efe0,vertexColors:true,roughness:.42,clearcoat:.25,transparent:true,envMapIntensity:.5});
    M.bFinal=phys({color:0xfffaf0,vertexColors:true,roughness:.18,clearcoat:1,clearcoatRoughness:.06,transparent:true,envMapIntensity:.85});
    M.fTemp=phys({color:0xd06c79,roughness:.45,clearcoat:.3,transparent:true,envMapIntensity:.5});
    M.fFinal=phys({color:0xe2808b,roughness:.22,clearcoat:1,clearcoatRoughness:.1,transparent:true,envMapIntensity:.7});
    // dolgu (kompozit), kanal dolgusu (gütaperka), sinüs boşluğu, kanal eğesi
    M.fillMat=phys({color:0xf4efe2,roughness:.3,clearcoat:.6,transparent:true,emissive:0x4a6cff,emissiveIntensity:0});
    M.canal=new THREE.MeshStandardMaterial({color:0xe2722e,roughness:.5,emissive:0x5a2208});
    M.tempFill=new THREE.MeshStandardMaterial({color:0xf2f2ee,roughness:.6});
    M.sinus=phys({color:0x9fd3ff,roughness:.2,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,envMapIntensity:.4});
    M.endo=new THREE.MeshStandardMaterial({color:0xd9dde2,metalness:1,roughness:.25});
    M.endoHandle=new THREE.MeshStandardMaterial({color:0xf2c230,roughness:.5});
    M.STAIN=new THREE.Color(0xe9d6a8);
    M.ENAMEL=new THREE.Color(0xffffff);M.DENTIN=new THREE.Color(0xf3d79f);
    M.GRAFT=new THREE.Color(0xf3ecdc);M.BONE=new THREE.Color(0xd8bf92);
  }

  /* ---- geometriler ---- */
  function crownGeo(k,w,d,h){
    const key=[k,w,d,h].join("_");if(GEO[key])return GEO[key];
    const g=new THREE.SphereGeometry(1,36,24),p=g.attributes.position,v=new THREE.Vector3();
    const molar=k>=6,pre=k===4||k===5,can=k===3,inc=k<=2,n=molar?3.2:pre?2.6:2.2;
    const col=new Float32Array(p.count*3),c=new THREE.Color();
    const BASE=new THREE.Color(0xe2d3b2),CERV=new THREE.Color(0xc29d63),EDGE=new THREE.Color(0xb9c3c6),FIS=new THREE.Color(0x7a5a38),CUSP=new THREE.Color(0xf1ead9);
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);let x=v.x,y=v.y,z=v.z;
      const r=Math.hypot(x,z);
      if(r>1e-5){const a=Math.atan2(z,x);const s=1/Math.pow(Math.pow(Math.abs(Math.cos(a)),n)+Math.pow(Math.abs(Math.sin(a)),n),1/n);x*=s;z*=s;}
      let Y=y<0?y*.6:y,fis=0,b=0;
      const tp=Math.max(0,y);
      if(inc){z*=1-.62*tp;x*=1+.06*tp;Y=y>0?Math.pow(y,.8)*1.02:Y;}
      if(can){z*=1-.45*tp;x*=1-.5*tp*tp;Y=y>0?y*1.12:Y;}
      if((molar||pre)&&y>0){
        Y=Math.pow(y,.5)*.74;
        const cs=molar?[[-.45,-.4],[.45,-.4],[-.45,.4],[.45,.4]]:[[0,-.42],[0,.42]];
        for(const q of cs)b+=Math.exp(-((x-q[0])**2+(z-q[1])**2)/.1);
        fis=Math.exp(-(z*z)/.025)*.13+(molar?Math.exp(-(x*x)/.02)*.06:0);
        Y+=(b*.2-fis)*Math.pow(y,1.6);
      }
      // bombe: yanaklar hafif dolgun, boyun daralır
      const hn=(Y+.6)/1.6, waist=1-.16*Math.pow(clamp(1-hn/.35),2);
      x*=waist;z*=waist;
      p.setXYZ(i,x*w/2,hn*h,z*d/2);
      c.copy(BASE);
      c.lerp(CERV,.75*Math.pow(clamp(1-hn/.55),1.4));
      if(inc||can) c.lerp(EDGE,.55*clamp((hn-.72)/.28));
      if(y>0&&(molar||pre)){c.lerp(FIS,clamp(fis*6)*.65*Math.pow(y,1.2));c.lerp(CUSP,Math.min(1,b)*.3*y);}
      c.convertSRGBToLinear();col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    g.setAttribute("color",new THREE.BufferAttribute(col,3));
    g.computeVertexNormals();GEO[key]=g;return g;
  }

  // veneer: dişi birebir saran ince porselen kabuk; dişin geometrisi yüzey normaline doğru biraz şişirilir
  function veneerGeo(src,rs,d,h){
    const p=src.attributes.position,nm=src.attributes.normal,ix=src.index.array,pos=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){pos[i*3]=p.getX(i)+nm.getX(i)*.2;pos[i*3+1]=p.getY(i)+nm.getY(i)*.2;pos[i*3+2]=p.getZ(i)+nm.getZ(i)*.2;}
    // kabuk dişi kesici kenarı dahil tamamen sarar; yalnız dişeti altındaki boyun kısmı dışarıda kalır (yırtık kenar oluşmaz)
    const keep=i=>p.getY(i)>h*.03,out=[];
    for(let t=0;t<ix.length;t+=3)if(keep(ix[t])&&keep(ix[t+1])&&keep(ix[t+2]))out.push(ix[t],ix[t+1],ix[t+2]);
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pos,3));g.setAttribute("normal",nm.clone());g.setIndex(out);
    return g;
  }
  function implantMesh(){
    const grp=new THREE.Group();
    if(!GEO.imp){
      const pr=[[0,-11.2],[.9,-11],[1.45,-10.2],[1.72,-6],[1.88,-1],[2.05,-.6],[2.05,0],[1.1,.05],[0,.05]].map(a=>new THREE.Vector2(a[0],a[1]));
      GEO.imp=new THREE.LatheGeometry(pr,20);
      const helix=new THREE.Curve();
      helix.getPoint=function(t,o){o=o||new THREE.Vector3();const a=t*Math.PI*2*9,y=-1.1-t*9.2,r=1.86-t*.36;return o.set(Math.cos(a)*r,y,Math.sin(a)*r);};
      GEO.thread=new THREE.TubeGeometry(helix,180,.36,5,false);
      GEO.hex=new THREE.CylinderGeometry(.8,.8,.6,6);
    }
    const core=new THREE.Mesh(GEO.imp,M.metal),th=new THREE.Mesh(GEO.thread,M.metal),hx=new THREE.Mesh(GEO.hex,M.metalDark);
    hx.position.y=.1;[core,th].forEach(m=>{m.castShadow=true;});
    grp.add(core,th,hx);return grp;
  }
  function abutMesh(){
    const g=new THREE.Group();
    const hex=new THREE.Mesh(new THREE.CylinderGeometry(1.9,1.9,1,6),M.metal);hex.position.y=.5;
    const post=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.75,4.6,16),M.metal);post.position.y=3.3;
    const top=new THREE.Mesh(new THREE.SphereGeometry(1.2,16,6,0,Math.PI*2,0,Math.PI/2),M.metal);top.position.y=5.6;
    g.add(hex,post,top);g.traverse(m=>{if(m.isMesh)m.castShadow=true;});return g;
  }
  function mkBur(){
    const g=new THREE.Group();
    const spin=new THREE.Group();
    const tip=new THREE.Mesh(new THREE.CylinderGeometry(.75,.22,6,20),M.diamond);tip.position.y=3;
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,12,16),M.metal);sh.position.y=12;
    spin.add(tip,sh);
    const head=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,4.5,32),M.hand);head.position.y=20;
    const cap=new THREE.Mesh(new THREE.SphereGeometry(3.2,32,16,0,Math.PI*2,0,Math.PI/2),M.hand);cap.position.y=22.2;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.6,34,24),M.hand);neck.rotation.x=Math.PI/2-.25;neck.position.set(0,24,17);
    g.add(spin,head,cap,neck);g.userData.spin=spin;g.visible=false;
    g.traverse(m=>{if(m.isMesh)m.castShadow=true;});
    return g;
  }
  function halfArch(){
    const pts=[],rx=21,ry=19;
    for(let i=0;i<=40;i++){const u=i/40*Math.PI/2;pts.push(new THREE.Vector3(rx*Math.sin(u),0,ry*Math.cos(u)));}
    for(let i=1;i<=24;i++){const f=i/24;pts.push(new THREE.Vector3(rx+4*f,0,-38*f));}
    const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+pts[i].distanceTo(pts[i-1]));
    return {pts,len:L[L.length-1],at(s){let i=1;while(i<L.length-1&&L[i]<s)i++;const f=clamp((s-L[i-1])/(L[i]-L[i-1]));return {p:pts[i-1].clone().lerp(pts[i],f),tg:pts[i].clone().sub(pts[i-1]).normalize()};}};
  }
  function gumColor(geo,fn){
    const p=geo.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color(),DEEP=new THREE.Color(0x9c2f43),CORAL=new THREE.Color(0xe4878a);
    for(let i=0;i<p.count;i++){const f=fn(p.getY(i));c.copy(DEEP).lerp(CORAL,f);c.convertSRGBToLinear();col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
    geo.setAttribute("color",new THREE.BufferAttribute(col,3));return geo;
  }
  function tube(curve,r,mat,y,sy){
    const g=new THREE.TubeGeometry(curve,90,r,12,false);
    const isGum=mat===M.gum,fn=Y=>Math.pow(clamp((Y+r)/(2*r)),1.6);
    if(isGum)gumColor(g,fn);
    const m=new THREE.Mesh(g,mat);
    m.position.y=y;m.scale.y=sy;m.receiveShadow=true;
    [0,1].forEach(t=>{const sg=new THREE.SphereGeometry(r,12,8);if(isGum)gumColor(sg,fn);const c=new THREE.Mesh(sg,mat);c.position.copy(curve.getPoint(t));c.receiveShadow=true;m.add(c);});
    return m;
  }

  function buildArch(upper){
    const grp=new THREE.Group(),H=halfArch(),D=upper?DIM.U:DIM.L;
    const gp=[];for(let i=H.pts.length-1;i>=0;i--)gp.push(new THREE.Vector3(-H.pts[i].x,0,H.pts[i].z));for(let i=1;i<H.pts.length;i++)gp.push(H.pts[i].clone());
    const curve=new THREE.CatmullRomCurve3(gp);
    grp.add(tube(curve,4.8,M.bone,-10,1.5));
    grp.add(buildBase(H));
    const quads=upper?[[1,1],[2,-1]]:[[4,-1],[3,1]];
    const rnd=n=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x)-.5;};
    const INCL=[.24,.2,.12,.05,.03,-.04,-.06,-.08];
    const lists={};
    // tam ağız restorasyonu bu çenede mi: ağızda olmayan dişler gösterilmez, implantların üstüne köprü gelir
    const archKey=upper?"U":"L",FA=!!FMR&&FMR.arches.includes(archKey),bridgeTeeth={1:[],"-1":[]};
    quads.forEach(([q,side])=>{
      let s=.15;const list=[];
      for(let k=1;k<=8;k++){
        const w=D.w[k-1],d=D.d[k-1],h=D.h[k-1],n=q*10+k;
        list.push({k,s0:s,w,d});
        const {p,tg}=H.at(s+w/2);s+=w+.25;
        p.x*=side;tg.x*=side;
        const holder=new THREE.Group();holder.position.copy(p);
        const th=-Math.atan2(tg.z,tg.x)+rnd(n)*.08;holder.rotation.y=th;
        const out=new THREE.Vector3(p.x,0,p.z+8).normalize();
        const rs=Math.sign(out.x*Math.sin(th)+out.z*Math.cos(th))||1;
        const ST=MOUTH[n]||""; // "" doğal, m eksik, c kronlu, i implantlı
        const P=PLAN[n]||{},I=!!P.imp,C=!!P.crw,E=!!P.ext,GR=!!P.grf,RCT=!!P.rct,VEN=!!P.ven,SIN=!!P.sin,FIL=!!P.fil,RPL=!!P.rpl;
        const treat=I||C||E||GR||RCT||VEN||SIN||FIL||RPL;
        const geo=crownGeo(k,w,d,h);
        const tMat=treat?M.enamel.clone():M.enamel;
        const tilt=new THREE.Group();tilt.rotation.x=rs*INCL[k-1];tilt.rotation.z=rnd(n+7)*.06;holder.add(tilt);
        const tooth=new THREE.Mesh(geo,tMat);tooth.castShadow=true;tooth.receiveShadow=true;
        const root=new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w,d)*.36,Math.min(w,d)*.13,15,10),(E||RCT)?M.root.clone():M.root);root.position.y=-7.2;
        tilt.add(tooth,root);
        if(FA&&!PLAN[n]){tooth.visible=false;root.visible=false;}
        if(ST==="m"||ST==="i"){tooth.visible=false;root.visible=false;}
        if(FA&&k<=bridgeK(FMR,upper)&&!(PLAN[n]&&PLAN[n].own)){const bt=new THREE.Mesh(geo,M.bTemp);bt.scale.set(1.04,1,1.04);bt.castShadow=true;bt.visible=false;holder.add(bt);bridgeTeeth[side].push({k,bt,p:p.clone()});}
        const o={long:!!(P.zyg||P.pty),n,holder,tilt,tz0:tilt.rotation.z,tooth,toothMat:tMat,root,w,d,h,rs,upper,treat,imp:I,crw:C,ext:E,grf:GR,rct:RCT,ven:VEN,sin:SIN,fil:FIL,rpl:RPL};
        if(E){tMat.transparent=true;o.rootMat=root.material;}
        if(C||RPL){
          o.crownMat=M.zirc.clone();
          o.crown=new THREE.Mesh(geo,o.crownMat);o.crown.scale.set(1.03,1.02,1.03);o.crown.castShadow=true;o.crown.visible=false;
          (I||ST==="i"?holder:tilt).add(o.crown);
        }
        if(I){
          if(!E){tooth.visible=false;root.visible=false;}
          // All-on-4: arka implantlar ~30° geriye (distale) açılı; holder'ın +x ekseni çene boyunca geriye bakar
          const ig=new THREE.Group();holder.add(ig);o.ig=ig;
          o.implant=implantMesh();o.implant.visible=false;ig.add(o.implant);
          if(P.zyg){
            // zygomatic: dışa ve yukarı açılı, ucu elmacık kemiğine tutunur. Gerçekte ~30–50 mm; hastayı ürkütmemek için kısa ve ince gösterilir
            ig.rotation.x=-rs*.4;ig.rotation.z=.15;o.implant.scale.set(.7,1.75,.7);
            const zb=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),M.bone);zb.scale.set(4.5,3.4,5);zb.position.y=-20;ig.add(zb);
          }else if(P.pty){
            // pterygoid: en arkadan geriye doğru açılı; normal implanttan biraz uzun
            ig.rotation.z=.7;o.implant.scale.set(.8,1.25,.8);
          }else if(FA&&FMR.type===4&&k===5)ig.rotation.z=.55; // All-on-4: arka implantlar ~30° geriye açılı
          o.abut=abutMesh();o.abut.visible=false;holder.add(o.abut);
          o.glowMat=M.glow.clone();o.glow=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),o.glowMat);o.glow.scale.set(3.6,7.6,3.6);o.glow.position.y=-8.6;o.glow.visible=false;holder.add(o.glow);
        }
        if((E&&ST!=="i")||(!I&&C)||FIL){
          o.decayMat=M.decay.clone();
          o.decay=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),o.decayMat);
          o.decay.scale.set(Math.min(w,d)*.24,Math.min(w,d)*.12,Math.min(w,d)*.2);o.decay.position.set(w*.12,h*.84,d*.05);
          tilt.add(o.decay);
        }
        if(GR){
          // greft granülleri yuvayı alttan üste doldurur, üstü membranla örtülür
          if(!GEO.gran)GEO.gran=new THREE.IcosahedronGeometry(.62,0);
          o.grfMat=M.graft.clone();o.memMat=M.membrane.clone();o.gran=[];
          const gg=new THREE.Group();gg.visible=false;holder.add(gg);o.grfGrp=gg;
          const R=Math.min(w,d)*.42,N=46;
          for(let i=0;i<N;i++){
            const a=(rnd(n*31+i)+.5)*Math.PI*2,rr=R*Math.sqrt(rnd(n*17+i)+.5);
            const m=new THREE.Mesh(GEO.gran,o.grfMat);
            m.userData.y=-9+i/N*8.6+rnd(n*7+i)*.8;m.position.set(Math.cos(a)*rr,m.userData.y,Math.sin(a)*rr);
            m.rotation.set(rnd(i)*6,rnd(i+3)*6,0);m.scale.setScalar(1+rnd(n+i*5)*.6);
            gg.add(m);o.gran.push(m);
          }
          o.mem=new THREE.Mesh(new THREE.CylinderGeometry(R+1.4,R+1.4,.12,28),o.memMat);o.mem.position.y=.4;gg.add(o.mem);
        }
        if(ST==="i"){
          // hastada zaten olan implant: yerinde, dayanağı ve kronuyla tek grup (çıkarılırken birlikte hareket eder)
          o.exI=true;const eg=new THREE.Group();holder.add(eg);o.exG=eg;
          const im=implantMesh();im.position.y=-3;eg.add(im);
          const ab=abutMesh();ab.position.y=-3;eg.add(ab);
        }
        if(RPL||ST==="c"||ST==="i"){
          // mevcut (eski) kron: daha mat ve sarımsı; altındaki diş kron için küçültülmüş
          o.oldMat=M.zirc.clone();o.oldMat.color.set(0xe6d4ac);o.oldMat.roughness=.5;
          o.old=new THREE.Mesh(geo,o.oldMat);o.old.scale.set(1.03,1.02,1.03);o.old.castShadow=true;(ST==="i"?o.exG:tilt).add(o.old);
          if(ST!=="i"){tooth.scale.set(.8,.74,.8);tMat.color.copy(M.DENTIN);}
        }
        if(FIL){o.fillMat=M.fillMat.clone();o.fill=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),o.fillMat);o.fill.position.copy(o.decay.position);o.fill.visible=false;tilt.add(o.fill);}
        if(RCT){
          // kanal: kökün içinde ince turuncu dolgu, kronun üstünde geçici dolgu
          o.rootMat=root.material;o.canalMat=M.canal.clone();
          o.canal=new THREE.Mesh(new THREE.CylinderGeometry(.42,.12,14,12),o.canalMat);o.canal.position.y=-7;o.canal.visible=false;tilt.add(o.canal);
          o.tfill=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),M.tempFill);o.tfill.scale.set(Math.min(w,d)*.22,.5,Math.min(w,d)*.22);o.tfill.position.y=h*.95;o.tfill.visible=false;tilt.add(o.tfill);
        }
        if(VEN){
          // veneer: dişin dış (dudak/yanak) yüzünü kaplayan ince kabuk; rs>0 ise dış yüz yerel +z
          o.venMat=M.zirc.clone();o.venMat.vertexColors=false;o.venMat.color.set(0xfffdf8);o.venMat.side=THREE.DoubleSide;
          o.veneer=new THREE.Mesh(veneerGeo(geo,rs,d,h),o.venMat);o.veneer.visible=false;tilt.add(o.veneer);
        }
        if(SIN){
          // sinüs lifting: kökün üstünde sinüs boşluğu; zar kaldırılır, altı greftle dolar
          if(!GEO.gran)GEO.gran=new THREE.IcosahedronGeometry(.62,0);
          const sg=new THREE.Group();sg.visible=false;holder.add(sg);o.sinGrp=sg;
          o.sinMat=M.sinus.clone();o.cav=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),o.sinMat);o.cav.scale.set(8,5.5,9);o.cav.position.y=-23;sg.add(o.cav);
          o.sGranMat=M.graft.clone();o.sMemMat=M.membrane.clone();o.sGran=[];
          for(let i=0;i<60;i++){
            const a=(rnd(n*29+i)+.5)*Math.PI*2,rr=5.2*Math.sqrt(rnd(n*13+i)+.5);
            const m=new THREE.Mesh(GEO.gran,o.sGranMat);m.userData.y=-15.5-i/60*5+rnd(n*3+i)*.6;m.position.set(Math.cos(a)*rr,m.userData.y,Math.sin(a)*rr*1.1);
            m.rotation.set(rnd(i)*6,rnd(i+5)*6,0);m.scale.setScalar(1+rnd(n+i*7)*.5);sg.add(m);o.sGran.push(m);
          }
          o.sMem=new THREE.Mesh(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,Math.PI*.55,Math.PI*.45),o.sMemMat);o.sMem.scale.set(6.4,2.2,7);o.sMem.position.y=-17.5;sg.add(o.sMem);
        }
        G.T[n]=o;grp.add(holder);
      }
      lists[side]=list;
    });
    grp.add(buildGum(H,lists));
    if(upper) grp.add(buildPalate(H,lists[1]));
    if(FA) grp.add(buildBridge(archKey,bridgeTeeth));
    return grp;
  }

  // damak: iki yandaki dil tarafı dişetini birleştiren kubbe; önde enine kıvrımlar (rugae), ortada sırt (rafe) ve kesici papilla
  function buildPalate(H,list){
    const last=list[list.length-1],S=Math.min(H.len,last.s0+last.w+1.5),RS=70,CS=36,pos=[],col=[],uv=[],idx=[];
    const c=new THREE.Color(),DEEP=new THREE.Color(0x8a2a3c),CORAL=new THREE.Color(0xeba0a0);
    const RUG=[3.4,6.6,9.8,13];
    for(let i=0;i<=RS;i++){
      const s=i/RS*S,u=s/S,{p,tg}=H.at(s);
      // kenar, dişetinin dil tarafındaki yüzeyinin biraz içinde kalır (dikiş görünmesin)
      const ex=p.x+tg.z*6,ez=p.z-tg.x*6;
      // kubbe önde sığ başlar, ortada derinleşir; arkada dişeti hizasına kıvrılarak kapanır (sarkık perde görünümü olmasın)
      const tail=clamp((u-.7)/.3),depth=(3+5*Math.sin(Math.min(u/.4,1)*Math.PI/2))*(1-.9*tail*tail*(3-2*tail));
      for(let j=0;j<=CS;j++){
        const v=j/CS,a=Math.abs(v-.5)*2,vault=Math.pow(Math.sin(Math.PI*v),.6);
        let rid=0;
        RUG.forEach((r,k)=>{const sr=r+Math.sin(a*5+k*1.7)*.9+a*1.2;rid+=Math.exp(-(((s-sr)/.95)**2))*(a>.1&&a<.78?Math.sin((a-.1)/.68*Math.PI):0);});
        rid*=.75;
        const raphe=s>4?.32*Math.exp(-(((v-.5)/.022)**2))*(1-u*.7):0;
        const pap=.9*Math.exp(-((s-1.6)**2)/1.4-(((v-.5)/.07)**2));
        pos.push(lerp(-ex,ex,v),-2.6-depth*vault+rid+raphe+pap,ez);
        uv.push(v*3,u*5);
        c.copy(DEEP).lerp(CORAL,clamp(.66-.32*vault*depth/11+rid*.45+raphe*.6+pap*.25));c.convertSRGBToLinear();col.push(c.r,c.g,c.b);
      }
    }
    for(let i=0;i<RS;i++)for(let j=0;j<CS;j++){const a=i*(CS+1)+j,b=a+CS+1;idx.push(a,b,a+1,b,b+1,a+1);}
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx);g.computeVertexNormals();
    const m=new THREE.Mesh(g,M.gum);m.receiveShadow=true;return m;
  }
  // köprü: 1–6. dişlerin kronları + kron boyunlarını saran pembe dişeti kısmı; tek parça gibi birlikte hareket eder
  function buildBridge(a,bt){
    const ord=[...bt[-1].slice().sort((x,y)=>y.k-x.k),...bt[1].slice().sort((x,y)=>x.k-y.k)];
    const b={teeth:ord.map(o=>o.bt),tt:M.bTemp.clone(),tf:M.bFinal.clone(),ft:M.fTemp.clone(),ff:M.fFinal.clone(),flanges:[]};
    // komşu köprü dişleri bir parça; arada kendi dişi kalan yer varsa parça bölünür
    const side=o=>bt[1].includes(o)?1:-1,next=(x,y)=>side(x)===side(y)?Math.abs(x.k-y.k)===1:x.k===1&&y.k===1;
    const runs=[];ord.forEach((o,i)=>{if(i&&next(ord[i-1],o))runs[runs.length-1].push(o);else runs.push([o]);});
    const grp=new THREE.Group();
    runs.forEach(r=>{
      const pts=r.map(o=>o.p.clone().setY(0));
      if(pts.length===1){const q=pts[0].clone();pts[0]=q.clone().add(new THREE.Vector3(-1.5,0,0));pts.push(q.add(new THREE.Vector3(1.5,0,0)));}
      const fl=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),Math.max(8,r.length*7),2.6,10,false),b.ft);
      fl.castShadow=true;fl.visible=false;b.flanges.push(fl);grp.add(fl);
    });
    G.bridges[a]=b;return grp;
  }
  function buildGum(H,lists){
    const info=sd=>{const t=lists[sd],last=t[t.length-1],Lt=last.s0+last.w;return {t,last,Lt,Lend:Lt+3.4,bounds:[0,...t.map(x=>x.s0+x.w)]};};
    const A={"-1":info(-1),"1":info(1)};
    const S0=-A["-1"].Lend,S1=A["1"].Lend,RS=Math.ceil((S1-S0)/.5),PS=22,pos=[],col=[],idx=[],uv=[];
    const c=new THREE.Color(),DEEP=new THREE.Color(0x952c40),CORAL=new THREE.Color(0xec9496);
    const JUGA=[.35,.3,1.1,.55,.5,.6,.5,.4];
    for(let i=0;i<=RS;i++){
      const ss=S0+i/RS*(S1-S0),side=ss<0?-1:1,s=Math.abs(ss),I=A[side];
      const {p,tg}=H.at(Math.min(s,H.len));
      const N=new THREE.Vector3(-tg.z,0,tg.x);
      p.x*=side;N.x*=side;
      const tooth=I.t.find(t=>s>=t.s0-.13&&s<=t.s0+t.w+.13)||I.last;
      let pap=0;for(const b of I.bounds)pap=Math.max(pap,Math.exp(-Math.pow((s-b)/1.25,2)));
      const crest=.2+2.1*pap,m=tooth.d/2*.8*(1-.55*pap);
      const u=clamp((s-tooth.s0)/tooth.w),J=s<=I.Lt?JUGA[tooth.k-1]*Math.sin(Math.PI*u):0;
      let f=1;if(s>I.Lt+.6){const q=(s-I.Lt-.6)/(I.Lend-I.Lt-.6);f=Math.sqrt(Math.max(0,1-q*q));}
      const prof=[[-9.4,-15.5],[-8.8,-9],[-7.2,-3],[-m-1.1,crest-.6],[-m,crest],[-m*.5,crest-1.4],[0,crest-2.2],[m*.5,crest-1.4],[m,crest],[m+1.1,crest-.7],[7.3+J,-2.6],[8.9+J*.6,-9],[9.4,-15.5]];
      const sp=new THREE.SplineCurve(prof.map(a=>new THREE.Vector2(a[0],a[1]))).getPoints(PS);
      sp.forEach((v,j)=>{
        const o=v.x*f,y=-7+(v.y+7)*f;
        pos.push(p.x+N.x*o,y,p.z+N.z*o);uv.push(i/RS*6,j/PS);
        c.copy(DEEP).lerp(CORAL,Math.pow(clamp((y+8)/(crest+8)),2.4));c.convertSRGBToLinear();col.push(c.r,c.g,c.b);
      });
    }
    for(let i=0;i<RS;i++)for(let j=0;j<PS;j++){const a=i*(PS+1)+j,b=a+PS+1;idx.push(a,b,a+1,b,b+1,a+1);}
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,M.gum);mesh.receiveShadow=true;
    return mesh;
  }
  function buildBase(H){
    const out=[],inn=[],L=Math.min(H.len,70);
    for(let s=0;s<=L+.001;s+=.9){const {p,tg}=H.at(s);const nx=-tg.z,nz=tg.x;out.push([p.x+nx*11.5,p.z+nz*11.5]);inn.push([p.x-nx*10,p.z-nz*10]);}
    const pts=[...out.slice().reverse().map(a=>[a[0],a[1]]),...out.slice(1).map(a=>[-a[0],a[1]]),...inn.slice().reverse().map(a=>[-a[0],a[1]]),...inn.slice(1,-1).map(a=>[a[0],a[1]])];
    const sh=new THREE.Shape(pts.map(a=>new THREE.Vector2(a[0],-a[1])));
    const g=new THREE.ExtrudeGeometry(sh,{depth:7,bevelEnabled:true,bevelThickness:1.2,bevelSize:1.2,bevelSegments:4,curveSegments:4});
    g.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(g,M.base);m.position.y=-24;m.receiveShadow=true;m.castShadow=true;return m;
  }
  function buildJaw(){
    if(G.root){G.scene.remove(G.root);}
    G.T={};G.bridges={};
    const root=new THREE.Group();
    root.add(buildArch(false));
    const pivot=new THREE.Group();pivot.position.set(0,16,-36);pivot.rotation.x=-.62;
    const up=buildArch(true);up.rotation.z=Math.PI;up.position.z=36;
    pivot.add(up);root.add(pivot);
    G.scene.add(root);G.root=root;root.updateMatrixWorld(true);
  }

  /* ---- her kare ---- */
  const V=()=>new THREE.Vector3();
  function toothWorld(o){const v=V();o.holder.localToWorld(v.set(0,o.h*.5,0));return v;}
  // çekim: diş önce sallanır, sonra yuvasından yukarı kalkıp kaybolur
  function updExt(o,te,t){
    const x=te.ext,on=!!x&&t>=x.s,px=x?clamp((t-x.s)/(x.d*.8)):0,gone=px>=1;
    const lift=ease(clamp((px-.35)/.5)),fade=1-clamp((px-.6)/.3);
    if(o.exG){
      // eski implant: önce sökülür (döndürülür), sonra yuvasından çıkar
      o.exG.rotation.y=ease(clamp(px/.6))*-14;o.exG.position.y=lerp(0,18,lift);o.exG.visible=!gone;
      if(o.oldMat)o.oldMat.opacity=fade;
      o.tooth.visible=o.root.visible=false;o.rootMat.visible=false; // implantın yerinde doğal kök yok
      return;
    }
    o.tilt.position.y=lerp(0,18,lift);
    o.tilt.rotation.z=o.tz0+(px<.35?Math.sin(t*.03)*.07*Math.sin(px/.35*Math.PI):0);
    o.toothMat.opacity=fade;o.toothMat.depthWrite=fade>=1;
    o.rootMat.opacity=.75*fade;o.decayMat.opacity=fade;
    o.tooth.visible=o.root.visible=o.decay.visible=!gone;
    if(o.old){o.oldMat.opacity=fade;o.old.visible=!gone;}
    o.rootMat.visible=M.root.visible||(on&&px>.35);
  }
  // greft: granüller düşerek yuvayı doldurur, membran örtülür; kemikleşmede kemik rengine dönüp kaybolur
  function updGraft(o,te,t){
    const g=te.graft,h=te.gheal,ph=h?clamp((t-h.s)/h.d):0;
    o.grfGrp.visible=!!g&&t>=g.s&&!(h&&t>=h.s+h.d);
    if(!o.grfGrp.visible) return;
    const pg=clamp((t-g.s)/(g.d*.8)),N=o.gran.length;
    o.gran.forEach((m,i)=>{const f=clamp((pg-i/N*.7)/.1);m.visible=f>0;m.position.y=m.userData.y+lerp(9,0,ease(f));});
    o.memMat.opacity=.55*clamp((pg-.8)/.2)*(1-ph);
    o.grfMat.color.copy(M.GRAFT).lerp(M.BONE,ph);
    o.grfMat.opacity=1-clamp((ph-.6)/.4);
  }
  // geçici köprü yukarıdan oturur; kalıcı köprü aşamasında geçici kalkar, kalıcı oturur
  function updBridges(t){
    Object.entries(G.bridges).forEach(([a,b])=>{
      const te=TE[a]||{},tp=te.temp,fb=te.bridge;
      let vis=false,y=0,op=1,fin=false;
      if(fb&&t>=fb.s){vis=true;const p=clamp((t-fb.s)/(fb.d*.8));
        if(p<.4){y=lerp(0,16,ease(p/.4));op=1-p/.4;}else{fin=true;y=lerp(16,0,ease((p-.4)/.6));op=Math.min(1,(p-.4)/.25);}}
      else if(tp&&t>=tp.s){vis=true;const p=clamp((t-tp.s)/(tp.d*.75));y=lerp(16,0,ease(p));op=Math.min(1,p*2.5);}
      const tm=fin?b.tf:b.tt,fm=fin?b.ff:b.ft;
      tm.opacity=fm.opacity=op;tm.depthWrite=fm.depthWrite=op>=1;
      b.teeth.forEach(m=>{m.visible=vis;m.material=tm;m.position.y=y;});
      b.flanges.forEach(fl=>{fl.visible=vis;fl.material=fm;fl.position.y=.2+y;});
    });
  }
  // kron değişimi: eski kron kesilir, kalkıp kaybolur; yenisi "fit" aşamasında takılır
  function updRpl(o,te,t){
    const c=te.crem,f=te.fit,on=!!c&&t>=c.s,pp=on?clamp((t-c.s)/(c.d*.85)):0,lift=ease(clamp((pp-.45)/.45));
    o.old.visible=pp<1;o.old.position.y=lerp(0,14,lift);o.oldMat.opacity=1-clamp((pp-.6)/.4);
    if(!o.exI)o.tooth.visible=!(f&&clamp((t-f.s)/(f.d*.6))>=1);
    return on&&pp<.45&&!o.exI?{o,mode:"prep",p:pp/.45}:null;
  }
  // dolgu: matkap çürüğü temizler, kompozit yerleşir, mavi ışıkla sertleşir
  function updFill(o,te,t){
    const f=te.fill;if(!f)return null;const on=t>=f.s,pp=on?clamp((t-f.s)/(f.d*.85)):0;
    o.decay.visible=pp<.5;o.decayMat.opacity=1-pp/.5;
    const pf=clamp((pp-.45)/.3);o.fill.visible=pf>0;o.fill.scale.copy(o.decay.scale).multiplyScalar(1.15*Math.max(.01,ease(pf)));
    o.fillMat.emissiveIntensity=pp>.75&&pp<.95?.9*Math.sin((pp-.75)/.2*Math.PI):0;
    return on&&pp<.5?{o,mode:"fill",p:pp/.5}:null;
  }
  // kanal tedavisi: eğe köke iner çıkar, kanal dolgusu dolar, geçici dolgu konur
  function updRct(o,te,t){
    const r=te.rct;if(!r)return false;const on=t>=r.s,pp=on?clamp((t-r.s)/(r.d*.85)):0,act=on&&pp<1;
    o.rootMat.visible=M.root.visible||act;o.rootMat.opacity=act?.4:.75;
    o.canal.visible=o.rootMat.visible&&pp>.6;o.canal.scale.y=Math.max(.01,ease(clamp((pp-.6)/.25)));o.canal.position.y=-14+7*o.canal.scale.y;
    o.tfill.visible=pp>.85;
    if(!(on&&pp<.6))return false;
    if(G.file.parent!==o.tilt)o.tilt.add(G.file);
    G.file.visible=true;G.file.position.set(0,lerp(o.h+16,3,.5-.5*Math.cos(pp/.6*Math.PI*6)),0);G.file.rotation.y=t*.02;
    return true;
  }
  // veneer: ön yüz hafifçe parlatılır, kabuk önden gelip oturur; dişin rengi açılır
  function updVen(o,te,t){
    const v=te.ven,on=!!v&&t>=v.s,pp=on?clamp((t-v.s)/(v.d*.85)):0,pv=clamp((pp-.35)/.5);
    o.toothMat.color.copy(M.STAIN).lerp(M.ENAMEL,ease(pv));
    o.veneer.visible=pv>0;o.venMat.opacity=Math.min(1,pv*2.5);o.veneer.position.z=(o.rs<0?-1:1)*lerp(7,0,ease(pv));
    return on&&pp<.35?{o,mode:"ven",p:pp/.35}:null;
  }
  // sinüs lifting: boşluk görünür, zar yukarı kalkar, altına greft dolar; kemikleşmede granüller kemiğe döner
  function updSinus(o,te,t){
    const sn=te.sinus,h=te.gheal,ph=h?clamp((t-h.s)/h.d):0;
    o.sinGrp.visible=!!sn&&t>=sn.s&&!(h&&t>=h.s+h.d);
    if(!o.sinGrp.visible)return;
    const ps=clamp((t-sn.s)/(sn.d*.85)),N=o.sGran.length;
    o.sinMat.opacity=.32*Math.min(1,ps*4)*(1-clamp((ph-.7)/.3));
    const lift=ease(clamp(ps/.4));o.sMem.position.y=-17.5-4*lift;o.cav.scale.y=5.5-1.6*lift;o.cav.position.y=-23-.8*lift;
    o.sMemMat.opacity=.6*(1-ph);
    o.sGran.forEach((m,i)=>{const fr=clamp((ps-.35-i/N*.5)/.1);m.visible=fr>0;m.position.y=m.userData.y+lerp(-6,0,ease(fr));});
    o.sGranMat.color.copy(M.GRAFT).lerp(M.BONE,ph);o.sGranMat.opacity=1-clamp((ph-.6)/.4);
  }
  function updTeeth(t){
    updBridges(t);
    let tool=null,filing=false;
    Object.values(G.T).forEach(o=>{
      if(!o.treat) return;
      const te=TE[o.n]||{};
      if(o.ext) updExt(o,te,t);
      if(o.grf) updGraft(o,te,t);
      if(o.sin) updSinus(o,te,t);
      if(o.rct&&updRct(o,te,t)) filing=true;
      if(o.fil){const k=updFill(o,te,t);if(k)tool=k;}
      if(o.ven){const k=updVen(o,te,t);if(k)tool=k;}
      if(o.rpl){const k=updRpl(o,te,t);if(k)tool=k;}
      const f=te.fit,pf=f?clamp((t-f.s)/(f.d*.6)):0;
      if(o.crown){o.crown.visible=!!f&&t>=f.s;o.crown.position.y=lerp(14,0,ease(pf));o.crownMat.opacity=Math.min(1,pf*2.5);}
      if(o.imp){
        const s=te.surgery,ps=s?clamp((t-s.s)/s.d):0,on=!!s&&t>=s.s;
        if(on&&ps<.36) tool={o,mode:"drill",p:ps/.36};
        const pi=clamp((ps-.38)/.5);
        // elmacık / pterygoid kemiğine uzanan uzun implantlar yalnız röntgen görünümünde görünür (o kemikler modelde yok)
        o.implant.visible=on&&ps>=.38&&(!(o.long)||M.bone.visible);o.implant.position.y=lerp(15,-3,ease(pi));o.implant.rotation.y=-ease(pi)*24;
        const h=te.heal;o.glow.visible=!!h&&t>=h.s&&t<h.s+h.d;
        if(o.glow.visible){const ph=(t-h.s)/h.d;o.glowMat.opacity=(.22+.16*Math.sin((t-h.s)*.006))*Math.min(1,ph*5,(1-ph)*5);}
        const a=te.abut,pa=a?clamp((t-a.s)/(a.d*.6)):0;
        o.abut.visible=!!a&&t>=a.s;o.abut.scale.y=o.crw?1:.55;o.abut.position.y=-3+lerp(10,0,ease(pa));o.abut.rotation.y=(1-ease(pa))*8;
      }else{
        if(!o.crw) return;
      const pr=te.prep,pp=pr?clamp((t-pr.s)/(pr.d*.85)):0,e=ease(pp);
        o.tooth.scale.set(1-.2*e,1-.26*e,1-.2*e);
        o.toothMat.color.copy(M.ENAMEL).lerp(M.DENTIN,e);
        o.decay.visible=pp<.45;o.decayMat.opacity=1-pp/.45;
        if(pr&&t>=pr.s&&pp<1) tool={o,mode:"prep",p:pp};
        o.tooth.visible=!(o.crown&&pf>=1);
      }
    });
    if(!filing)G.file.visible=false;
    const b=G.bur;
    if(tool){
      const par=tool.mode==="drill"?(tool.o.ig||tool.o.holder):tool.o.tooth.parent;if(b.parent!==par)par.add(b);
      b.visible=true;b.rotation.y=tool.o.rs<0?Math.PI:0;b.userData.spin.rotation.y=t*.09;
      if(tool.mode==="drill"){
        const p=tool.p,y=p<.75?lerp(20,-13,ease(p/.75)):lerp(-13,22,ease((p-.75)/.25));
        b.position.set(0,y,0);b.rotation.z=0;
      }else if(tool.mode==="fill"){
        const o=tool.o,a=tool.p*Math.PI*8,dp=o.decay.position;
        b.position.set(dp.x+.5*Math.cos(a),o.h*.95,dp.z+.5*Math.sin(a));b.rotation.z=0;
      }else if(tool.mode==="ven"){
        const o=tool.o,a=tool.p*Math.PI*4;
        b.position.set(o.w*.28*Math.sin(a),o.h*.2,(o.rs<0?-1:1)*(o.d/2+.6));b.rotation.z=.15*Math.cos(a);
      }else{
        const o=tool.o,a=tool.p*Math.PI*5;
        b.position.set((o.w/2+.4)*Math.cos(a),o.h*.3,(o.d/2+.4)*Math.sin(a));b.rotation.z=.12*Math.cos(a);
      }
    }else b.visible=false;
  }

  function camGo(pos,tgt,dur=1200,intro=false){
    G.sway=null;if(!intro)G.auto=false;
    G.tw={a:new THREE.Spherical().setFromVector3(G.camera.position.clone().sub(G.controls.target)),b:new THREE.Spherical().setFromVector3(pos.clone().sub(tgt)),ta:G.controls.target.clone(),tb:tgt.clone(),t0:performance.now(),dur,intro};
  }
  function ovPos(){const f=Math.max(1.25,1.3/(G.camera.aspect||1));return V().set(OV_P.x,OV_T.y+(OV_P.y-OV_T.y)*f,OV_T.z+(OV_P.z-OV_T.z)*f);}
  // Otomatik kamera: oynarken her aşamada işlem gören dişe ya da çeneye yaklaşır, açısını değiştirir.
  // Her olay için hedef bir kadraj hesaplanır; kamera oraya yumuşakça süzülür.
  const shotOf=(pos,tgt)=>({off:new THREE.Spherical().setFromVector3(pos.clone().sub(tgt)),tgt});
  const camFit=()=>Math.max(1,1.3/(G.camera.aspect||1));
  function toothShot(o,dist,lift=0){
    const fit=camFit(),w=toothWorld(o),up=V().set(0,1,0);
    // diş dışarıdan ve biraz yandan görülür; aletler önünü kapatmaz
    const out=V().set(w.x,0,w.z+8).normalize().applyAxisAngle(up,(w.x<0?-1:1)*.32);
    const tgt=(o.imp?o.holder.localToWorld(V().set(0,o.h*.15,0)):w.clone()).add(V().set(0,lift,0));
    return shotOf(w.clone().add(out.multiplyScalar(dist*fit)).add(V().set(0,(o.upper?-20:18)*fit,0)),tgt);
  }
  function archShot(a,yaw){
    const fit=camFit(),d=92*fit,ts=Object.values(G.T).filter(o=>o.upper===(a==="U")&&o.n%10<=6),c=V();
    ts.forEach(o=>c.add(toothWorld(o)));c.divideScalar(ts.length);
    return shotOf(c.clone().add(V().set(Math.sin(yaw)*d,(a==="U"?-22:36)*fit,Math.cos(yaw)*d)),c);
  }
  function wideShot(yaw){
    const tgt=V().set(OV_T.x,OV_T.y,OV_T.z);
    return shotOf(ovPos().sub(tgt).multiplyScalar(.92).applyAxisAngle(V().set(0,1,0),yaw).add(tgt),tgt);
  }
  function shotFor(e,t){
    const fn=activeTooth(e,t),key=e.start+"|"+(fn||"");
    if(G.shotKey===key)return G.shot;
    G.shotKey=key;
    const arch=n=>n<30?"U":"L",o=fn&&G.T[fn];
    if(e.stag&&o){const x=toothWorld(o).x;G.shot=archShot(arch(fn),clamp((x+28)/56)*1.1-.55);}
    else if(e.bridge)G.shot=archShot(e.bridge,e.bridge==="U"?-.3:.3);
    else if(o)G.shot=e.ch==="sinus"?toothShot(o,92,12):toothShot(o,76);
    else if(e.set&&e.set.length===1)G.shot=toothShot(G.T[e.set[0]],90);
    else if(e.set&&e.set.length&&e.set.every(n=>arch(n)===arch(e.set[0])))G.shot=archShot(arch(e.set[0]),.25);
    else G.shot=wideShot(e.ch==="scan"?-.3:e.ch==="lab"?.3:e.ch==="done"?.22:0);
    return G.shot;
  }
  function autoCam(e,t,dt){
    const {off,tgt}=shotFor(e,t),k=1-Math.exp(-dt*.0024),sc=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    let dth=off.theta-sc.theta;dth=Math.atan2(Math.sin(dth),Math.cos(dth));
    sc.theta+=dth*k;sc.phi=lerp(sc.phi,off.phi,k);sc.radius=lerp(sc.radius,off.radius,k);
    controls.target.lerp(tgt,k);
    camera.position.copy(controls.target).add(V().setFromSpherical(sc));
  }
  function camOverview(){if(G)camGo(ovPos(),V().set(OV_T.x,OV_T.y,OV_T.z));}
  function camTooth(n){
    if(!G||!G.T[n])return;
    const o=G.T[n],w=toothWorld(o),out=V().set(w.x,0,w.z+8).normalize();
    const tgt=o.imp?o.holder.localToWorld(V().set(0,o.h*.15,0)):w.clone().add(V().set(0,o.upper?-2:2,0));
    camGo(w.clone().add(out.multiplyScalar(52)).add(V().set(0,o.upper?-16:14,0)),tgt);
  }


  function frame(now) {
    raf = requestAnimationFrame(frame);
    const raw = now - G.last, dt = Math.min(64, raw); G.last = now;
    const st = driver(dt);
    if (!st.e || !G.root) { controls.update(); renderer.render(scene, camera); return; }
    step(now, dt, raw, st);
  }
  function step(now, dt, raw, { t, e, idle, playing, speed = 1 }) {
    updTeeth(t);
    // röntgen görünüm: çekim, greft, cerrahi, iyileşme ve dayanak aşamalarında dişeti saydamlaşır
    const xr = ["ext", "graft", "sinus", "gheal", "rct", "surgery", "heal", "abut"].includes(e.ch);
    gumOp = lerp(gumOp, xr ? 0.2 : 1, 1 - Math.exp(-dt * 0.004));
    M.gum.opacity = gumOp; M.bone.opacity = lerp(0.32, 1, (gumOp - 0.2) / 0.8);
    M.gum.depthWrite = M.bone.depthWrite = gumOp > 0.97;
    M.bone.visible = M.root.visible = gumOp < 0.97;
    if (cap) cap.xray = gumOp <= 0.9; else if (xrayEl) xrayEl.hidden = gumOp > 0.9;
    // tarama ışığı
    G.scan.visible = !!e.scan && !idle;
    if (e.scan) { const ph = (t - e.start) / 1600; G.scan.position.set(0, 12, lerp(34, -48, 0.5 - 0.5 * Math.cos(ph * Math.PI))); }
    // kamera kullanıcıda; yalnızca butonla başlatılan yumuşak geçiş
    if (G.tw) {
      const k = ease(clamp((now - G.tw.t0) / G.tw.dur));
      const sc = G.tw.a.clone(), d = G.tw.b;
      let dth = d.theta - sc.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
      sc.theta += dth * k; sc.phi = lerp(sc.phi, d.phi, k); sc.radius = lerp(sc.radius, d.radius, k);
      controls.target.lerpVectors(G.tw.ta, G.tw.tb, k);
      camera.position.copy(controls.target).add(V().setFromSpherical(sc));
      if (k >= 1) {
        // açılış geçişi bitince, oynatılana ya da kullanıcı dokunana kadar hafif salınım
        if (G.tw.intro && !REDUCED) G.sway = { base: camera.position.clone().sub(controls.target), t0: now };
        G.tw = null;
      }
    } else if (G.sway) {
      if (!idle) G.sway = null;
      else {
        // iki salınımdan sonra durur; boşta bekleyen sekme ekran kartını yormaz
        const el = now - G.sway.t0;
        camera.position.copy(controls.target).add(G.sway.base.clone().applyAxisAngle(V().set(0, 1, 0), Math.sin(el * 0.00045) * 0.3));
        if (el > 27900) G.sway = null;
      }
    } else if (playing && G.auto) autoCam(e, t, dt * speed);
    // işlem gören dişin çevresinde nabız gibi atan halka
    const fn = activeTooth(e, t), fo = fn && G.T[fn];
    G.ring.visible = !!fo;
    if (fo) {
      if (G.ring.parent !== fo.holder) fo.holder.add(G.ring);
      const R = Math.max(fo.w, fo.d) * 0.72, pulse = playing ? 0.5 + 0.5 * Math.sin(now * 0.005) : 0.5;
      G.ring.position.y = 0.6;
      G.ring.scale.set(R * (1 + 0.06 * pulse), R * (1 + 0.06 * pulse), 1);
      M.ring.opacity = 0.35 + 0.35 * pulse;
    }
    controls.update();
    // işlem gören dişin etiketi: animasyonu kapatmaması için ekranda dişten dışarı doğru kaydırılır, ince çizgiyle dişe bağlanır
    if (labelEl) {
      if (fo) {
        const W = cap ? cap.w : container.clientWidth, H = cap ? cap.h : container.clientHeight, p = toothWorld(fo).project(camera);
        const sx = (p.x + 1) / 2 * W, sy = (1 - p.y) / 2 * H;
        let dx = sx - W / 2, dy = sy - H / 2, L = Math.hypot(dx, dy);
        if (L < 40) { dx = 1; dy = 0; L = 1; }
        const D = W < 520 ? 80 : 120;
        const lx = Math.min(W - 56, Math.max(56, sx + dx / L * D)), ly = Math.min(H - 64, Math.max(48, sy + dy / L * D));
        if (cap) cap.label = { text: `Tooth ${fn}`, lx, ly, sx, sy };
        else { labelEl.hidden = false; labelEl.textContent = `Tooth ${fn}`; }
        if (!cap) labelEl.style.left = lx + "px"; labelEl.style.top = ly + "px";
        if (leaderEl && !cap) {
          const vx = sx - lx, vy = sy - ly, len = Math.hypot(vx, vy) - 14;
          leaderEl.hidden = len < 16;
          leaderEl.style.left = lx + "px"; leaderEl.style.top = ly + "px";
          leaderEl.style.width = len + "px"; leaderEl.style.transform = `rotate(${Math.atan2(vy, vx)}rad)`;
        }
      } else if (cap) cap.label = null;
      else { labelEl.hidden = true; if (leaderEl) leaderEl.hidden = true; }
    }
    // duraklatılmış ve hareketsiz sahne yeniden çizilmez (pil / ısı tasarrufu); zaman atlandıysa da çizilir
    const settled = Math.abs(gumOp - (xr ? 0.2 : 1)) < 0.002, moved = t !== G.lastT;
    if (cap || onScreen && (playing || G.wasPlaying || moved || G.tw || G.sway || G.dirty || !settled)) {
      // gölge kamera dönerken değişmez; dişler hareket ederken iki karede bir güncellenir
      G.frame = (G.frame || 0) + 1;
      renderer.shadowMap.needsUpdate = G.dirty || G.wasPlaying !== playing || (moved && G.frame % 2 === 0);
      renderer.render(scene, camera);
      if (G.drew && !cap) watchSpeed(now, raw);
      G.drew = true;
    } else G.drew = false;
    G.wasPlaying = playing; G.lastT = t; G.dirty = false;
  }
  raf = requestAnimationFrame(frame);

  return {
    /** Planı ve zaman çizelgesindeki diş olaylarını yükler, modeli yeniden kurar */
    build(plan, te, fmr = null, mouth = {}) {
      PLAN = plan; TE = te; FMR = fmr; MOUTH = mouth; gumOp = 1;
      buildJaw(); G.dirty = true;
      const tgt = V().set(OV_T.x, OV_T.y, OV_T.z);
      controls.target.copy(tgt);
      if (REDUCED) { camera.position.copy(ovPos()); return; }
      // açılış: uzaktan ve yandan modele süzülerek gelir
      camera.position.copy(ovPos().sub(tgt).multiplyScalar(1.45).applyAxisAngle(V().set(0, 1, 0), 0.55).add(V().set(0, 18, 0)).add(tgt));
      camGo(ovPos(), tgt, 1900, true);
    },
    camOverview,
    camTooth,
    /** Oynatma başlarken otomatik kamerayı açar */
    autoCamera() { G.auto = true; G.shotKey = null; },
    /** Video kaydını başlatır: canlı döngü durur, sahne verilen boyutta genel görünümden çizilir */
    beginCapture(w, h) {
      cancelAnimationFrame(raf);
      cap = { w, h, now: 0, label: null, xray: false, pos: camera.position.clone(), tgt: controls.target.clone(), auto: G.auto };
      G.tw = G.sway = null; G.auto = true; G.shotKey = null; gumOp = 1; G.dirty = true;
      if (labelEl) labelEl.hidden = true;
      if (leaderEl) leaderEl.hidden = true;
      renderer.setPixelRatio(1); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      controls.target.set(OV_T.x, OV_T.y, OV_T.z); camera.position.copy(ovPos());
      return canvas;
    },
    /** Tek kare çizer; canvas aynı görevde okunmalıdır */
    captureFrame(t, e, dt) {
      cap.now += dt;
      step(cap.now, dt, dt, { t, e, idle: false, playing: true });
      return { label: cap.label, xray: cap.xray };
    },
    endCapture() {
      if (!cap || dead) return;
      const { pos, tgt, auto } = cap;
      cap = null; G.auto = auto; G.shotKey = null;
      controls.target.copy(tgt); camera.position.copy(pos);
      renderer.setPixelRatio(pixelRatio()); resize();
      G.last = performance.now(); G.dirty = true;
      raf = requestAnimationFrame(frame);
    },
    /** Tüm GPU kaynaklarını bırakır ve WebGL bağlamını kapatır (tarayıcının bağlam sınırına takılmamak için) */
    dispose() {
      dead = true;
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      const done = new Set();
      const free = (x) => { if (x && !done.has(x)) { done.add(x); x.dispose(); } };
      const freeMat = (m) => { free(m); ["map", "bumpMap"].forEach((k) => free(m[k])); };
      [scene, G.bur, G.ring].forEach((root) => root.traverse((o) => { if (o.isMesh) { free(o.geometry); [].concat(o.material).forEach(freeMat); } }));
      Object.values(GEO).forEach(free);
      Object.values(G.bridges || {}).forEach((b) => [b.tt, b.tf, b.ft, b.ff].forEach(freeMat));
      Object.values(M).forEach((m) => { if (m && m.isMaterial) freeMat(m); });
      free(scene.environment); pm.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
