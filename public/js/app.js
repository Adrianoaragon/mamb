/* =====================================================
   MAMB — app.js
   ===================================================== */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isApp = () => document.body.classList.contains('app-body');
const API_BASE = window.location.port === '5500' ? 'http://localhost:3000' : '';

function assetUrl(url) {
  if (!url || url.startsWith('data:') || /^https?:\/\//.test(url)) return url;
  return `${API_BASE}${url}`;
}

/* ─── SPLASH ─── */
function initSplash() {
  const splash  = isApp() ? $('#appSplash') : $('#splash');
  const wrapper = isApp() ? $('#appWrapper') : null;
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add('gone');
    if (wrapper) wrapper.classList.remove('hidden');
  }, 1600);
}

/* ─── NAVBAR (index.html only) ─── */
function initNavbar() {
  const navbar     = $('#navbar');
  const burger     = $('#burger');
  const mobileMenu = $('#mobileMenu');
  if (!navbar) return;

  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    navbar.style.transform = (y > lastY && y > 100) ? 'translateY(-100%)' : '';
    lastY = y;
  }, { passive: true });

  burger?.addEventListener('click', () => mobileMenu?.classList.toggle('open'));
}

/* ─── TABS (index.html) ─── */
function initTabs() {
  const tabs = $$('.tab-btn');
  if (!tabs.length) return;
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.dataset.tab;
      $$('.tab-pane').forEach(p => p.classList.remove('active'));
      $(`#tab-${id}`)?.classList.add('active');
    });
  });
}

/* ─── SCROLL ANIMATIONS ─── */
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });

  $$('.col-item, .artist-card, .visit-item, .ib-text, .ib-visual').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity .6s ease, transform .6s ease';
    observer.observe(el);
  });
}

/* ══════════════════════════════════════════════════
   APP — INTERACTIVO
   ══════════════════════════════════════════════════ */

const state = {
  currentImage:      null,
  resultImage:       null,
  currentTitle:      '',
  currentAutor:      '',
  currentStyle:      'Vincent van Gogh',
  aiPrediction:      null,
  aiPredictions:     [],
  resultDescription: '',
  resultTags:        [],
  detailObra:        null,
  allObras:          [],   // cache for detail navigation
};

const TM_MODEL_URL = './my_model/';
let tmModel = null;
let tmModelPromise = null;

const ARTIST_STYLES = {
  'Leonardo da Vinci': {
    palette: ['#2d2a22', '#75664a', '#bfa36a', '#e6d6a6', '#5d6b57', '#2f4c46', '#14120f'],
    description: 'Tu dibujo fue interpretado con una mirada renacentista: luces suaves, misterio y detalles delicados como si saliera de un taller italiano.',
    tags: ['renacimiento', 'sfumato', 'detalle'],
  },
  'Vincent van Gogh': {
    palette: ['#173f8a', '#1f6fb2', '#f2c84b', '#f08a24', '#2d8a5a', '#111f4a', '#fff1a8'],
    description: 'La IA encontró una energía vibrante en tu dibujo y lo llevó a pinceladas intensas, cielos en movimiento y colores llenos de emoción.',
    tags: ['postimpresionismo', 'pincelada', 'color'],
  },
  'Diego Velázquez': {
    palette: ['#2b211c', '#5a3b2e', '#8c6847', '#c7a06a', '#ded2bd', '#1a1a1a', '#6f2632'],
    description: 'Tu obra toma un aire clásico y teatral: sombras profundas, tonos cálidos y una presencia digna de retrato de museo.',
    tags: ['barroco', 'retrato', 'luz'],
  },
  'Pablo Picasso': {
    palette: ['#202c5a', '#d94b3d', '#f0c94a', '#2f9f8f', '#f4eee2', '#1c1c1c', '#8b5fbf'],
    description: 'La IA transformó tu imagen con formas audaces y planos expresivos, como una composición moderna llena de carácter.',
    tags: ['cubismo', 'formas', 'moderno'],
  },
};

/* ── SCREEN NAVIGATION ── */
function showScreen(id) {
  $$('.app-screen').forEach(s => s.classList.remove('active'));
  const target = $(`#${id}`);
  if (target) { target.classList.add('active'); target.scrollTop = 0; }
}

async function showMuseumScreen() {
  sessionStorage.setItem('mambLastScreen', 'screen-museo');
  await loadGallery();
  showScreen('screen-museo');
}

async function restoreLastScreen() {
  const lastScreen = sessionStorage.getItem('mambLastScreen');
  if (lastScreen !== 'screen-museo') return;
  await showMuseumScreen();
}

