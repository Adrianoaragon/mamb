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
  const wrapper = isApp() ? $('#appWrapper') : $('#siteWrapper');
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add('gone');
    if (wrapper) wrapper.classList.remove('hidden');
    if (!isApp()) updateTabIndicator('tab-inicio');
  }, 1600);
}

/* ─── NAVBAR ─── */
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

/* ─── SISTEMA DE PESTAÑAS — PÁGINA PRINCIPAL ─── */
function switchTab(tabId) {
  $$('.site-tab').forEach(t => t.classList.remove('active'));
  const target = $(`#${tabId}`);
  if (target) { target.classList.add('active'); window.scrollTo({ top: 0 }); }

  $$('.nav-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  $$('.mob-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  $('#mobileMenu')?.classList.remove('open');
  updateTabIndicator(tabId);
}

function updateTabIndicator(tabId) {
  const indicator = $('#tabIndicator');
  if (!indicator) return;
  const activeBtn = $(`.nav-links .nav-tab-btn[data-tab="${tabId}"]`);
  if (!activeBtn) { indicator.style.width = '0'; return; }
  const btnRect = activeBtn.getBoundingClientRect();
  indicator.style.left  = btnRect.left + 'px';
  indicator.style.width = btnRect.width + 'px';
}

function initSiteTabs() {
  $$('.nav-tab-btn, .mob-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  $$('.footer-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  window.addEventListener('resize', () => {
    const active = $('.site-tab.active');
    if (active) updateTabIndicator(active.id);
  });
}

/* ─── TABS INTERNOS (sección Acerca) ─── */
function initTabs() {
  const tabs = $$('.tab-btn');
  if (!tabs.length) return;
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab-pane').forEach(p => p.classList.remove('active'));
      $(`#tab-${btn.dataset.tab}`)?.classList.add('active');
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
  currentImage: null,
  currentTitle: '', currentAutor: '',
  currentStyle: 'Vincent van Gogh',
  aiPrediction: null, aiPredictions: [],
  resultDescription: '', resultTags: [],
  detailObra: null, allObras: [],
};

const TM_MODEL_URL = './my_model/';
let tmModel = null, tmModelPromise = null;

/* Información de cada artista detectado por el modelo */
const ARTIST_INFO = {
  'Leonardo da Vinci': {
    emoji: '🎨',
    periodo: 'Renacimiento (s. XV–XVI)',
    descripcion: 'Maestro del sfumato y la perspectiva. Sus obras combinan arte y ciencia con una precisión sin igual.',
    color: '#75664a',
    colorBg: 'linear-gradient(135deg, #2d2a22, #5d4e37)',
    tags: ['renacimiento', 'sfumato', 'detalle'],
  },
  'Vincent van Gogh': {
    emoji: '🌻',
    periodo: 'Postimpresionismo (s. XIX)',
    descripcion: 'Pinceladas vibrantes y colores expresivos que transmiten emoción pura. Uno de los artistas más influyentes de la historia.',
    color: '#f2c84b',
    colorBg: 'linear-gradient(135deg, #173f8a, #1f6fb2)',
    tags: ['postimpresionismo', 'pincelada', 'color'],
  },
  'Diego Velázquez': {
    emoji: '👑',
    periodo: 'Barroco (s. XVII)',
    descripcion: 'Maestro del retrato y la luz. Su técnica realista y teatral lo convierte en el pintor más importante del Siglo de Oro español.',
    color: '#c7a06a',
    colorBg: 'linear-gradient(135deg, #2b211c, #5a3b2e)',
    tags: ['barroco', 'retrato', 'luz'],
  },
  'Pablo Picasso': {
    emoji: '🟦',
    periodo: 'Cubismo (s. XX)',
    descripcion: 'Revolucionó el arte con formas geométricas y perspectivas múltiples. Cofundador del cubismo y figura central del arte moderno.',
    color: '#f0c94a',
    colorBg: 'linear-gradient(135deg, #202c5a, #d94b3d)',
    tags: ['cubismo', 'formas', 'moderno'],
  },
};

/* ── SCREEN NAVIGATION ── */
function showScreen(id) {
  $$('.app-screen').forEach(s => s.classList.remove('active'));
  const t = $(`#${id}`);
  if (t) { t.classList.add('active'); t.scrollTop = 0; }
}

async function showMuseumScreen() {
  sessionStorage.setItem('mambLastScreen', 'screen-museo');
  await loadGallery();
  showScreen('screen-museo');
}

async function restoreLastScreen() {
  if (sessionStorage.getItem('mambLastScreen') === 'screen-museo') await showMuseumScreen();
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
  const styleName = $('#aiStyleName'), styleConfidence = $('#aiStyleConfidence'), list = $('#aiPredictions');
  if (styleName) styleName.textContent = name;
  if (styleConfidence) styleConfidence.textContent = confidence;
  if (list) list.innerHTML = predictions.map(item => `
    <div class="ai-prediction-row"><span>${item.className}</span><strong>${Math.round(item.probability * 100)}%</strong></div>
  `).join('');
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
    setAiStatus(best.className, `Confianza del modelo: ${Math.round(best.probability * 100)}%.`, ordered);
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
let cameraStream = null;

function closeCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

function resetCameraScreen() {
  closeCameraStream();
  const videoEl = $('#cameraVideo');
  const cameraOptions = $('#cameraOptions');
  const cameraControls = $('#cameraControls');
  const cameraHint = $('#cameraHint');
  const previewImg = $('#previewImg');
  const icon = $('.camera-icon');

  if (videoEl) videoEl.classList.add('hidden');
  if (icon) icon.classList.remove('hidden');
  if (previewImg) previewImg.classList.add('hidden');
  if (cameraHint) cameraHint.textContent = 'Elige una opción';
  if (cameraOptions) cameraOptions.classList.remove('hidden');
  if (cameraControls) cameraControls.classList.add('hidden');
}

async function startCameraCapture() {
  const cameraOptions = $('#cameraOptions');
  const cameraControls = $('#cameraControls');
  const videoEl = $('#cameraVideo');
  const cameraHint = $('#cameraHint');
  const icon = $('.camera-icon');

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    if (videoEl) {
      videoEl.srcObject = cameraStream;
      videoEl.classList.remove('hidden');
    }
    if (icon) icon.classList.add('hidden');
    if (cameraHint) cameraHint.textContent = 'Encuadra tu dibujo';
    if (cameraOptions) cameraOptions.classList.add('hidden');
    if (cameraControls) cameraControls.classList.remove('hidden');
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('No se pudo acceder a la cámara. Por favor, verifica los permisos.');
    resetCameraScreen();
  }
}

function capturePhotoFromVideo() {
  const videoEl = $('#cameraVideo');
  const canvas = $('#cameraCanvas');
  if (!videoEl || !canvas) return null;
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0);
  closeCameraStream();
  return canvas.toDataURL('image/jpeg', 0.85);
}

function initCamera() {
  const btnTakePhoto = $('#btnTakePhoto');
  const btnUploadImage = $('#btnUploadImage');
  const btnCancelCamera = $('#btnCancelCamera');
  const shutterBtn = $('#shutterBtn');
  const fileInput = $('#fileInput');

  btnTakePhoto?.addEventListener('click', startCameraCapture);
  btnCancelCamera?.addEventListener('click', resetCameraScreen);

  shutterBtn?.addEventListener('click', () => {
    const photoData = capturePhotoFromVideo();
    if (photoData) {
      state.currentImage = photoData;
      const previewImg = $('#previewImg');
      if (previewImg) {
        previewImg.src = photoData;
        previewImg.classList.remove('hidden');
      }
      setTimeout(() => {
        goToForm();
        classifyCurrentImage();
      }, 100);
    }
  });

  btnUploadImage?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      state.currentImage = ev.target.result;
      const previewImg = $('#previewImg');
      if (previewImg) {
        previewImg.src = ev.target.result;
        previewImg.classList.remove('hidden');
      }
      goToForm();
      await classifyCurrentImage();
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !$('#screen-camera.active')) closeCameraStream();
  });
}

