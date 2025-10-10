// src/wakeSleepStt.ts

export type STTState = 'idle' | 'listening' | 'transcribing' | 'error' | 'stopped';

export interface TranscriptPayload {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  timestamp?: number;
}

export interface StatePayload {
  state: STTState;
  message?: string;
  error?: string;
}

export interface STTEvent {
  type: 'transcript' | 'state';
  payload: TranscriptPayload | StatePayload;
}

export interface WakeSleepSTTOptions {
  wakeWords?: string[];
  sleepWords?: string[];
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  onEvent?: (event: STTEvent) => void;
  wakeConfidenceThreshold?: number;
  autoRestart?: boolean;
  maxRestartAttempts?: number;
}

export class WakeSleepSTT {
  private wakeWords: string[];
  private sleepWords: string[];
  private continuous: boolean;
  private interimResults: boolean;
  private language: string;
  private onEventCallback?: (event: STTEvent) => void;
  private wakeConfidenceThreshold: number;
  private autoRestart: boolean;
  private maxRestartAttempts: number;
  private recognition: SpeechRecognition | null = null;
  private currentState: STTState = 'idle';
  private isTranscribing: boolean = false;
  private restartAttempts: number = 0;
  private restartTimeout: number | null = null;
  private wakeRegex: RegExp;
  private sleepRegex: RegExp;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(options: WakeSleepSTTOptions = {}) {
    this.wakeWords = options.wakeWords || ['hi', 'hello'];
    this.sleepWords = options.sleepWords || ['bye', 'goodbye'];
    this.continuous = options.continuous ?? true;
    this.interimResults = options.interimResults ?? true;
    this.language = options.language || 'en-US';
    this.onEventCallback = options.onEvent;
    this.wakeConfidenceThreshold = options.wakeConfidenceThreshold ?? 0.0;
    this.autoRestart = options.autoRestart ?? true;
    this.maxRestartAttempts = options.maxRestartAttempts ?? 5;

    this.wakeRegex = new RegExp(`\\b(${this.wakeWords.join('|')})\\b`, 'i');
    this.sleepRegex = new RegExp(`\\b(${this.sleepWords.join('|')})\\b`, 'i');

    this.checkBrowserSupport();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    // Remove existing listeners if any
    this.removeNetworkListeners();

    // Add new listeners
    this.onlineHandler = () => {
      console.log('Network connection restored');
      if (this.autoRestart && this.currentState !== 'stopped') {
        console.log('Attempting to restart recognition...');
        this.startListening().catch(console.error);
      }
    };

    this.offlineHandler = () => {
      console.warn('Network connection lost');
      this.setState('error', 'Network connection lost. Will resume when online.', 'offline');
      this.stopListening();
    };

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private removeNetworkListeners(): void {
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
      this.offlineHandler = null;
    }
  }

  public static isSupported(): boolean {
    return !!(
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition
    );
  }

