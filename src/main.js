const video = document.getElementById('videoElement');
const loader = document.getElementById('loader');
const startBtn = document.getElementById('startBtn');
const emotionDisplay = document.getElementById('emotionDisplay');
const emotionIcon = document.getElementById('emotionIcon');
const emotionName = document.getElementById('emotionName');
const emotionBars = document.getElementById('emotionBars');
const insightsPanel = document.querySelector('.insights-panel');

const emotionMap = {
  happy: { icon: '😄', color: 'var(--happy)' },
  sad: { icon: '😢', color: 'var(--sad)' },
  angry: { icon: '😠', color: 'var(--angry)' },
  fearful: { icon: '😨', color: 'var(--fearful)' },
  disgusted: { icon: '🤢', color: 'var(--disgusted)' },
  surprised: { icon: '😲', color: 'var(--surprised)' },
  neutral: { icon: '😐', color: 'var(--neutral)' }
};

const emotionKeys = Object.keys(emotionMap);

// Initialize emotion bars
function initBars() {
  emotionBars.innerHTML = '';
  emotionKeys.forEach(emotion => {
    const barContainer = document.createElement('div');
    barContainer.className = 'emotion-bar-container';
    
    // Label
    const label = document.createElement('div');
    label.className = 'emotion-label';
    label.textContent = emotion;
    
    // Track
    const track = document.createElement('div');
    track.className = 'bar-track';
    
    // Fill
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.id = `bar-${emotion}`;
    fill.style.backgroundColor = emotionMap[emotion].color;
    fill.style.width = '0%';
    
    track.appendChild(fill);
    
    // Value
    const val = document.createElement('div');
    val.className = 'emotion-value';
    val.id = `val-${emotion}`;
    val.textContent = '0%';
    
    barContainer.appendChild(label);
    barContainer.appendChild(track);
    barContainer.appendChild(val);
    
    emotionBars.appendChild(barContainer);
  });
}

initBars();

// Load models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(() => {
  loader.classList.add('hidden');
  startBtn.disabled = false;
  startBtn.textContent = '⚡ Start Camera';
}).catch(err => {
  console.error("Error loading models:", err);
  loader.innerHTML = `<p style="color:var(--angry)">Error loading models. Check console.</p>`;
});

startBtn.addEventListener('click', () => {
  if (video.srcObject) {
    stopVideo();
  } else {
    startVideo();
  }
});

function startVideo() {
  startBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Starting...';
  startBtn.disabled = true;
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("Camera API not available. Ensure you are using HTTPS or localhost.");
    startBtn.innerHTML = '<span class="btn-icon">⚠️</span> Camera API Unavailable';
    startBtn.disabled = false;
    alert("Camera access is not supported in this browser or context. Please use localhost or HTTPS.");
    return;
  }
  
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.play().catch(e => console.error("Error playing video:", e));
      startBtn.innerHTML = '<span class="btn-icon">⏹️</span> Stop Camera';
      startBtn.disabled = false;
      startBtn.classList.replace('primary-btn', 'danger-btn');
      // Hacky way to add danger btn style
      startBtn.style.background = 'linear-gradient(135deg, var(--angry), #b91c1c)';
    })
    .catch(err => {
      console.error("Error accessing camera:", err);
      startBtn.innerHTML = '<span class="btn-icon">⚠️</span> Camera Failed';
      startBtn.disabled = false;
      alert("Could not access the camera. Please check your browser permissions.");
    });
}

function stopVideo() {
  const stream = video.srcObject;
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }
  startBtn.innerHTML = '<span class="btn-icon">⚡</span> Start Camera';
  startBtn.style.background = '';
  startBtn.classList.replace('danger-btn', 'primary-btn');
  
  // Reset UI
  emotionIcon.textContent = '🤔';
  emotionName.textContent = 'Standby';
  emotionName.style.color = 'inherit';
  insightsPanel.className = 'insights-panel';
  
  emotionKeys.forEach(emotion => {
    document.getElementById(`bar-${emotion}`).style.width = '0%';
    document.getElementById(`val-${emotion}`).textContent = '0%';
  });
}

video.addEventListener('playing', () => {
  // Clear any existing canvas to prevent duplicates if played multiple times
  const existingCanvas = document.querySelector('canvas');
  if (existingCanvas) existingCanvas.remove();

  const canvas = faceapi.createCanvasFromMedia(video);
  document.querySelector('.video-container').append(canvas);
  
  const displaySize = { width: video.clientWidth, height: video.clientHeight };
  if (displaySize.width > 0 && displaySize.height > 0) {
    faceapi.matchDimensions(canvas, displaySize);
  }
  
  // Resize observer to handle dynamic sizing
  const ro = new ResizeObserver(() => {
    if(!video.srcObject) return;
    const newSize = { width: video.clientWidth, height: video.clientHeight };
    if (newSize.width > 0 && newSize.height > 0) {
      faceapi.matchDimensions(canvas, newSize);
      displaySize.width = newSize.width;
      displaySize.height = newSize.height;
    }
  });
  ro.observe(video);
  
  const interval = setInterval(async () => {
    if (!video.srcObject) {
      clearInterval(interval);
      canvas.remove();
      ro.disconnect();
      return;
    }
    
    // Ensure video is playing and has enough data for processing
    if (video.readyState !== 4 || video.videoWidth === 0 || displaySize.width === 0) return;
    
    try {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
      
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw bounding box and the detected emotion
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
      
      if (detections.length > 0) {
        const expressions = detections[0].expressions;
        updateInsights(expressions);
      }
    } catch (err) {
      console.warn("Detection loop error, skipping frame:", err);
    }
  }, 100);
});

let lastEmotion = '';
function updateInsights(expressions) {
  // Find highest emotion
  let maxEmotion = 'neutral';
  let maxValue = 0;
  
  emotionKeys.forEach(emotion => {
    const val = expressions[emotion] || 0;
    if (val > maxValue) {
      maxValue = val;
      maxEmotion = emotion;
    }
    
    // Update bars
    const percent = Math.round(val * 100);
    const bar = document.getElementById(`bar-${emotion}`);
    const valText = document.getElementById(`val-${emotion}`);
    
    if (bar && valText) {
      bar.style.width = `${percent}%`;
      valText.textContent = `${percent}%`;
    }
  });
  
  if (lastEmotion !== maxEmotion) {
    lastEmotion = maxEmotion;
    const details = emotionMap[maxEmotion];
    
    emotionIcon.textContent = details.icon;
    emotionName.textContent = maxEmotion;
    emotionName.style.color = details.color;
    
    // Update panel glow
    insightsPanel.className = 'insights-panel glow-' + maxEmotion;
  }
}
