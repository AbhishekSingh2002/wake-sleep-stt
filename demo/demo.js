// demo.js
import { WakeSleepSTT } from '../src/wakeSleepStt.js';

// Check browser support
if (!WakeSleepSTT.isSupported()) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = 'Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.';
    statusEl.style.color = '#f44336';
    statusEl.style.fontWeight = 'bold';
  }
  console.error('Speech Recognition is not supported in this browser');
}

const stt = new WakeSleepSTT({
  wakeWords: ['computer', 'hey computer'],
  sleepWords: ['stop listening', 'go to sleep'],
  onEvent: (event) => {
    const statusEl = document.getElementById('status');
    const transcriptEl = document.getElementById('transcript');
    
    if (!statusEl || !transcriptEl) return;
    
    if (event.type === 'state') {
      const { state, message, error } = event.payload;
      console.log(`[${state.toUpperCase()}] ${message || ''} ${error || ''}`);
      
      // Update status element with state and message
      const statusText = message || `Status: ${state.charAt(0).toUpperCase() + state.slice(1)}`;
      statusEl.innerHTML = statusText;
      statusEl.setAttribute('data-state', state);
      
      // Update pulse animation on start/stop buttons
      const pulseDot = document.querySelector('.pulse');
      const startBtn = document.getElementById('startBtn');
      
      if (state === 'listening' || state === 'transcribing') {
        if (pulseDot) pulseDot.style.display = 'inline-block';
        startBtn.disabled = true;
        document.getElementById('stopBtn').disabled = false;
      } else {
        if (pulseDot) pulseDot.style.display = 'none';
        startBtn.disabled = false;
        document.getElementById('stopBtn').disabled = true;
      }
      
      if (state === 'error') {
        console.error('Error:', error);
      }
      
      if (error) {
        console.error('Error:', error);
      }
    } else if (event.type === 'transcript') {
      const { transcript, isFinal, confidence } = event.payload;
      console.log(isFinal ? 'Final transcript:' : 'Interim result:', transcript, { confidence });
      
      // Get or create the current paragraph for interim results
      let currentP = transcriptEl.querySelector('.interim');
      
      if (isFinal) {
        // If it's a final result, create a new paragraph
        const p = document.createElement('div');
        p.className = 'transcript-item final';
        
        const timeEl = document.createElement('span');
        timeEl.className = 'timestamp';
        timeEl.textContent = new Date().toLocaleTimeString();
        
        const textEl = document.createElement('div');
        textEl.className = 'transcript-text';
        textEl.textContent = transcript;
        
        if (confidence !== undefined) {
          const confEl = document.createElement('div');
          confEl.className = 'confidence';
          confEl.textContent = `Confidence: ${(confidence * 100).toFixed(1)}%`;
          p.appendChild(confEl);
        }
        
        p.prepend(timeEl);
        p.appendChild(textEl);
        
        transcriptEl.prepend(p);
        
        // Remove any interim result
        if (currentP) {
          currentP.remove();
        }
        
        // Auto-scroll to show the latest transcript
        transcriptEl.scrollTop = 0;
      } else {
        // For interim results, update the current paragraph or create a new one
        if (!currentP) {
          currentP = document.createElement('div');
          currentP.className = 'transcript-item interim';
          
          const timeEl = document.createElement('span');
          timeEl.className = 'timestamp';
          timeEl.textContent = new Date().toLocaleTimeString();
          
          const textEl = document.createElement('div');
          textEl.className = 'transcript-text';
          
          currentP.prepend(timeEl);
          currentP.appendChild(textEl);
          transcriptEl.prepend(currentP);
        }
        
        currentP.querySelector('.transcript-text').textContent = transcript;
        
        // Auto-scroll to show the latest interim result
        transcriptEl.scrollTop = 0;
      }
    }
  }
});

// Add error handling for microphone access
async function init() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusEl = document.getElementById('status');

  if (!startBtn || !stopBtn || !statusEl) {
    console.error('Required elements not found');
    return;
  }

  try {
    // Request microphone permission
    await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Enable buttons
    startBtn.disabled = false;
    stopBtn.disabled = false;
    
    // Set up button event listeners
    startBtn.addEventListener('click', async () => {
      try {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        await stt.startListening();
      } catch (error) {
        console.error('Error starting recognition:', error);
        statusEl.textContent = `Error: ${error.message}`;
        startBtn.disabled = false;
      }
    });
    
    stopBtn.addEventListener('click', () => {
      stt.stopListening();
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });
    
    console.log('Demo initialized successfully');
    statusEl.textContent = 'Status: Ready. Click "Start Listening" to begin.';
  } catch (error) {
    console.error('Error initializing:', error);
    statusEl.textContent = 
      'Error: Microphone access is required for this demo. Please allow microphone access and refresh the page.';
    startBtn.disabled = true;
  }
}

// Initialize when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}