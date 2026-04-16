const STORAGE_KEY = 'familyDebtIncomingDrawings';
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const sendBtn = document.getElementById('sendBtn');
const syncStatus = document.getElementById('syncStatus');
const sentCount = document.getElementById('sentCount');
const canvasHint = document.getElementById('canvasHint');
const toast = document.getElementById('toast');

let drawing = false;
let hasDrawn = false;
let snapshots = [];

function resizeCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  fillWhiteBackground();
  restoreLastSnapshot();
}

function fillWhiteBackground() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 5;
}

function pointerPosition(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function saveSnapshot() {
  if (snapshots.length > 20) snapshots.shift();
  snapshots.push(canvas.toDataURL('image/png'));
}

function restoreLastSnapshot() {
  if (!snapshots.length) return;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
  };
  img.src = snapshots[snapshots.length - 1];
}

function startDraw(e) {
  e.preventDefault();
  const { x, y } = pointerPosition(e);
  saveSnapshot();
  drawing = true;
  hasDrawn = true;
  canvasHint.style.display = 'none';
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function drawMove(e) {
  if (!drawing) return;
  e.preventDefault();
  const { x, y } = pointerPosition(e);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function endDraw() {
  drawing = false;
  ctx.beginPath();
}

function clearCanvas() {
  snapshots = [];
  hasDrawn = false;
  fillWhiteBackground();
  canvasHint.style.display = 'flex';
  showToast('تم مسح اللوحة');
}

function undoLast() {
  if (!snapshots.length) {
    showToast('ماكو خطوة سابقة');
    return;
  }
  const last = snapshots.pop();
  const img = new Image();
  img.onload = () => {
    fillWhiteBackground();
    ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    hasDrawn = true;
    canvasHint.style.display = 'none';
  };
  img.src = last;
}

function getStoredDrawings() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function updateCounter() {
  sentCount.textContent = String(getStoredDrawings().length);
}

function sendDrawing() {
  if (!hasDrawn) {
    showToast('ارسم أولًا قبل الإرسال');
    return;
  }

  const now = new Date();
  const drawings = getStoredDrawings();
  drawings.unshift({
    id: `drawing_${Date.now()}`,
    imageData: canvas.toDataURL('image/png'),
    createdAt: now.toISOString(),
    dateLabel: now.toLocaleDateString('ar-IQ'),
    timeLabel: now.toLocaleTimeString('ar-IQ'),
    status: 'جديدة',
    note: '',
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drawings));
  syncStatus.textContent = 'تم الإرسال';
  updateCounter();
  showToast('تم إرسال الرسمة بنجاح');
  clearCanvas();
  setTimeout(() => {
    syncStatus.textContent = 'جاهز';
  }, 1800);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

canvas.addEventListener('pointerdown', startDraw);
canvas.addEventListener('pointermove', drawMove);
window.addEventListener('pointerup', endDraw);
window.addEventListener('pointercancel', endDraw);
undoBtn.addEventListener('click', undoLast);
clearBtn.addEventListener('click', clearCanvas);
sendBtn.addEventListener('click', sendDrawing);
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
updateCounter();
fillWhiteBackground();
