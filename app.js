const LS = 'mala.v1', GOAL = 108;
const DEF = {count:0, malas:0, chants:0, mode:'guided', speed:4, muted:false, script:'dev', mantra:0};
let st = {...DEF, ...JSON.parse(localStorage.getItem(LS) || '{}')};
const save = () => localStorage.setItem(LS, JSON.stringify(st));

const ALL = [
  {dev:'ॐ नमः शिवाय', mal:'ഓം നമഃ ശിവായ', eng:'Om Namah Shivaya', audio:'audio/om-namah-shivaya.mp3'},
  {dev:'स्वामिये शरणम् अय्यप्पा', mal:'സ്വാമിയേ ശരണം അയ്യപ്പാ', eng:'Swamiye Saranam Ayyappa', audio:'audio/swamiye-saranam-ayyappa.mp3'},
  {dev:'सीता राम', mal:'സീതാ രാം', eng:'Sita Ram', audio:'audio/sita-ram.mp3'},
  {dev:'श्री राम जय राम जय जय राम', mal:'ശ്രീ രാം ജയ് രാം ജയ് ജയ് രാം', eng:'Shri Ram Jai Ram Jai Jai Ram', audio:'audio/shri-ram-jai-ram.mp3'}
];
const MANTRAS = ALL;
if (st.mantra >= MANTRAS.length) st.mantra = 0;
const cur = () => MANTRAS[st.mantra] || MANTRAS[0];

// one chant forward; pure so it stays testable (?test)
function advance(s){
  let count = s.count + 1, malas = s.malas, full = false;
  if (count >= GOAL){ count = 0; malas += 1; full = true; }
  return {count, malas, chants: s.chants + 1, full};
}

const $ = id => document.getElementById(id);
const path = $('p'), L = path.getTotalLength(), dot = $('dot'), sign = $('sign');
let playing = false, raf = null, t0 = 0, lock = null;

// optional audio: element fires error when the file is absent, so the button stays hidden
let sndLen = 0;
const a = new Audio();
a.preload = 'auto';
a.addEventListener('loadedmetadata', () => { sndLen = a.duration || 0; render(); });
a.addEventListener('error', () => { sndLen = 0; render(); });
function loadAudio(){ sndLen = 0; a.pause(); a.src = cur().audio; a.load(); }

const audioOn = () => sndLen > 1 && !st.muted;
const tripMs = () => (audioOn() ? sndLen * 1000 : st.speed * 1000);

async function wake(on){
  try{
    if (on && !lock && 'wakeLock' in navigator){
      lock = await navigator.wakeLock.request('screen');
      lock.onrelease = () => { lock = null; };
    } else if (!on && lock){ lock.release(); lock = null; }
  }catch{}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && playing) wake(true); });

function trip(){
  if (raf) return;
  if (audioOn()){ a.currentTime = 0; a.play().catch(()=>{}); }
  t0 = performance.now();
  raf = requestAnimationFrame(step);
}
function step(ts){
  const k = Math.min(1, (ts - t0) / tripMs());
  const pt = path.getPointAtLength(k * L);
  dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
  if (k < 1){ raf = requestAnimationFrame(step); return; }
  raf = null;
  chant();
  if (playing) trip();
}
function chant(){
  const n = advance(st);
  st.count = n.count; st.malas = n.malas; st.chants = n.chants;
  if (n.full){ bloom(); playing = false; wake(false); }
  save(); render();
}
function bloom(){ sign.classList.remove('bloom'); void sign.getBBox(); sign.classList.add('bloom'); }

sign.onclick = () => { if (!playing) trip(); };
$('play').onclick = () => { playing = !playing; wake(playing); if (playing) trip(); render(); };
$('mode').onclick = () => { st.mode = st.mode === 'guided' ? 'beads' : 'guided'; playing = false; wake(false); save(); render(); };
$('mute').onclick = () => { st.muted = !st.muted; if (st.muted) a.pause(); save(); render(); };
$('speed').oninput = e => { st.speed = +e.target.value; save(); };
$('bead').onclick = () => {
  st.chants += GOAL - st.count; st.count = 0; st.malas += 1;
  save(); bloom(); render();
};
$('mantra').onclick = () => {
  st.mantra = (st.mantra + 1) % MANTRAS.length;
  playing = false; wake(false); save(); loadAudio(); render();
};
for (const b of document.querySelectorAll('#scripts button'))
  b.onclick = () => { st.script = b.dataset.s; save(); render(); };

let hold = null;
const stats = document.querySelector('.stats');
const startHold = () => { hold = setTimeout(() => {
  st.count = 0; st.malas = 0; st.chants = 0; playing = false; wake(false);
  save(); bloom(); render();
}, 800); };
const endHold = () => { clearTimeout(hold); hold = null; };
stats.addEventListener('pointerdown', startHold);
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) stats.addEventListener(ev, endHold);

function render(){
  const beads = st.mode === 'beads';
  $('mantra').textContent = cur()[st.script];
  document.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', i === st.mantra));
  $('count').textContent = st.count;
  const ring = (cur()[st.script] + '  ♦  ').repeat(14);
  for (const t of document.querySelectorAll('.ring textPath')) t.textContent = ring;
  document.querySelector('#bar i').style.width = (st.count / GOAL * 100) + '%';
  $('sMalas').textContent = st.malas;
  $('sChants').textContent = st.chants;
  $('mode').classList.toggle('on', beads);
  $('play').hidden = beads;
  $('speed').hidden = beads || audioOn();
  $('bead').hidden = !beads;
  $('play').classList.toggle('on', playing);
  $('mute').hidden = sndLen <= 1;
  $('mute').classList.toggle('on', st.muted);
  $('speed').value = st.speed;
  $('mantra').onclick = () => {
  st.mantra = (st.mantra + 1) % MANTRAS.length;
  playing = false; wake(false); save(); loadAudio(); render();
};
for (const b of document.querySelectorAll('#scripts button')) b.classList.toggle('on', b.dataset.s === st.script);
}
$('dots').innerHTML = MANTRAS.map(() => '<i></i>').join('');
loadAudio();
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

if (location.search.includes('test')){
  const r = advance({count:107, malas:2, chants:500});
  console.assert(r.count === 0 && r.malas === 3 && r.chants === 501 && r.full, 'mala rollover');
  const q = advance({count:0, malas:0, chants:0});
  console.assert(q.count === 1 && !q.full, 'plain chant');
  console.log('tests ok');
}