function goToForm() {
  closeCameraStream();
  resetCameraScreen();
  const formImg = $('#formPreviewImg');
  if (formImg && state.currentImage) formImg.src = state.currentImage;
  showScreen('screen-form');
}

function initFormButtons() {
  $('#btnCrear')?.addEventListener('click', () => { sessionStorage.setItem('mambLastScreen', 'screen-camera'); showScreen('screen-camera'); });
  $('#btnMuseo')?.addEventListener('click', showMuseumScreen);
  $('#btnRetomar')?.addEventListener('click', () => { sessionStorage.setItem('mambLastScreen', 'screen-camera'); showScreen('screen-camera'); });
  $('#btnGenerar')?.addEventListener('click', handleGenerate);
  $('#btnGuardar')?.addEventListener('click', handleSave);
}

/* ── GENERATION — muestra resultado de clasificación ── */
const LOADING_MESSAGES = [
  'Analizando tu imagen...',
  'Consultando el modelo de IA...',
  'Identificando al artista...',
  'Calculando la confianza...',
];

async function handleGenerate() {
  const title = $('#obraTitle')?.value.trim() || 'Sin título';
  const autor = $('#obraAutor')?.value.trim() || 'Artista anónimo';
  state.currentTitle = title;
  state.currentAutor = autor;

  if (!state.currentImage) { alert('Por favor toma o sube una foto primero.'); return; }

  showScreen('screen-loading');
  animateLoadingMessages();

  try {
    /* Si ya se clasificó al entrar al formulario, usar ese resultado.
       Si no (raro), clasificar ahora. */
    const prediction = state.aiPrediction && state.aiPrediction.probability > 0
      ? state.aiPrediction
      : await classifyCurrentImage();

    const artistName  = prediction?.className || state.currentStyle;
    const confidence  = prediction ? Math.round(prediction.probability * 100) : 0;
    const artistInfo  = ARTIST_INFO[artistName] || ARTIST_INFO['Vincent van Gogh'];

    state.currentStyle      = artistName;
    state.resultDescription = artistInfo.descripcion;
    state.resultTags        = artistInfo.tags;

    showResultScreen(artistName, confidence, artistInfo);
  } catch (err) {
    console.error('Generate error:', err);
    showResultScreen(state.currentStyle, 0, ARTIST_INFO[state.currentStyle] || ARTIST_INFO['Vincent van Gogh']);
  }
}