function initBackButtons() {
  $$('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      sessionStorage.setItem('mambLastScreen', target);
      if (target === 'screen-museo') loadGallery();
      showScreen(target);
    });
  });
}

/* ── TEACHABLE MACHINE AI ── */
async function loadTeachableMachineModel() {
  if (tmModel) return tmModel;
  if (!tmModelPromise) {
    if (!window.tmImage) throw new Error('No se cargó la librería de Teachable Machine.');
    tmModelPromise = tmImage.load(`${TM_MODEL_URL}model.json`, `${TM_MODEL_URL}metadata.json`);
  }
  tmModel = await tmModelPromise;
  return tmModel;
}

function setAiStatus(name, confidence = '', predictions = []) {
  const styleName = $('#aiStyleName');
  const styleConfidence = $('#aiStyleConfidence');
  const list = $('#aiPredictions');

  if (styleName) styleName.textContent = name;
  if (styleConfidence) styleConfidence.textContent = confidence;
  if (list) {
    list.innerHTML = predictions.map(item => `
      <div class="ai-prediction-row">
        <span>${item.className}</span>
        <strong>${Math.round(item.probability * 100)}%</strong>
      </div>
    `).join('');
  }
}

async function classifyCurrentImage() {
  if (!state.currentImage) return null;

  setAiStatus('Analizando imagen...', 'Cargando el modelo de IA local.', []);

  try {
    const model = await loadTeachableMachineModel();
    const img = await loadImageElement(state.currentImage);
    const predictions = await model.predict(img);
    const ordered = predictions.sort((a, b) => b.probability - a.probability);
    const best = ordered[0];

    state.aiPrediction = best;
    state.aiPredictions = ordered;
    state.currentStyle = best.className;

    setAiStatus(
      best.className,
      `Confianza del modelo: ${Math.round(best.probability * 100)}%.`,
      ordered
    );

    return best;
  } catch (err) {
    console.error('Teachable Machine error:', err);
    state.aiPrediction = { className: state.currentStyle, probability: 0 };
    setAiStatus('IA no disponible', 'No se pudo cargar el modelo. Se usará Vincent van Gogh por defecto.', []);
    return state.aiPrediction;
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ── CAMERA / FILE UPLOAD ── */
function initCamera() {
  const frame      = $('#cameraFrame');
  const fileInput  = $('#fileInput');
  const shutterBtn = $('#shutterBtn');
  const previewImg = $('#previewImg');
  if (!frame) return;

  frame.addEventListener('click', () => fileInput?.click());
  shutterBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      state.currentImage = ev.target.result;
      if (previewImg) {
        previewImg.src = ev.target.result;
        previewImg.classList.remove('hidden');
      }
      goToForm();
      await classifyCurrentImage();
    };
    reader.readAsDataURL(file);
  });
}

function goToForm() {
  const formImg = $('#formPreviewImg');
  if (formImg && state.currentImage) formImg.src = state.currentImage;
  showScreen('screen-form');
}

/* ── STYLE SELECTION ── */
function initStyleChips() {
  const chips = $$('.style-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentStyle = chip.dataset.style;
    });
  });
}

/* ── FORM BUTTONS ── */
function initFormButtons() {
  $('#btnCrear')?.addEventListener('click', () => {
    sessionStorage.setItem('mambLastScreen', 'screen-camera');
    showScreen('screen-camera');
  });
  $('#btnMuseo')?.addEventListener('click', showMuseumScreen);
  $('#btnRetomar')?.addEventListener('click', () => {
    sessionStorage.setItem('mambLastScreen', 'screen-camera');
    showScreen('screen-camera');
  });
  $('#btnGenerar')?.addEventListener('click', handleGenerate);
  $('#btnGuardar')?.addEventListener('click', handleSave);
}

/* ── GENERATION ── */
const LOADING_MESSAGES = [
  'Analizando tu dibujo...',
  'Aplicando el estilo del maestro...',
  'Pintando con inteligencia artificial...',
  'Casi lista tu obra...',
];

async function handleGenerate() {
  const title = $('#obraTitle')?.value.trim() || 'Sin título';
  const autor = $('#obraAutor')?.value.trim() || 'Artista anónimo';
  state.currentTitle = title;
  state.currentAutor = autor;

  if (!state.currentImage) {
    alert('Por favor toma o sube una foto primero.');
    return;
  }

  showScreen('screen-loading');
  animateLoadingMessages();

  try {
    const prediction = state.aiPrediction || await classifyCurrentImage();
    const style = prediction?.className || state.currentStyle;
    const styleInfo = ARTIST_STYLES[style] || ARTIST_STYLES['Vincent van Gogh'];

    state.currentStyle = style;
    state.resultDescription = styleInfo.description;
    state.resultTags = styleInfo.tags;
    state.resultImage = await generateArtCanvas(style);
    showResultScreen();

  } catch (err) {
    console.error('Generate error:', err);
    state.resultImage       = await generateArtCanvas(state.currentStyle);
    state.resultDescription = '¡Tu obra está lista para el museo!';
    state.resultTags        = ['arte', 'creatividad'];
    showResultScreen();
  }
}

