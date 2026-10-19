import * as Tone from 'tone';
import { midiEngine } from './midiEngine';

export type InstrumentPreset = 'warmPad' | 'electricPiano' | 'ambientGuitar' | 'synthLead';

class SoundEngine {
  private isInitialized = false;
  private polySynth: Tone.PolySynth | null = null;
  private filter: Tone.Filter | null = null;
  private filterCutoffHz = 8000;
  private reverb: Tone.Reverb | null = null;
  private chorus: Tone.Chorus | null = null;
  private limiter: Tone.Limiter | null = null;
  private volumeNode: Tone.Volume | null = null;
  private recorder: Tone.Recorder | null = null;
  private analyser: Tone.Analyser | null = null;
  private recording = false;
  private activePreset: InstrumentPreset = 'warmPad';
  private currentlyPlayingNotes: string[] = [];
  private sustainedNotes: string[] = [];

  /**
   * Inicializa o contexto de áudio do navegador e a cadeia de efeitos
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    await Tone.start();
    await midiEngine.init();

    // Volume Master e Limitador Brickwall (-1 dBFS)
    this.volumeNode = new Tone.Volume(-6).toDestination();
    this.limiter = new Tone.Limiter(-1).connect(this.volumeNode);

    // Gravador e Analisador de Onda em tempo real
    this.recorder = new Tone.Recorder();
    this.volumeNode.connect(this.recorder);

    this.analyser = new Tone.Analyser('waveform', 128);
    this.volumeNode.connect(this.analyser);

    // Efeitos Espaciais
    this.reverb = new Tone.Reverb({
      decay: 3.5,
      preDelay: 0.05,
      wet: 0.35,
    }).connect(this.limiter);

    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.6,
      wet: 0.3,
    }).connect(this.reverb);

    this.chorus.start();

    // Filtro Passa-Baixas Moog-style para Modulação Expressiva
    this.filter = new Tone.Filter({
      frequency: this.filterCutoffHz,
      type: 'lowpass',
      rolloff: -24,
      Q: 2,
    }).connect(this.chorus);

    // Sintetizador Polifônico conectado ao filtro
    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.08,
        decay: 0.3,
        sustain: 0.7,
        release: 1.2,
      },
    }).connect(this.filter);

    this.applyPreset(this.activePreset);
    this.isInitialized = true;
  }

  /**
   * Dispara um acorde inteiro simultaneamente
   */
  public playChord(notes: string[], duration = '2n'): void {
    if (!this.isInitialized || !this.polySynth) return;

    try {
      this.currentlyPlayingNotes = notes;
      this.polySynth.triggerAttackRelease(notes, duration);
      midiEngine.sendChordOn(notes);
    } catch (err) {
      console.warn('Erro ao tocar acorde:', err);
    }
  }

  /**
   * Dedilha / palheta as notas em cascata rápida (efeito strum)
   */
  public strumChord(notes: string[], speedMs = 35): void {
    if (!this.isInitialized || !this.polySynth) return;

    try {
      this.currentlyPlayingNotes = notes;
      const now = Tone.now();

      notes.forEach((note, index) => {
        const timeOffset = (index * speedMs) / 1000;
        this.polySynth?.triggerAttackRelease(note, '1.5n', now + timeOffset);
      });

      midiEngine.sendChordOn(notes);
    } catch (err) {
      console.warn('Erro ao dedilhar acorde:', err);
    }
  }

  /**
   * Mantém o acorde sustentado continuamente com condução suave de vozes (Voice Leading)
   */
  public setSustainedChord(notes: string[]): void {
    if (!this.isInitialized || !this.polySynth) return;

    const areEqual =
      this.sustainedNotes.length === notes.length &&
      this.sustainedNotes.every((n, i) => n === notes[i]);
    if (areEqual) return;

    try {
      const notesToRelease = this.sustainedNotes.filter((n) => !notes.includes(n));
      const notesToAttack = notes.filter((n) => !this.sustainedNotes.includes(n));

      if (notesToRelease.length > 0) {
        this.polySynth.triggerRelease(notesToRelease);
      }
      if (notesToAttack.length > 0) {
        this.polySynth.triggerAttack(notesToAttack);
      }

      this.sustainedNotes = [...notes];
      this.currentlyPlayingNotes = [...notes];
      midiEngine.sendChordOn(notes);
    } catch (err) {
      console.warn('Erro ao sustentar acorde:', err);
    }
  }

  /**
   * Encerra a sustentação de qualquer acorde ativo
   */
  public stopSustainedChord(): void {
    if (!this.isInitialized || !this.polySynth) return;
    if (this.sustainedNotes.length === 0) return;

    try {
      this.polySynth.releaseAll();
      this.sustainedNotes = [];
      this.currentlyPlayingNotes = [];
      midiEngine.sendChordOff();
    } catch (err) {
      console.warn('Erro ao parar sustentação:', err);
    }
  }

