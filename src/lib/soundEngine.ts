import * as Tone from 'tone';

export type InstrumentPreset = 'warmPad' | 'electricPiano' | 'ambientGuitar' | 'synthLead';

class SoundEngine {
  private isInitialized = false;
  private polySynth: Tone.PolySynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private chorus: Tone.Chorus | null = null;
  private limiter: Tone.Limiter | null = null;
  private volumeNode: Tone.Volume | null = null;
  private recorder: Tone.Recorder | null = null;
  private recording = false;
  private activePreset: InstrumentPreset = 'warmPad';
  private currentlyPlayingNotes: string[] = [];
  private sustainedNotes: string[] = [];

  /**
   * Inicializa o contexto de áudio do navegador
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    await Tone.start();

    // Cria os nós de efeito e proteção contra distorção (Limiter)
    this.volumeNode = new Tone.Volume(-6).toDestination();
    this.limiter = new Tone.Limiter(-1).connect(this.volumeNode);

    // Conecta o gravador de performance em paralelo com a saída de áudio
    this.recorder = new Tone.Recorder();
    this.volumeNode.connect(this.recorder);

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

    // Cria o sintetizador polifônico
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
    }).connect(this.chorus);

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
    } catch (err) {
      console.warn('Erro ao dedilhar acorde:', err);
    }
  }

  /**
   * Mantém o acorde sustentado continuamente com condução suave de vozes (Voice Leading)
   */
  public setSustainedChord(notes: string[]): void {
    if (!this.isInitialized || !this.polySynth) return;

    // Se as notas forem exatamente as mesmas, não faz nada para evitar re-ataque brusco
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
    } catch (err) {
      console.warn('Erro ao parar sustentação:', err);
    }
  }

  public isSustaining(): boolean {
    return this.sustainedNotes.length > 0;
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
        break;

      case 'electricPiano':
        this.polySynth.set({
          oscillator: { type: 'fmsine', modulationType: 'triangle', harmonicity: 2 },
          envelope: { attack: 0.02, decay: 0.8, sustain: 0.3, release: 1.2 },
        });
        if (this.reverb) this.reverb.wet.value = 0.25;
        break;

      case 'ambientGuitar':
        this.polySynth.set({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 1.2, sustain: 0.1, release: 1.5 },
        });
        if (this.reverb) this.reverb.wet.value = 0.5;
        break;

      case 'synthLead':
        this.polySynth.set({
          oscillator: { type: 'square' },
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.9, release: 0.8 },
        });
        if (this.reverb) this.reverb.wet.value = 0.2;
        break;
    }
  }

  /**
   * Ajusta o volume principal (em dB, de -40 a 0)
   */
  public setVolume(val: number): void {
    if (this.volumeNode) {
      this.volumeNode.volume.value = val;
    }
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public getCurrentlyPlayingNotes(): string[] {
    return this.currentlyPlayingNotes;
  }

  public isRecordingActive(): boolean {
    return this.recording;
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