function animateLoadingMessages() {
  let i = 0;
  const sub = $('#loadingSub'), dots = $('#loadingDots');
  const timer = setInterval(() => {
    if (!$('#screen-loading.active')) { clearInterval(timer); return; }
    if (sub)  sub.textContent  = LOADING_MESSAGES[i % LOADING_MESSAGES.length];
    if (dots) dots.textContent = '·'.repeat((i % 3) + 1) + '..'.slice(0, 3 - (i % 3));
    i++;
  }, 900);
}

/* ── PANTALLA DE RESULTADO: muestra imagen original + etiqueta del artista ── */
function showResultScreen(artistName, confidence, artistInfo) {
  /* Imagen original del usuario (no una transformación) */
  const resultImg = $('#resultImg');
  if (resultImg && state.currentImage) {
    resultImg.src = state.currentImage;
  }

  /* Barra de confianza de todas las predicciones */
  const predList = $('#resultPredictions');
  if (predList && state.aiPredictions.length > 0) {
    predList.innerHTML = state.aiPredictions.map(p => {
      const pct  = Math.round(p.probability * 100);
      const info = ARTIST_INFO[p.className] || {};
      const isTop = p.className === artistName;
      return `
        <div class="result-pred-row ${isTop ? 'result-pred-top' : ''}">
          <span class="result-pred-name">${p.className}</span>
          <div class="result-pred-bar-wrap">
            <div class="result-pred-bar" style="width:${pct}%; background:${info.color || '#aaa'}"></div>
          </div>
          <span class="result-pred-pct">${pct}%</span>
        </div>`;
    }).join('');
  }

  /* Guardamos currentImage como "imagen resultado" para la galería */
  state.resultImage = state.currentImage;

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
        title: state.currentTitle,
        autor: state.currentAutor,
        style: state.currentStyle,
        generatedImage: state.resultImage,
        originalImage: state.currentImage,
        description: state.resultDescription,
        tags: state.resultTags,
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

/* ── GALLERY ── */
const DEMO_OBRAS = [
  { id:'demo-0', num:'001', title:'Arrecife de Colores', autor:'Ney Salazar',   bg:'linear-gradient(135deg,#1a5c8a,#0e3d5e,#1a8a6b)', description:'Una exploración vibrante del mundo subacuático caribeño.' },
  { id:'demo-1', num:'002', title:'El Mar de Leva',      autor:'María García',  bg:'linear-gradient(135deg,#d4732a,#a84b18,#e8a855)', description:'El mar embravecido del Atlántico en tonos cálidos y arenosos.' },
  { id:'demo-2', num:'003', title:'Niño con Globo',      autor:'Juan Pérez',    bg:'linear-gradient(160deg,#2a1a3a,#6b2d6b,#2a1a3a)', description:'La inocencia de la infancia capturada en formas simples.' },
  { id:'demo-3', num:'004', title:'Cielo Caribeño',      autor:'Sofía López',   bg:'linear-gradient(135deg,#1a2a3a,#2d4a6b,#1a2a3a)', description:'Un atardecer imaginado sobre la costa barranquillera.' },
  { id:'demo-4', num:'005', title:'Mi Isla Aventura',    autor:'Ettien Cepeda', bg:'linear-gradient(135deg,#2d6b4a,#1a3a2a,#4a8a6b)', description:'Una isla soñada llena de selvas y tesoros escondidos.' },
  { id:'demo-5', num:'006', title:'El Carro Rojo',       autor:'Carlos Mora',   bg:'linear-gradient(160deg,#8a3a1a,#c96b2a,#8a3a1a)', description:'Un auto de carreras imaginado con los colores del carnaval.' },
];

async function loadGallery() {
  const grid = $('#galleryGrid');
  if (!grid) return;
  grid.innerHTML = '<p class="gallery-loading">Cargando obras...</p>';
  let obras = [];
  try {
    const res = await fetch(`${API_BASE}/api/obras`);
    const data = await res.json();
    obras = data.obras || [];
  } catch { /* servidor no disponible */ }
  const allObras = obras.length > 0 ? obras : DEMO_OBRAS;
  state.allObras = allObras;
  const BORDER_COLORS = ['#c0392b','#2d8a5a','#8a3a2d','#2a6b8a','#6b2d8a','#8a6b2d'];

  // Filtrar obras sin imagen (url vacía o rota)
  const obrasConFoto = allObras.filter(obra => obra.url);
  state.allObras = obrasConFoto;

  grid.innerHTML = obrasConFoto.map((obra, i) => {
    const desc = obra.description || '¡Una obra increíble del museo!';
    return `
      <div class="gallery-item" data-index="${i}" style="border:2.5px solid ${BORDER_COLORS[i%BORDER_COLORS.length]}">
        <div class="gallery-thumb-wrap">
          <img src="${assetUrl(obra.url)}" alt="${obra.title}" loading="lazy" />
        </div>
        <div class="gallery-item-info">
          <div class="gallery-item-autor">${obra.autor||'Artista anónimo'}</div>
          <div class="gallery-item-title">${obra.title}</div>
          <div class="gallery-item-desc">${desc}</div>
        </div>
      </div>`;
  }).join('');

  $$('.gallery-item', grid).forEach(item => {
    item.addEventListener('click', () => openDetail(state.allObras[parseInt(item.dataset.index)], parseInt(item.dataset.index)));
  });
}

function openDetail(obra, idx) {
  const artistInfo = ARTIST_INFO[obra.style] || {};
  $('#detailNum').textContent   = `OBRA GENERADA #${obra.num}`;
  $('#detailTitle').textContent = obra.title;
  $('#detailAutor').textContent = `Autor: ${obra.autor}`;
  $('#detailDesc').textContent  = obra.description || '¡Una obra increíble llena de creatividad!';

  /* Badge del artista en el detalle */
  const detailBadge = $('#detailArtistBadge');
  if (detailBadge && obra.style) {
    detailBadge.innerHTML = `<span class="detail-artist-label">Artista identificado: <strong>${obra.style}</strong></span>`;
    detailBadge.style.display = '';
  } else if (detailBadge) {
    detailBadge.style.display = 'none';
  }

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
    div.style.cssText = `width:100%;height:320px;background:${obra.bg||'#333'}`;
    detailImg.parentNode.insertBefore(div, detailImg.nextSibling);
  }

  const similar = state.allObras.map((item, index) => ({ item, index })).filter(({ index }) => index !== idx).slice(0, 2);
  const similarGrid = $('#similarGrid');
  if (similarGrid) {
    similarGrid.innerHTML = similar.map(({ item, index }) => {
      const content = item.url
        ? `<img src="${assetUrl(item.url)}" alt="${item.title}" />`
        : `<div style="background:${item.bg||'#333'};width:100%;height:100%"></div>`;
      return `<button type="button" class="similar-item" data-index="${index}" aria-label="Abrir ${item.title}">${content}</button>`;
    }).join('');
    $$('.similar-item', similarGrid).forEach(item => {
      item.addEventListener('click', () => openDetail(state.allObras[parseInt(item.dataset.index)], parseInt(item.dataset.index)));
    });
  }
  showScreen('screen-detail');
}

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
/* ── HOMEPAGE: cargar imágenes reales en las ib-cards ── */
async function initIbCards() {
  try {
    const res = await fetch(`${API_BASE}/api/obras`);
    const data = await res.json();
    const obras = (data.obras || []).filter(o => o.url);
    if (obras.length === 0) return; // sin obras, dejar los gradientes por defecto

    const front = $('.ib-card-front .ib-card-art');
    const back  = $('.ib-card-back  .ib-card-art');
    const labelNum   = $('.ib-label-num');
    const labelTitle = $('.ib-label-title');

    // card frontal: obra más reciente
    if (front && obras[0]) {
      front.style.backgroundImage = `url(${assetUrl(obras[0].url)})`;
      front.style.backgroundSize  = 'cover';
      front.style.backgroundPosition = 'center';
      if (labelNum)   labelNum.textContent   = `OBRA #${obras[0].num}`;
      if (labelTitle) labelTitle.textContent = obras[0].title;
    }
    // card trasera: segunda obra más reciente
    if (back && obras[1]) {
      back.style.backgroundImage = `url(${assetUrl(obras[1].url)})`;
      back.style.backgroundSize  = 'cover';
      back.style.backgroundPosition = 'center';
    }
  } catch { /* si el servidor no responde, quedan los gradientes */ }
}

document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  if (!isApp()) {
    initNavbar();
    initSiteTabs();
    initTabs();
    initScrollReveal();
    initIbCards();
    // Activar tab desde hash en URL (ej: index.html#tab-acerca)
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) switchTab(hash);
  } else {
    initBackButtons();
    initCamera();
    initFormButtons();
    restoreLastScreen();
  }
});