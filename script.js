/* LifeGrid AI – prototype. Data is stored only in this browser (localStorage). */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
const sv = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tel = s => String(s || '').replace(/[^\d+]/g, '');
const wa = s => { const d = tel(s).replace('+', ''); return d.length === 10 ? '91' + d : d };
const BG = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

let profiles = ls('lg_profiles', []), alerts = ls('lg_alerts', []);
let cur = null, pic = '', lang = 'en', lastPos = null, talkMsg = '', selBG = null;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600) }
function speak(t) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'; speechSynthesis.speak(u);
}

/* ---------- Tabs ---------- */
$$('#nav button').forEach(b => b.onclick = () => {
  $$('#nav button,.tab').forEach(e => e.classList.remove('on'));
  b.classList.add('on'); $('#' + b.dataset.t).classList.add('on');
  if (b.dataset.t === 'hosp') initMap();
});

/* ---------- Location ---------- */
const setPos = p => {
  lastPos = { lat: p.coords.latitude, lng: p.coords.longitude };
  $('#loc').textContent = `📍 ${lastPos.lat.toFixed(5)}, ${lastPos.lng.toFixed(5)}`;
  return lastPos;
};
const getPos = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('Location is not supported on this device'));
  navigator.geolocation.getCurrentPosition(p => res(setPos(p)), rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
});

/* ---------- Live location tracking ---------- */
let wid = null;
$('#track').onclick = function () {
  if (wid !== null) {
    navigator.geolocation.clearWatch(wid); wid = null;
    this.textContent = '📡 Start live location'; $('#live').textContent = 'Not tracking'; $('#lmap').hidden = true; return;
  }
  if (!navigator.geolocation) return toast('Location is not supported on this device');
  wid = navigator.geolocation.watchPosition(p => {
    const pos = setPos(p);
    $('#live').textContent = `Live · accuracy ±${Math.round(p.coords.accuracy)} m · ${new Date().toLocaleTimeString()}`;
    $('#lmap').href = `https://maps.google.com/?q=${pos.lat},${pos.lng}`; $('#lmap').hidden = false;
  }, () => toast('Please allow location permission'), { enableHighAccuracy: true, maximumAge: 5000 });
  this.textContent = '⏹ Stop live location';
};

/* ---------- Profiles ---------- */
const F = ['name', 'age', 'gender', 'bg', 'address', 'medical', 'allergy', 'c1n', 'c1p', 'c2n', 'c2p'];
$('#bg').innerHTML = '<option value="">Blood group</option>' + BG.map(b => `<option>${b}</option>`).join('');

function fillForm(p) {
  F.forEach(k => $('#' + k).value = p ? p[k] || '' : '');
  pic = p ? p.photo || '' : ''; cur = p ? p.id : null;
  $('#pv').src = pic; $('#pv').style.display = pic ? 'block' : 'none';
}
$('#photo').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const i = new Image();
    i.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const s = Math.min(i.width, i.height);
      c.getContext('2d').drawImage(i, (i.width - s) / 2, (i.height - s) / 2, s, s, 0, 0, 160, 160);
      pic = c.toDataURL('image/jpeg', .7); $('#pv').src = pic; $('#pv').style.display = 'block';
    };
    i.src = r.result;
  };
  r.readAsDataURL(f);
};
$('#pform').onsubmit = e => {
  e.preventDefault();
  const p = { id: cur || Date.now(), photo: pic };
  F.forEach(k => p[k] = $('#' + k).value.trim());
  const i = profiles.findIndex(x => x.id === p.id);
  i < 0 ? profiles.push(p) : profiles[i] = p;
  cur = p.id; sv('lg_profiles', profiles); toast('Profile saved ✔'); renderAll();
};
$('#newp').onclick = () => fillForm(null);
$('#plist').onclick = e => {
  const d = e.target.dataset;
  if (d.e) { fillForm(profiles.find(p => p.id == d.e)); scrollTo(0, 0) }
  if (d.d && confirm('Delete this profile?')) {
    profiles = profiles.filter(p => p.id != d.d); sv('lg_profiles', profiles);
    if (cur == d.d) fillForm(null); renderAll();
  }
};
const card = (p, extra = '') => `<div class="pc">${p.photo ? `<img src="${p.photo}" alt="">` : '<span class="av">👤</span>'}<div><b>${esc(p.name)}</b><br><small>${esc(p.gender)} ${esc(p.age)} yrs · Blood ${esc(p.bg)}</small></div>${extra}</div>`;
function renderProfiles() {
  $('#plist').innerHTML = profiles.map(p => card(p, `<button class="mini" data-e="${p.id}">Edit</button><button class="mini del" data-d="${p.id}">✕</button>`)).join('') || '<p class="note">No profiles saved yet.</p>';
}

