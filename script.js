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
const recordBtn = document.getElementById('recordBtn');
const recordText = document.getElementById('recordText');
const voiceTranscript = document.getElementById('voiceTranscript');

let drawing = false;
let hasDrawn = false;
let snapshots = [];

// Voice Recording Variables
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let audioBase64Data = null;
let finalSpeechText = "";
let speechRecognition;

if ('webkitSpeechRecognition' in window) {
  speechRecognition = new webkitSpeechRecognition();
  speechRecognition.lang = 'ar-IQ';
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  
  speechRecognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    if (finalTranscript) finalSpeechText += finalTranscript + ' ';
    voiceTranscript.textContent = finalSpeechText + interimTranscript;
  };
}

recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      finalSpeechText = "";
      voiceTranscript.textContent = "جاري الاستماع...";
      
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          audioBase64Data = reader.result;
        };
      };

      mediaRecorder.start();
      if (speechRecognition) speechRecognition.start();
      
      isRecording = true;
      recordBtn.classList.add('recording');
      recordText.textContent = "إيقاف التسجيل";
    } catch (err) {
      showToast("يجب السماح باستخدام المايكروفون");
    }
  } else {
    mediaRecorder.stop();
    if (speechRecognition) speechRecognition.stop();
    
    isRecording = false;
    recordBtn.classList.remove('recording');
    recordText.textContent = "تسجيل صوتي (اختياري)";
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
});

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
  audioBase64Data = null;
  finalSpeechText = "";
  voiceTranscript.textContent = "";
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

function cropCanvas(x, y, w, h) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return tempCanvas.toDataURL('image/png');
}

async function sendDrawing() {
  if (!hasDrawn) {
    showToast('ارسم أولًا قبل الإرسال');
    return;
  }
  if (isRecording) {
    showToast('أوقف التسجيل الصوتي أولاً');
    return;
  }

  syncStatus.textContent = 'جاري المعالجة...';
  sendBtn.disabled = true;

  try {
    const fullImgData = canvas.toDataURL('image/png');
    const w = canvas.width;
    const h = canvas.height;
    
    // قص الجزء العلوي (الاسم) والجزء السفلي (الرقم)
    const topImgData = cropCanvas(0, 0, w, h / 2);
    const bottomImgData = cropCanvas(0, h / 2, w, h / 2);

    const worker = await Tesseract.createWorker('ara');
    
    const retName = await worker.recognize(topImgData);
    const recognizedName = retName.data.text.trim() || 'اسم غير معروف';
    
    const retNum = await worker.recognize(bottomImgData);
    const recognizedNum = retNum.data.text.trim() || 'رقم غير معروف';
    
    await worker.terminate();

    const now = new Date();
    await addDoc(collection(db, "drawings"), {
      imageData: fullImgData,
      recognizedName: recognizedName,
      recognizedNumber: recognizedNum,
      audioData: audioBase64Data || null,
      audioText: finalSpeechText.trim() || null,
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
      sendBtn.disabled = false;
    }, 1800);
  } catch (error) {
    syncStatus.textContent = 'حدث خطأ';
    sendBtn.disabled = false;
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
