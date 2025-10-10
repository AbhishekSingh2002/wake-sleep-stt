// tests/setupTests.ts

// Import the global types
import '../src/types/globals';

// Mock for the Web Speech API
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onresult: ((event: any) => void) | null = null;

  start() {
    if (this.onstart) this.onstart();
  }

  stop() {
    if (this.onend) this.onend();
  }

  simulateResult(transcript: string, isFinal: boolean = true, confidence: number = 0.9) {
    if (this.onresult) {
      this.onresult({
        results: [[{
          transcript,
          isFinal,
          confidence,
        }]],
        resultIndex: 0
      });
    }
  }
}

// Add to global scope
const mockSpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition;

Object.defineProperty(window, 'SpeechRecognition', {
  value: mockSpeechRecognition,
  writable: true
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: mockSpeechRecognition,
  writable: true
});

// Only define these if they don't exist
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return window.setTimeout(callback, 0);
  };
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id: number) => {
    window.clearTimeout(id);
  };
}