  public isSustaining(): boolean {
    return this.sustainedNotes.length > 0;
  }

  /**
   * Modula a frequência de corte do filtro passa-baixas (Moog-style filter cutoff)
   * @param normalizedVal Valor normalizado de 0 a 1 (0 = escuro/250Hz, 1 = brilhante/14kHz)
   */
  public setFilterCutoff(normalizedVal: number): void {
    const clamped = Math.max(0, Math.min(1, normalizedVal));
    const minFreq = 250;
    const maxFreq = 14000;
    const freq = Math.round(minFreq * Math.pow(maxFreq / minFreq, clamped));
    this.filterCutoffHz = freq;

    if (this.filter) {
      this.filter.frequency.rampTo(freq, 0.05);
    }
    midiEngine.sendControlChange(74, Math.round(clamped * 127));
  }

  public getFilterCutoff(): number {
    return this.filterCutoffHz;
  }

  /**
   * Retorna os dados da forma de onda do osciloscópio (128 amostras normalizadas entre -1 e +1)
   */
  public getWaveformData(): Float32Array {
    if (!this.analyser) return new Float32Array(0);
    return this.analyser.getValue() as Float32Array;
  }

  /**
   * Troca o timbre do sintetizador
   */
  public applyPreset(preset: InstrumentPreset): void {
    this.activePreset = preset;
    if (!this.polySynth) return;

    switch (preset) {
      case 'warmPad':
        this.polySynth.set({
          oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
          envelope: { attack: 0.25, decay: 0.4, sustain: 0.8, release: 2.0 },
        });
        if (this.reverb) this.reverb.wet.value = 0.45;
        if (this.chorus) this.chorus.wet.value = 0.4;
        break;

      case 'electricPiano':
        this.polySynth.set({
          oscillator: { type: 'fmsine', modulationType: 'triangle', harmonicity: 2 },
          envelope: { attack: 0.02, decay: 0.8, sustain: 0.3, release: 0.8 },
        });
        if (this.reverb) this.reverb.wet.value = 0.25;
        if (this.chorus) this.chorus.wet.value = 0.55;
        break;

      case 'ambientGuitar':
        this.polySynth.set({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.015, decay: 1.2, sustain: 0.2, release: 1.5 },
        });
        if (this.reverb) this.reverb.wet.value = 0.5;
        if (this.chorus) this.chorus.wet.value = 0.2;
        break;

      case 'synthLead':
        this.polySynth.set({
          oscillator: { type: 'pulse', width: 0.4 },
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.5 },
        });
        if (this.reverb) this.reverb.wet.value = 0.2;
        if (this.chorus) this.chorus.wet.value = 0.25;
        break;
    }
  }

  public setVolume(db: number): void {
    if (this.volumeNode) {
      this.volumeNode.volume.value = db;
    }
  }

  public getCurrentlyPlayingNotes(): string[] {
    return this.currentlyPlayingNotes;
  }

  /**
   * Inicia a gravação direta do fluxo de áudio estéreo
   */
  public async startRecording(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (!this.recorder || this.recording) return false;

    try {
      this.recorder.start();
      this.recording = true;
      return true;
    } catch (err) {
      console.warn('Falha ao iniciar Tone.Recorder:', err);
      return false;
    }
  }

  /**
   * Finaliza a gravação e retorna o arquivo de áudio gravado (Blob)
   */
  public async stopRecording(): Promise<Blob | null> {
    if (!this.recorder || !this.recording) return null;

    try {
      this.recording = false;
      const audioBlob = await this.recorder.stop();
      return audioBlob;
    } catch (err) {
      console.warn('Falha ao finalizar Tone.Recorder:', err);
      this.recording = false;
      return null;
    }
  }

  /**
   * Dispara o download automático do arquivo de áudio no navegador
   */
  public downloadRecording(blob: Blob, customName?: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = customName || `visuchord-performance-${timestamp}.webm`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }

  /**
   * Retorna a latência estimada da camada Web Audio API em milissegundos
   */
  public getAudioLatency(): number {
    try {
      const rawCtx = Tone.getContext().rawContext;
      if (rawCtx) {
        const baseLatency = (rawCtx as AudioContext).baseLatency || 0;
        const outputLatency = (rawCtx as AudioContext).outputLatency || 0;
        const totalSec = baseLatency + outputLatency;
        if (totalSec > 0) {
          return Number((totalSec * 1000).toFixed(1));
        }
      }
    } catch {
      // Ignora erro se contexto não inicializado
    }
    return 10.0;
  }
}

export const soundEngine = new SoundEngine();
