# Wake-Sleep STT 🎤✨

A modern, feature-rich JavaScript/TypeScript library for implementing wake-word activated speech-to-text functionality in the browser using the Web Speech API.

## Features

- 🎤 **Real-time transcription** with immediate feedback
- 🔔 **Wake word detection** to start transcription (e.g., "Computer, ...")
- 😴 **Sleep word detection** to pause transcription (e.g., "Go to sleep")
- ⚙️ **Fully configurable** wake/sleep words and settings
- 🎨 **Modern, responsive UI** with visual feedback
- 📊 **Confidence scores** for transcriptions
- ⏱️ **Timestamps** for all transcript entries
- 🔄 **Auto-restart** on errors with configurable attempts
- 📱 **Mobile-friendly** design
- 🚀 **TypeScript** support
- 🎮 **Interactive demo** included

## Installation

```bash
npm install wake-sleep-stt
# or
yarn add wake-sleep-stt
```

## Usage

```typescript
import { WakeSleepSTT } from 'wake-sleep-stt';

const stt = new WakeSleepSTT({
  wakeWords: ['hey computer', 'ok computer'],
  sleepWords: ['go to sleep', 'stop listening'],
  language: 'en-US',
  onEvent: (event) => {
    if (event.type === 'transcript') {
      console.log('Transcript:', event.payload.transcript);
    } else if (event.type === 'state') {
      console.log('State changed to:', event.payload.state);
    }
  }
});

// Start listening for wake words
await stt.startListening();

// Later, when you want to stop
stt.stopListening();
```

## 🚀 Demo

Experience the power of Wake-Sleep STT with our interactive demo:

### Features in Action:
- Real-time speech visualization
- Live transcription with confidence scores
- Beautiful, responsive interface
- Visual feedback for different states

### Running the Demo

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Or build the demo for production
npm run build
npm run preview
```

Then open `http://localhost:3000` in your browser (Chrome or Edge recommended for best results).

### Demo Controls
- 🟢 **Start Listening**: Begin voice recognition
- 🔴 **Stop Listening**: Pause the recognition
- 🎤 **Visual Feedback**: See real-time speech detection
- 📝 **Transcript**: View your spoken words with timestamps

## 🛠️ API

### `WakeSleepSTT` Class

#### Constructor Options

```typescript
interface WakeSleepSTTOptions {
  // Array of wake words/phrases (case-insensitive)
  wakeWords?: string[];        // Default: ['computer', 'hey computer']
  
  // Array of sleep words/phrases (case-insensitive)
  sleepWords?: string[];       // Default: ['stop listening', 'go to sleep']
  
  // Whether to continue listening after a final result
  continuous?: boolean;        // Default: true
  
  // Whether to return interim results
  interimResults?: boolean;    // Default: true
  
  // Language for speech recognition
  language?: string;           // Default: 'en-US'
  
  // Event handler for state changes and transcripts
  onEvent?: (event: STTEvent) => void;
  
  // Minimum confidence score (0-1) to accept wake word matches
  wakeConfidenceThreshold?: number; // Default: 0.0
  
  // Whether to automatically restart on errors
  autoRestart?: boolean;       // Default: true
  
  // Maximum number of restart attempts
  maxRestartAttempts?: number; // Default: 5
}
```

#### Methods

- `startListening(): Promise<void>` - Starts listening for wake words
- `stopListening(): void` - Stops the recognition completely
- `enableTranscriptionMode(): void` - Manually enable transcription mode
- `disableTranscriptionMode(): void` - Manually disable transcription mode
- `onEvent(callback: (event: STTEvent) => void): void` - Set event handler
- `getState(): STTState` - Get current state
- `isTranscribingActive(): boolean` - Check if currently transcribing

### Events

The library emits events of type `STTEvent`:

```typescript
type STTEvent = {
  type: 'transcript' | 'state';
  payload: TranscriptPayload | StatePayload;
};

interface TranscriptPayload {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  timestamp?: number;
}

interface StatePayload {
  state: 'idle' | 'listening' | 'transcribing' | 'stopped' | 'error';
  message?: string;
  error?: string;
}
```

## Browser Support

This library uses the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API), which is supported in most modern browsers:

- Chrome 33+
- Edge 14+
- Firefox 49+
- Safari 14.1+
- Opera 30+

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Run tests: `npm test`

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
