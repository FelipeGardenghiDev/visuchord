import * as Tone from 'tone';

export type InstrumentPreset = 'warmPad' | 'electricPiano' | 'ambientGuitar' | 'synthLead';

class SoundEngine {
  private isInitialized = false;
  private polySynth: Tone.PolySynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private chorus: Tone.Chorus | null = null;
  private volumeNode: Tone.Volume | null = null;
  private activePreset: InstrumentPreset = 'warmPad';
  private currentlyPlayingNotes: string[] = [];

  /**
   * Inicializa o contexto de áudio do navegador
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    await Tone.start();

    // Cria os nós de efeito
    this.volumeNode = new Tone.Volume(-6).toDestination();
    this.reverb = new Tone.Reverb({
      decay: 3.5,
      preDelay: 0.05,
      wet: 0.35,
    }).connect(this.volumeNode);

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
}

export const soundEngine = new SoundEngine();