/* ---------- QR emergency card ---------- */
$('#qrb').onclick = () => {
  const p = profiles.find(x => x.id === cur) || profiles[0];
  if (!p) return toast('Save a profile first');
  if (typeof QRCode === 'undefined') return toast('QR needs internet to load');
  const t = `EMERGENCY CARD\n${p.name}, ${p.age}y ${p.gender}\nBlood: ${p.bg}\nMedical: ${p.medical}\nAllergy: ${p.allergy}\nCall: ${p.c1n} ${p.c1p}`.slice(0, 300);
  $('#qr').innerHTML = ''; new QRCode($('#qr'), { text: t, width: 200, height: 200 }); $('#qrn').hidden = false;
};

/* ---------- Blood finder ---------- */
function renderBlood() {
  $('#chips').innerHTML = BG.map(b => `<button class="chip ${b === selBG ? 'on' : ''}" data-b="${b}">${b}<small>${profiles.filter(p => p.bg === b).length}</small></button>`).join('');
  const r = profiles.filter(p => p.bg === selBG);
  $('#bres').innerHTML = !selBG ? '' : r.map(p => card(p, p.c1p ? `<a class="mini" href="tel:${tel(p.c1p)}">📞 Call</a>` : '')).join('') || `<p class="note">No saved profile with ${selBG}.</p>`;
}
$('#chips').onclick = e => { const b = e.target.closest('[data-b]'); if (b) { selBG = b.dataset.b; renderBlood() } };

/* ---------- Speak for me ---------- */
const T = [['🫀', 'Chest pain', 'நெஞ்சு வலிக்கிறது'], ['🤕', 'I fell down', 'நான் கீழே விழுந்துவிட்டேன்'], ['😮‍💨', "I can't breathe", 'எனக்கு மூச்சு விட முடியவில்லை'], ['💧', 'I need water', 'எனக்கு தண்ணீர் வேண்டும்'], ['💊', 'I need my medicine', 'எனக்கு மருந்து வேண்டும்'], ['👨‍👩‍👧', 'Call my family', 'என் குடும்பத்தை அழையுங்கள்'], ['🏥', 'Take me to hospital', 'என்னை மருத்துவமனைக்கு அழைத்துச் செல்லுங்கள்'], ['😵', 'I feel dizzy', 'எனக்கு தலை சுற்றுகிறது']];
$('#tiles').innerHTML = T.map((t, i) => `<button class="tile" data-i="${i}"><span>${t[0]}</span>${t[1]}</button>`).join('');
$('#tiles').onclick = e => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  const t = T[b.dataset.i]; talkMsg = t[1];
  $('#saybox').textContent = lang === 'ta' ? t[2] : t[1]; speak(lang === 'ta' ? t[2] : t[1]);
};
$$('[data-l]').forEach(b => b.onclick = () => { lang = b.dataset.l; $$('[data-l]').forEach(x => x.classList.toggle('on', x === b)) });