function animateLoadingMessages() {
  let i = 0;
  const sub   = $('#loadingSub');
  const dots  = $('#loadingDots');
  const timer = setInterval(() => {
    if (!$('#screen-loading.active')) { clearInterval(timer); return; }
    if (sub)  sub.textContent  = LOADING_MESSAGES[i % LOADING_MESSAGES.length];
    if (dots) dots.textContent = '·'.repeat((i % 3) + 1) + '..'.slice(0, 3 - (i % 3));
    i++;
  }, 900);
}

async function generateArtCanvas(style) {
  const canvas = document.createElement('canvas');
  canvas.width  = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');

  const styleInfo = ARTIST_STYLES[style] || ARTIST_STYLES['Vincent van Gogh'];
  const pal = styleInfo.palette;

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, pal[0]);
  bg.addColorStop(0.5, pal[1]);
  bg.addColorStop(1, pal[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 120; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 20 + Math.random() * 120;
    const color = pal[Math.floor(Math.random() * pal.length)];
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color + 'aa');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 40; i++) {
    const x1 = Math.random() * canvas.width;
    const y1 = Math.random() * canvas.height;
    const x2 = x1 + (Math.random() - 0.5) * 200;
    const y2 = y1 + (Math.random() - 0.5) * 200;
    ctx.strokeStyle = pal[Math.floor(Math.random() * pal.length)] + '88';
    ctx.lineWidth   = 3 + Math.random() * 18;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(
      x1 + Math.random() * 100 - 50, y1 + Math.random() * 100,
      x2 + Math.random() * 100 - 50, y2 + Math.random() * 100,
      x2, y2
    );
    ctx.stroke();
  }

  if (state.currentImage) {
    const img = await loadImageElement(state.currentImage);
    ctx.globalAlpha = 0.4;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.fillStyle = 'rgba(245,240,232,0.9)';
  ctx.fillRect(44, canvas.height - 148, canvas.width - 88, 92);
  ctx.fillStyle = '#12102A';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(style, 72, canvas.height - 102);
  ctx.font = '22px sans-serif';
  ctx.fillText(`IA Teachable Machine: ${state.aiPrediction ? Math.round(state.aiPrediction.probability * 100) : 0}%`, 72, canvas.height - 70);

  const frame = ctx.createLinearGradient(0, 0, canvas.width, 0);
  frame.addColorStop(0,    'rgba(201,168,76,0.6)');
  frame.addColorStop(0.05, 'rgba(201,168,76,0)');
  frame.addColorStop(0.95, 'rgba(201,168,76,0)');
  frame.addColorStop(1,    'rgba(201,168,76,0.6)');
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function showResultScreen() {
  const resultImg = $('#resultImg');
  if (resultImg && state.resultImage) resultImg.src = state.resultImage;
  showScreen('screen-result');
}

/* ── SAVE TO SERVER ── */
async function handleSave() {
  const btn = $('#btnGuardar');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const res = await fetch(`${API_BASE}/api/save-obra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:          state.currentTitle,
        autor:          state.currentAutor,
        style:          state.currentStyle,
        generatedImage: state.resultImage,
        originalImage:  state.currentImage,
        description:    state.resultDescription,
        tags:           state.resultTags,
      }),
    });

    if (!res.ok) throw new Error('Server error');
    await showMuseumScreen();
  } catch (err) {
    console.error('Save error:', err);
    alert('No se pudo guardar la obra. Verifica que el servidor esté corriendo.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'GUARDAR EN EL MUSEO'; }
  }
}

/* ── GALLERY (loads from server) ── */
const DEMO_OBRAS = [
  { id: 'demo-0', num: '001', title: 'Arrecife de Colores',  autor: 'Ney Salazar',    bg: 'linear-gradient(135deg, #1a5c8a 0%, #0e3d5e 30%, #1a8a6b 60%, #0e5e3d 100%)', description: '¡Una obra increíble llena de creatividad y color del Caribe colombiano!', isDemo: true },
  { id: 'demo-1', num: '002', title: 'El Mar de Leva',       autor: 'María García',   bg: 'linear-gradient(135deg, #d4732a 0%, #a84b18 40%, #e8a855 100%)',               description: '¡Una obra increíble llena de creatividad y color del Caribe colombiano!', isDemo: true },
  { id: 'demo-2', num: '003', title: 'Niño con Globo',       autor: 'Juan Pérez',     bg: 'linear-gradient(160deg, #2a1a3a 0%, #6b2d6b 50%, #2a1a3a 100%)',              description: '¡Una obra increíble llena de creatividad y color del Caribe colombiano!', isDemo: true },
  { id: 'demo-3', num: '004', title: 'Cielo Caribeño',       autor: 'Sofía López',    bg: 'linear-gradient(135deg, #1a2a3a 0%, #2d4a6b 50%, #1a2a3a 100%)',             description: '¡Una obra increíble llena de creatividad y color del Caribe colombiano!', isDemo: true },
  { id: 'demo-4', num: '005', title: 'Mi Isla Aventura',     autor: 'Ettien Cepeda',  bg: 'linear-gradient(135deg, #2d6b4a 0%, #1a3a2a 50%, #4a8a6b 100%)',             description: '¡Una obra increíble llena de creatividad y color del Caribe colombiano!', isDemo: true },
  { id: 'demo-5', num: '006', title: 'El Carro Rojo',        autor: 'Carlos Mora',    bg: 'linear-gradient(160deg, #8a3a1a 0%, #c96b2a 50%, #8a3a1a 100%)',             description: '¡Una obra increíble llena de creatividad y color del Caribe colombiano!', isDemo: true },
];

async function loadGallery() {
  const grid = $('#galleryGrid');
  if (!grid) return;

  grid.innerHTML = '<p class="gallery-loading">Cargando obras...</p>';

  let obras = [];
  try {
    const res  = await fetch(`${API_BASE}/api/obras`);
    const data = await res.json();
    obras = data.obras || [];
  } catch {
    // server unreachable — show demos
  }

  const allObras = obras.length > 0 ? obras : DEMO_OBRAS;
  state.allObras = allObras;

  const BORDER_COLORS = ['#c0392b', '#2d8a5a', '#8a3a2d', '#2a6b8a', '#6b2d8a', '#8a6b2d'];

  grid.innerHTML = allObras.map((obra, i) => {
    const imgContent = obra.url
      ? `<img src="${assetUrl(obra.url)}" alt="${obra.title}" loading="lazy" />`
      : `<div style="width:100%;height:100%;background:${obra.bg || '#333'}"></div>`;
    return `
      <div class="gallery-item" data-index="${i}" style="border:2.5px solid ${BORDER_COLORS[i % BORDER_COLORS.length]}">
        ${imgContent}
        <div class="gallery-item-overlay"><span>${obra.title}</span></div>
      </div>`;
  }).join('');

  $$('.gallery-item', grid).forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      openDetail(state.allObras[idx], idx);
    });
  });
}

function openDetail(obra, idx) {
  $('#detailNum').textContent   = `OBRA GENERADA #${obra.num}`;
  $('#detailTitle').textContent = obra.title;
  $('#detailAutor').textContent = `Autor: ${obra.autor}`;
  $('#detailDesc').textContent  = obra.description || '¡Una obra increíble llena de creatividad!';

  const detailImg = $('#detailImg');
  const existing  = $('.detail-bg-placeholder');
  if (existing) existing.remove();

  if (obra.url) {
    detailImg.src = assetUrl(obra.url);
    detailImg.style.display = '';
  } else {
    detailImg.style.display = 'none';
    const div = document.createElement('div');
    div.className = 'detail-bg-placeholder';
    div.style.cssText = `width:100%;height:320px;background:${obra.bg || '#333'}`;
    detailImg.parentNode.insertBefore(div, detailImg.nextSibling);
  }

  const similar     = state.allObras
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index !== idx)
    .slice(0, 2);
  const similarGrid = $('#similarGrid');
  if (similarGrid) {
    similarGrid.innerHTML = similar.map(({ item, index }) => {
      const content = item.url
        ? `<img src="${assetUrl(item.url)}" alt="${item.title}" />`
        : `<div style="background:${item.bg || '#333'};width:100%;height:100%"></div>`;
      return `<button type="button" class="similar-item" data-index="${index}" aria-label="Abrir ${item.title}">${content}</button>`;
    }).join('');

    $$('.similar-item', similarGrid).forEach(item => {
      item.addEventListener('click', () => {
        const nextIndex = parseInt(item.dataset.index);
        openDetail(state.allObras[nextIndex], nextIndex);
      });
    });
  }

  showScreen('screen-detail');
}

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSplash();

  if (!isApp()) {
    initNavbar();
    initTabs();
    initScrollReveal();
  } else {
    initBackButtons();
    initCamera();
    initStyleChips();
    initFormButtons();
    restoreLastScreen();
  }
});