  private async checkMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks to release the microphone
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone access denied:', error);
      this.setState(
        'error', 
        'Microphone access is required for speech recognition. Please allow microphone access and try again.',
        'microphone-denied'
      );
      return false;
    }
  }

  private checkBrowserSupport(): void {
    if (!WakeSleepSTT.isSupported()) {
      const error = 'Speech Recognition API not supported in this browser. Try using Chrome, Edge, or Safari.';
      console.error(error);
      this.setState('error', error, 'not-supported');
      return;
    }

    if (window.location.protocol === 'file:') {
      const warning = 'For best results, run this application using a local web server (not file://).';
      console.warn(warning);
      this.setState('error', `${warning} Use 'npm run dev' to start a local server.`, 'file-protocol');
    }
  }

  private emitEvent(event: STTEvent): void {
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }

  private setState(state: STTState, message?: string, error?: string): void {
    this.currentState = state;
    this.emitEvent({
      type: 'state',
      payload: { state, message, error }
    });
  }

  private emitTranscript(transcript: string, isFinal: boolean, confidence?: number): void {
    this.emitEvent({
      type: 'transcript',
      payload: {
        transcript,
        isFinal,
        confidence,
        timestamp: Date.now()
      }
    });
  }

  private normalizeTranscript(text: string): string {
    return text.toLowerCase().trim().replace(/[.,!?;:]/g, '');
  }

  private detectWakeWord(transcript: string): boolean {
    const normalized = this.normalizeTranscript(transcript);
    return this.wakeRegex.test(normalized);
  }

  private detectSleepWord(transcript: string): boolean {
    const normalized = this.normalizeTranscript(transcript);
    return this.sleepRegex.test(normalized);
  }

  private async handleNetworkError(): Promise<void> {
    if (this.currentState === 'error') {
      return;
    }
    
    console.warn('Handling network error...');
    this.setState('error', 'Connecting to speech service...', 'network-connecting');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!navigator.onLine) {
      this.setState('error', 'No internet connection. Please check your network and try again.', 'network-offline');
      return;
    }
    
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.warn('Error stopping recognition during network error:', e);
      } finally {
        this.recognition = null;
      }
    }

    if (this.autoRestart && this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++;
      
      const baseDelay = Math.min(2000 * Math.pow(1.5, this.restartAttempts - 1), 15000);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = baseDelay + jitter;
      
      const seconds = Math.ceil(delay / 1000);
      const remainingAttempts = this.maxRestartAttempts - this.restartAttempts + 1;
      
      const isOffline = !navigator.onLine;
      
      if (isOffline) {
        console.warn('No network connection available, will retry when online...');
        this.setState('error', `No internet connection. Will retry when online... (${remainingAttempts} ${remainingAttempts > 1 ? 'attempts' : 'attempt'} left)`);
        
        const handleOnline = () => {
          window.removeEventListener('online', handleOnline);
          if (this.currentState !== 'stopped' && this.autoRestart) {
            console.log('Network connection restored, attempting to restart...');
            this.startListening().catch(console.error);
          }
        };
        
        window.addEventListener('online', handleOnline, { once: true });
      } else {
        this.setState('error', `Network issue detected. Retrying in ${seconds}s... (${remainingAttempts} ${remainingAttempts > 1 ? 'attempts' : 'attempt'} left)`);
      }
      
      this.clearRestartTimeout();
      
      if (!isOffline) {
        console.log(`Scheduling restart in ${delay}ms (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
        
        this.restartTimeout = window.setTimeout(async () => {
          if (this.currentState === 'stopped') {
            console.log('Not restarting - recognition was stopped');
            return;
          }
          
          if (!navigator.onLine) {
            console.warn('Network lost while waiting to retry, will retry when online...');
            this.handleNetworkError();
            return;
          }
          
          try {
            console.log(`Attempting to restart recognition (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);
            await this.startListening();
            console.log('Successfully restarted recognition after network error');
          } catch (error) {
            console.error('Failed to restart recognition:', error);
            if (this.autoRestart) {
              this.handleNetworkError();
            }
          }
        }, delay);
      }
    } else {
      const errorMsg = 'Unable to connect to speech recognition service. ' + 
        (navigator.onLine ? 'The service might be temporarily unavailable.' : 'Please check your internet connection.') + 
        ' You can try refreshing the page or coming back later.';
      
      console.error('Max restart attempts reached or auto-restart disabled:', errorMsg);
      this.setState('error', errorMsg, 'network');
    }
  }

  private scheduleRestart(): void {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      const errorMsg = `Could not connect after ${this.maxRestartAttempts} attempts. Please check your network connection and refresh the page to try again.`;
      console.error(errorMsg);
      this.setState('error', errorMsg, 'max-attempts-reached');
      return;
    }

    this.restartAttempts++;
    const baseDelay = Math.min(2000 * Math.pow(1.5, this.restartAttempts - 1), 15000);
    const jitter = Math.floor(Math.random() * 1000);
    const backoffDelay = baseDelay + jitter;
    const remainingAttempts = this.maxRestartAttempts - this.restartAttempts + 1;
    const seconds = Math.ceil(backoffDelay / 1000);
    
    const statusMessage = remainingAttempts > 1
      ? `Connection lost. Reconnecting in ${seconds}s... (${remainingAttempts} attempts left)`
      : 'Final reconnection attempt...';
    
    this.setState('error', statusMessage);
    this.clearRestartTimeout();
    
    console.log(`Scheduling restart in ${backoffDelay}ms (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
    
    this.restartTimeout = window.setTimeout(async () => {
      if (this.currentState === 'stopped') {
        console.log('Not restarting - recognition was stopped');
        return;
      }
      
      try {
        console.log(`Attempting to restart recognition (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);
        
        if (!this.recognition) {
          this.initRecognition();
        }
        
        if (this.recognition) {
          this.recognition.start();
        }
        
        console.log('Successfully restarted recognition');
      } catch (error) {
        console.error('Failed to restart recognition:', error);
        if (this.autoRestart) {
          this.scheduleRestart();
        } else {
          this.setState('error', 'Failed to restart speech recognition', 'restart-failed');
        }
      }
    }, backoffDelay);
  }

  private initRecognition(): void {
    if (this.recognition) {
      console.log('Using existing recognition instance');
      return;
    }

    try {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognitionAPI) {
        throw new Error('Speech Recognition API not supported in this browser');
      }

      this.recognition = new SpeechRecognitionAPI();
      
      if (!this.recognition) {
        throw new Error('Failed to create recognition instance');
      }

      this.recognition.continuous = this.continuous;
      this.recognition.interimResults = this.interimResults;
      this.recognition.lang = this.language;

      this.setupRecognitionHandlers();
      
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      this.setState('error', 'Failed to initialize speech recognition. Please try again or check your browser support.');
      throw error;
    }
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      if (result && result[0]) {
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        const confidence = result[0].confidence;

        if (confidence && confidence < this.wakeConfidenceThreshold) {
          return;
        }

        this.emitTranscript(transcript, isFinal, confidence);

        if (!this.isTranscribing && this.detectWakeWord(transcript)) {
          this.enableTranscriptionMode();
        }

        if (this.isTranscribing && this.detectSleepWord(transcript)) {
          this.disableTranscriptionMode();
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      const errorType = event.error || 'unknown';
      console.error('Speech recognition error:', errorType, event);
      
      switch(errorType) {
        case 'network':
          console.warn('Network error in speech recognition');
          this.handleNetworkError();
          break;
        case 'not-allowed':
        case 'permission-denied':
          console.error('Microphone access denied');
          this.setState('error', 'Microphone access is required. Please allow microphone access and try again.', 'permission-denied');
          break;
        case 'service-not-allowed':
          console.error('Speech recognition not allowed');
          this.setState('error', 'Speech recognition is not allowed. Please check your browser settings.', 'service-not-allowed');
          break;
        default:
          console.error('Unhandled speech recognition error:', errorType);
          this.handleNetworkError();
      }
    };

    this.recognition.onend = () => {
      console.log('Recognition ended');
      if (this.currentState !== 'stopped' && this.autoRestart) {
        this.scheduleRestart();
      }
    };

    this.recognition.onstart = () => {
      console.log('Recognition started');
      this.restartAttempts = 0;
      this.setState('listening');
    };
  }

  private clearRestartTimeout(): void {
    if (this.restartTimeout !== null) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
  }

  private enableTranscriptionMode(): void {
    if (!this.isTranscribing) {
      this.isTranscribing = true;
      this.setState('transcribing');
      console.log('Transcription mode enabled');
    }
  }

  private disableTranscriptionMode(): void {
    if (this.isTranscribing) {
      this.isTranscribing = false;
      this.setState('listening');
      console.log('Transcription mode disabled');
    }
  }

  public async startListening(): Promise<void> {
    if (this.currentState === 'listening' || this.currentState === 'transcribing') {
      console.warn('Already in listening state');
      return;
    }

    // Check network status
    if (!navigator.onLine) {
      this.setState('error', 'No internet connection. Please check your network and try again.', 'offline');
      return;
    }

    // Check microphone access
    const hasMicrophoneAccess = await this.checkMicrophoneAccess();
    if (!hasMicrophoneAccess) {
      return;
    }

    if (!this.recognition) {
      this.initRecognition();
      if (!this.recognition) {
        throw new Error('Failed to initialize speech recognition');
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      if (this.recognition) {
        this.recognition.start();
        this.setState('listening');
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.setState('error', 'Microphone access denied. Please allow microphone access to use speech recognition.', 'permission-denied');
      throw error;
    }
  }

  public stopListening(): void {
    this.clearRestartTimeout();
    this.setState('stopped');
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.warn('Error stopping recognition:', error);
      }
      this.recognition = null;
    }
    
    this.isTranscribing = false;
    this.restartAttempts = 0;
  }

  public enableTranscriptionModePublic(): void {
    this.enableTranscriptionMode();
  }

  public disableTranscriptionModePublic(): void {
    this.disableTranscriptionMode();
  }

  public onEvent(callback: (event: STTEvent) => void): void {
    this.onEventCallback = callback;
  }

  public getState(): STTState {
    return this.currentState;
  }

  public isTranscribingActive(): boolean {
    return this.isTranscribing;
  }
}