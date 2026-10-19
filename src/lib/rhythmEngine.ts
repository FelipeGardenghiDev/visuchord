import * as Tone from 'tone';
import { soundEngine } from './soundEngine';

export type RhythmPattern = 'metronome' | 'lofi' | 'pulse' | 'off';

export interface RecordedChordEvent {
  timeInBeats: number;
  notes: string[];
}

class RhythmEngine {
  private isInitialized = false;
  private bpm = 100;
  private isPlaying = false;
  private currentPattern: RhythmPattern = 'off';

  // Nós de síntese rítmica
  private kickSynth: Tone.MembraneSynth | null = null;
  private snareSynth: Tone.NoiseSynth | null = null;
  private volumeNode: Tone.Volume | null = null;
  private repeatEventId: number | null = null;
  private currentStep = 0; // Passo de 0 a 15 (16 semicolcheias / 4 tempos)

  // Looper de acordes
  private isLoopRecording = false;
  private isLoopPlaying = false;
  private loopBeats = 16; // 4 compassos 4/4 = 16 tempos
  private loopRecordingStartBeat = 0;
  private recordedChordEvents: RecordedChordEvent[] = [];
  private loopIntervalId: ReturnType<typeof setInterval> | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.volumeNode = new Tone.Volume(-10).toDestination();