/* ---------- SOS flow ---------- */
let tmr, secs;
function startSOS(why = 'Button pressed') {
  if ($('#ov').classList.contains('on')) return;
  $('#why').textContent = why; $('#cdwrap').style.display = 'block'; $('#res').innerHTML = '';
  $('#ov').classList.add('on'); secs = 10; $('#cdn').textContent = secs;
  getPos().catch(() => { });
  speak('Emergency alert. Cancel if you are safe.');
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  tmr = setInterval(() => { secs--; $('#cdn').textContent = secs; if (secs <= 0) fire(why) }, 1000);
}
async function fire(why) {
  clearInterval(tmr); $('#cdwrap').style.display = 'none';
  let pos = lastPos; try { pos = await getPos() } catch { }
  const p = profiles.find(x => x.id === cur) || profiles[0] || {};
  const link = pos ? `https://maps.google.com/?q=${pos.lat},${pos.lng}` : '';
  const msg = `EMERGENCY! ${p.name || 'Someone'} needs help (${why}). Blood: ${p.bg || '?'}. Medical: ${p.medical || '-'}. Allergies: ${p.allergy || '-'}.${talkMsg ? ' Says: ' + talkMsg + '.' : ''} Location: ${link || 'not available'}`;
  alerts.unshift({ t: Date.now(), why, link, name: p.name || 'Unknown', bg: p.bg || '', phone: p.c1p || '' });
  alerts = alerts.slice(0, 30); sv('lg_alerts', alerts); renderLog();
  const cs = [[p.c1n, p.c1p], [p.c2n, p.c2p]].filter(c => c[1]);
  $('#res').innerHTML = `<h2>Alert ready</h2><p class="note">${esc(msg)}</p>
    <a class="btn big white" href="tel:112">📞 Call 112 now</a><a class="btn" href="tel:108">🚑 Call 108</a>` +
    cs.map(c => `<a class="btn" href="sms:${tel(c[1])}?body=${encodeURIComponent(msg)}">💬 SMS ${esc(c[0] || c[1])}</a><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${wa(c[1])}?text=${encodeURIComponent(msg)}">🟢 WhatsApp ${esc(c[0] || c[1])}</a>`).join('') +
    (cs.length ? '' : '<p class="note">Add emergency contacts in Profile.</p>') + '<button class="btn" id="close">Close</button>';
}
$('#sos').onclick = () => startSOS();
$('#now').onclick = () => fire($('#why').textContent);
$('#cancel').onclick = () => { clearInterval(tmr); $('#ov').classList.remove('on') };
$('#res').onclick = e => { if (e.target.id === 'close') $('#ov').classList.remove('on') };

/* ---------- Fall + shake detection ---------- */
let motion = false, hits = [], lastHit = 0, lastLow = 0, cool = 0;
function onMotion(e) {
  const g = e.accelerationIncludingGravity; if (!g) return;
  const a = Math.hypot(g.x || 0, g.y || 0, g.z || 0), n = Date.now();
  if (n < cool) return;
  if ($('#fall').checked) {
    if (a < 3) lastLow = n;
    if (a > 30 && n - lastLow < 1000) { cool = n + 20000; return startSOS('Fall detected') }
  }
  if ($('#shake').checked && a > 24 && n - lastHit > 150) {
    lastHit = n; hits = hits.filter(t => n - t < 2000); hits.push(n);
    if (hits.length >= 5) { hits = []; cool = n + 20000; startSOS('Phone shaken') }
  }
}
async function motionOn() {
  if (motion) return true;
  try {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (DeviceMotionEvent.requestPermission && await DeviceMotionEvent.requestPermission() !== 'granted') return false;
  } catch { return false }
  addEventListener('devicemotion', onMotion); motion = true; return true;
}
['fall', 'shake'].forEach(id => $('#' + id).onchange = async e => {
  if (e.target.checked && !await motionOn()) { e.target.checked = false; toast('Motion sensor unavailable or permission denied') }
});

/* ---------- Voice trigger ---------- */
let rec;
$('#voice').onchange = e => {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { e.target.checked = false; return toast('Voice needs Chrome') }
  if (e.target.checked) {
    rec = new R(); rec.continuous = true; rec.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
    rec.onresult = ev => { const t = [...ev.results].pop()[0].transcript.toLowerCase(); if (/help|உதவி|காப்பாற்று|காப்பாத்து/.test(t)) startSOS('Voice command') };
    rec.onend = () => { if ($('#voice').checked) try { rec.start() } catch { } };
    rec.start();
  } else if (rec) rec.stop();
};

