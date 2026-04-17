import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4Fj5TT82r-8qTLThEzZOEPynpYqDvlog",
  authDomain: "ggkf-7212f.firebaseapp.com",
  projectId: "ggkf-7212f",
  storageBucket: "ggkf-7212f.firebasestorage.app",
  messagingSenderId: "1066581984320",
  appId: "1:1066581984320:web:2f93338048d15291660ba5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

onSnapshot(collection(db, "drawings"), (snapshot) => {
  sentCount.textContent = snapshot.size;
});

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

async function sendDrawing() {
  if (!hasDrawn) {
    showToast('ارسم أولًا قبل الإرسال');
    return;
  }

  syncStatus.textContent = 'جاري تحويل الرسمة إلى نص...';
  const imgData = canvas.toDataURL('image/png');

  try {
    const worker = await Tesseract.createWorker('ara');
    const ret = await worker.recognize(imgData);
    const recognizedText = ret.data.text.trim() || 'رسمة غير معروفة';
    await worker.terminate();

    const now = new Date();
    await addDoc(collection(db, "drawings"), {
      imageData: imgData,
      recognizedText: recognizedText,
      createdAt: serverTimestamp(),
      dateLabel: now.toLocaleDateString('ar-IQ'),
      timeLabel: now.toLocaleTimeString('ar-IQ'),
      status: 'جديدة'
    });

    syncStatus.textContent = 'تم الإرسال';
    showToast('تم إرسال العملية بنجاح');
    clearCanvas();
    setTimeout(() => {
      syncStatus.textContent = 'جاهز';
    }, 1800);
  } catch (error) {
    syncStatus.textContent = 'حدث خطأ';
    showToast('فشل الإرسال!');
    console.error(error);
  }
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
fillWhiteBackground();