      this.kickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.4 },
      }).connect(this.volumeNode);

      this.snareSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      }).connect(this.volumeNode);

      this.setBpm(this.bpm);
      this.isInitialized = true;
    } catch (err) {
      console.warn('RhythmEngine inicializado em modo degradado:', err);
    }
  }

  public setBpm(newBpm: number): void {
    this.bpm = Math.max(40, Math.min(240, newBpm));
    try {
      const transport = Tone.getTransport();
      if (transport && typeof transport === 'object' && 'bpm' in transport) {
        (transport as { bpm: { value: number } }).bpm.value = this.bpm;
      }
    } catch {
      // Ignora erro em ambientes sem AudioContext (ex: testes Node/Vitest)
    }
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setVolume(db: number): void {
    if (this.volumeNode) {
      this.volumeNode.volume.value = db;
    }
  }

  /**
   * Inicia o padrão de ritmo selecionado
   */
  public async start(pattern: RhythmPattern): Promise<void> {
    if (pattern === 'off') {
      this.stop();
      return;
    }

    if (!this.isInitialized) {
      await this.init();
    }

    this.currentPattern = pattern;
    this.isPlaying = true;

    try {
      const transport = Tone.getTransport() as unknown as {
        clear: (id: number) => void;
        scheduleRepeat: (callback: (time: number) => void, interval: string) => number;
        start: () => void;
        state: string;
      };

      if (this.repeatEventId !== null && typeof transport.clear === 'function') {
        transport.clear(this.repeatEventId);
      }

      this.currentStep = 0;

      if (typeof transport.scheduleRepeat === 'function') {
        this.repeatEventId = transport.scheduleRepeat((time) => {
          this.tickStep(time);
        }, '16n');
      }

      if (typeof transport.start === 'function' && transport.state !== 'started') {
        transport.start();
      }
    } catch (err) {
      console.warn('Falha ao agendar repetição no Transport:', err);
    }
  }

  /**
   * Executa a batida correspondente a cada passo rítmico
   */
  private tickStep(time: number): void {
    const step = this.currentStep % 16;
    const isQuarterBeat = step % 4 === 0;
    const beatIndex = Math.floor(step / 4); // 0, 1, 2, 3

    if (this.currentPattern === 'metronome') {
      if (isQuarterBeat) {
        if (beatIndex === 0) {
          // Tempo 1 (Acento agudo)
          this.kickSynth?.triggerAttackRelease('C4', '16n', time, 0.8);
        } else {
          // Tempos 2, 3, 4 (Click regular)
          this.kickSynth?.triggerAttackRelease('G3', '16n', time, 0.4);
        }
      }
    } else if (this.currentPattern === 'lofi') {
      // Bumbo nos tempos 1 e 3 (com antecipação swingada no passo 10)
      if (step === 0 || step === 8 || step === 10) {
        this.kickSynth?.triggerAttackRelease('C2', '8n', time, step === 0 ? 0.9 : 0.7);
      }
      // Caixa / Rimshot nos tempos 2 e 4 (passos 4 e 12)
      if (step === 4 || step === 12) {
        this.snareSynth?.triggerAttackRelease('16n', time, 0.6);
      }
    } else if (this.currentPattern === 'pulse') {
      // Four on the floor constante
      if (isQuarterBeat) {
        this.kickSynth?.triggerAttackRelease('D1', '8n', time, 0.85);
      }
      // Shaker em contratempos
      if (step % 2 === 1) {
        this.snareSynth?.triggerAttackRelease('32n', time, 0.2);
      }
    }

    this.currentStep++;
  }

  /**
   * Para a execução rítmica
   */
  public stop(): void {
    this.isPlaying = false;
    this.currentPattern = 'off';

    try {
      const transport = Tone.getTransport() as unknown as {
        clear: (id: number) => void;
        stop: () => void;
      };

      if (this.repeatEventId !== null && typeof transport.clear === 'function') {
        transport.clear(this.repeatEventId);
        this.repeatEventId = null;
      }
      if (!this.isLoopPlaying && typeof transport.stop === 'function') {
        transport.stop();
      }
    } catch {
      // Ignora erro em ambientes sem Transport ativo
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentPattern(): RhythmPattern {
    return this.currentPattern;
  }

  // --- LOOPER DE PROGRESSÕES DE ACORDES ---

  public startLoopRecording(): void {
    this.isLoopRecording = true;
    this.recordedChordEvents = [];
    try {
      const transport = Tone.getTransport() as unknown as { ticks: number };
      this.loopRecordingStartBeat = transport.ticks || Date.now();
    } catch {
      this.loopRecordingStartBeat = Date.now();
    }
  }

  public recordChord(notes: string[]): void {
    if (!this.isLoopRecording) return;

    let timeInBeats = 0;
    try {
      const transport = Tone.getTransport() as unknown as { ticks: number; PPQ: number };
      const currentTick = transport.ticks || Date.now();
      const elapsedTicks = currentTick - this.loopRecordingStartBeat;
      const ticksPerBeat = transport.PPQ || 192;
      timeInBeats = (elapsedTicks / ticksPerBeat) % this.loopBeats;
    } catch {
      timeInBeats = ((Date.now() - this.loopRecordingStartBeat) / 600) % this.loopBeats;
    }

    this.recordedChordEvents.push({
      timeInBeats,
      notes: [...notes],
    });
  }

  public stopLoopRecordingAndPlay(): void {
    this.isLoopRecording = false;
    if (this.recordedChordEvents.length === 0) return;

    this.isLoopPlaying = true;
    const msPerBeat = (60 / this.bpm) * 1000;
    const totalLoopMs = this.loopBeats * msPerBeat;

    if (this.loopIntervalId) clearInterval(this.loopIntervalId);

    // Agenda os acordes registrados em loop contínuo
    const scheduleLoopPass = () => {
      this.recordedChordEvents.forEach((evt) => {
        const triggerDelay = evt.timeInBeats * msPerBeat;
        setTimeout(() => {
          if (this.isLoopPlaying) {
            soundEngine.strumChord(evt.notes);
          }
        }, triggerDelay);
      });
    };

    scheduleLoopPass();
    this.loopIntervalId = setInterval(scheduleLoopPass, totalLoopMs);
  }

  public stopLoop(): void {
    this.isLoopPlaying = false;
    this.isLoopRecording = false;
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }
  }

  public getLoopState(): { isRecording: boolean; isPlaying: boolean; eventCount: number } {
    return {
      isRecording: this.isLoopRecording,
      isPlaying: this.isLoopPlaying,
      eventCount: this.recordedChordEvents.length,
    };
  }
}

export const rhythmEngine = new RhythmEngine();