/* ---------- Daily check-in ---------- */
function renderCI() {
  const t = ls('lg_ci', 0), same = t && new Date(t).toDateString() === new Date().toDateString();
  $('#ci').textContent = !t ? 'No check-in yet.' : same ? '✅ Checked in today at ' + new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '⚠️ No check-in today yet.';
}
$('#checkin').onclick = () => { sv('lg_ci', Date.now()); renderCI(); toast('Check-in saved') };

/* ---------- Siren ---------- */
let au, osc;
$('#siren').onclick = function () {
  if (osc) { osc.stop(); osc = null; au.close(); this.textContent = '🔊 Start siren'; return }
  au = new AudioContext(); osc = au.createOscillator(); osc.type = 'square';
  const g = au.createGain(); g.gain.value = .3; osc.connect(g).connect(au.destination); osc.start();
  let h = 0; (function f() { if (!osc) return; osc.frequency.value = h++ % 2 ? 600 : 900; setTimeout(f, 450) })();
  this.textContent = '⏹ Stop siren';
};

/* ---------- Hospitals map (OpenStreetMap + Overpass, no API key) ---------- */
let mp;
function initMap() {
  if (mp || typeof L === 'undefined') return;
  mp = L.map('mapbox').setView([20.59, 78.96], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mp);
}
const km = (a, b, c, d) => { const r = x => x * Math.PI / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)) };
$('#findh').onclick = async () => {
  initMap(); $('#hl').innerHTML = '<p class="note">Searching…</p>';
  try {
    const p = await getPos(); mp.setView([p.lat, p.lng], 14);
    L.circleMarker([p.lat, p.lng], { color: '#d7263d' }).addTo(mp).bindPopup('You are here');
    const q = `[out:json];node["amenity"="hospital"](around:6000,${p.lat},${p.lng});out 20;`;
    const d = await (await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) })).json();
    const hs = d.elements.map(h => ({ n: h.tags.name || 'Hospital', la: h.lat, lo: h.lon, d: km(p.lat, p.lng, h.lat, h.lon) })).sort((a, b) => a.d - b.d);
    hs.forEach(h => L.marker([h.la, h.lo]).addTo(mp).bindPopup(esc(h.n)));
    $('#hl').innerHTML = hs.map(h => `<div class="pc"><span class="av">🏥</span><div><b>${esc(h.n)}</b><br><small>${h.d.toFixed(1)} km</small></div><a class="mini" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${h.la},${h.lo}">Directions</a></div>`).join('') || '<p class="note">No hospitals found within 6 km. Call 112.</p>';
  } catch { $('#hl').innerHTML = '<p class="note">Could not get location or hospital data. Allow location and check internet.</p>' }
};

/* ---------- First aid ---------- */
const AID = [
  ['Heart attack / no breathing (CPR)', 'Call 112 first. Lay the person on a firm surface. Push hard and fast in the centre of the chest, about 2 push per second. Do not stop until help arrives.'],
  ['Seizure', 'Move hard objects away. Cushion the head. Do not hold the person or put anything in the mouth. Turn them on their side when shaking stops. Call 112 if it lasts over 5 minutes.'],
  ['Burns', 'Cool the burn under running water for 20 minutes. Cover loosely with a clean cloth. Do not apply ice, butter or toothpaste. Call 112 for large or deep burns.'],
  ['Heavy bleeding', 'Press firmly on the wound with a clean cloth. Do not remove the cloth if it soaks through, add more on top. Raise the injured limb. Call 112.'],
  ['Choking', 'If the person cannot cough or speak, give 5 firm back blows, then 5 abdominal thrusts. Repeat. Call 112.']
];
$('#aidl').innerHTML = AID.map((a, i) => `<details><summary>${a[0]}</summary><p>${a[1]}</p><button class="mini" data-s="${i}">🔊 Read aloud</button></details>`).join('');
$('#aidl').onclick = e => { const s = e.target.dataset.s; if (s) {