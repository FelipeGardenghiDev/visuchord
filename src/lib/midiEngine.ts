/**
 * Web MIDI API Engine para o VisuChord
 * Permite que o VisuChord atue como um controlador MIDI no ar para DAWs
 * (Ableton Live, FL Studio, Logic Pro, Reaper) e sintetizadores de hardware.
 */

export interface MIDIOutputPort {
  id: string;
  name: string;
  manufacturer?: string;
  state: string;
}

interface RawMIDIOutputPort {
  id: string;
  name?: string;
  manufacturer?: string;
  state: string;
  send: (data: number[]) => void;
}

interface RawMIDIAccess {
  outputs: {
    forEach: (callback: (port: RawMIDIOutputPort) => void) => void;
  };
}

const NOTE_OFFSETS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

/**
 * Converte uma notação de nota musical (ex: 'C4', 'F#3', 'Bb2') para o número MIDI (0-127)
 */
export function noteToMidiNumber(noteStr: string): number {
  const match = noteStr.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 60; // Fallback C4

  const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  const normalizedName = noteName.replace('b', 'b');
  const octave = parseInt(match[2], 10);

  const semitone = NOTE_OFFSETS[noteName] ?? NOTE_OFFSETS[normalizedName] ?? 0;
  const midi = (octave + 1) * 12 + semitone;
  return Math.max(0, Math.min(127, midi));
}

class MIDIEngine {
  private midiAccess: RawMIDIAccess | null = null;
  private selectedOutputId: string | null = null;
  private activeNotes: Set<number> = new Set();
  private isSupported: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  /**
   * Inicializa o subsistema Web MIDI solicitando acesso ao navegador
   */
  public async init(): Promise<boolean> {
    if (!this.isSupported || this.isInitialized) {
      return this.isSupported;
    }

    try {
      const nav = navigator as unknown as {
        requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<RawMIDIAccess>;
      };
      if (typeof nav.requestMIDIAccess === 'function') {
        this.midiAccess = await nav.requestMIDIAccess({ sysex: false });
        this.isInitialized = true;
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Web MIDI API não autorizada ou indisponível:', err);
      return false;
    }
  }

  /**
   * Retorna a lista de dispositivos MIDI de saída detectados no computador
   */
  public getAvailableOutputs(): MIDIOutputPort[] {
    if (!this.midiAccess) return [];

    const outputs: MIDIOutputPort[] = [];
    this.midiAccess.outputs.forEach((port: RawMIDIOutputPort) => {
      outputs.push({
        id: port.id,
        name: port.name || `Dispositivo MIDI (${port.id})`,
        manufacturer: port.manufacturer,
        state: port.state,
      });
    });
    return outputs;
  }

  /**
   * Seleciona qual porta MIDI receberá as notas (ou null para broadcast em todas)
   */
  public selectOutput(id: string | null): void {
    this.selectedOutputId = id;
  }

  public getSelectedOutput(): string | null {
    return this.selectedOutputId;
  }

  /**
   * Dispara mensagens MIDI Note On para as notas do acorde
   */
  public sendChordOn(noteStrings: string[], velocity = 96): void {
    if (!this.midiAccess) return;

    // Encerra notas anteriores ativas para evitar notas presas (hanging notes)
    this.sendChordOff();

    const midiNotes = noteStrings.map(noteToMidiNumber);

    this.midiAccess.outputs.forEach((port: RawMIDIOutputPort) => {
      if (this.selectedOutputId && port.id !== this.selectedOutputId) return;

      midiNotes.forEach((midiNum) => {
        try {
          // Status 0x90 = Note On no Canal 1, midiNum = Nota, velocity = Intensidade
          port.send([0x90, midiNum, Math.min(127, Math.max(1, velocity))]);
          this.activeNotes.add(midiNum);
        } catch (err) {
          console.warn('Falha ao enviar MIDI Note On:', err);
        }
      });
    });
  }

  /**
   * Envia mensagens MIDI Note Off para todas as notas ativas ou uma lista específica
   */
  public sendChordOff(noteStrings?: string[]): void {
    if (!this.midiAccess || this.activeNotes.size === 0) return;

    const notesToTurnOff = noteStrings 
      ? noteStrings.map(noteToMidiNumber)
      : Array.from(this.activeNotes);

    this.midiAccess.outputs.forEach((port: RawMIDIOutputPort) => {
      if (this.selectedOutputId && port.id !== this.selectedOutputId) return;

      notesToTurnOff.forEach((midiNum) => {
        try {
          // Status 0x80 = Note Off no Canal 1
          port.send([0x80, midiNum, 0]);
          this.activeNotes.delete(midiNum);
        } catch (err) {
          console.warn('Falha ao enviar MIDI Note Off:', err);
        }
      });
    });
  }

  /**
   * Envia mensagem de Control Change (ex: CC 74 para Filter Cutoff, CC 1 para Mod Wheel)
   */
  public sendControlChange(controller: number, value: number, channel = 0): void {
    if (!this.midiAccess) return;

    const clampedVal = Math.max(0, Math.min(127, Math.round(value)));
    const status = 0xb0 | (channel & 0x0f); // 0xB0 = CC no canal especificado

    this.midiAccess.outputs.forEach((port: RawMIDIOutputPort) => {
      if (this.selectedOutputId && port.id !== this.selectedOutputId) return;

      try {
        port.send([status, controller & 0x7f, clampedVal]);
      } catch (err) {
        console.warn('Falha ao enviar MIDI Control Change:', err);
      }
    });
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }
}

export const midiEngine = new MIDIEngine();
