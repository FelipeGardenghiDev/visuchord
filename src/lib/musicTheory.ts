// ==========================================
// VisuChord - Music Theory & Chord Generator
// ==========================================

export type Accidental = 'natural' | 'sharp' | 'flat';

export type ChordQuality = 
  | 'major' 
  | 'minor' 
  | 'dominant7' 
  | 'major7' 
  | 'minor7' 
  | 'diminished' 
  | 'halfDiminished' 
  | 'sus4';

export interface ChordDefinition {
  quality: ChordQuality;
  label: string;
  symbol: string;
  intervals: number[]; // semitons a partir da tônica
  description: string;
}

export const CHORD_QUALITIES: Record<ChordQuality, ChordDefinition> = {
  major: {
    quality: 'major',
    label: 'Maior',
    symbol: '',
    intervals: [0, 4, 7],
    description: 'Tríade Maior (Alegre / Estável)',
  },
  minor: {
    quality: 'minor',
    label: 'Menor',
    symbol: 'm',
    intervals: [0, 3, 7],
    description: 'Tríade Menor (Melancólico / Introspectivo)',
  },
  dominant7: {
    quality: 'dominant7',
    label: 'Dominante 7',
    symbol: '7',
    intervals: [0, 4, 7, 10],
    description: 'Tétrade Dominante (Tensão / Preparação)',
  },
  major7: {
    quality: 'major7',
    label: 'Sétima Maior',
    symbol: '7M',
    intervals: [0, 4, 7, 11],
    description: 'Tétrade Maior com Sétima (Jazz / Bossa / Suave)',
  },
  minor7: {
    quality: 'minor7',
    label: 'Menor com 7ª',
    symbol: 'm7',
    intervals: [0, 3, 7, 10],
    description: 'Tétrade Menor com 7ª (Neo-Soul / MPB)',
  },
  halfDiminished: {
    quality: 'halfDiminished',
    label: 'Meio-Diminuto',
    symbol: 'm7(♭5)',
    intervals: [0, 3, 6, 10],
    description: 'Acorde Meio-Diminuto (Misterioso / ii de Menor)',
  },
  diminished: {
    quality: 'diminished',
    label: 'Diminuto',
    symbol: '°',
    intervals: [0, 3, 6, 9],
    description: 'Acorde Diminuto Completo (Tensão Máxima)',
  },
  sus4: {
    quality: 'sus4',
    label: 'Suspenso 4',
    symbol: 'sus4',
    intervals: [0, 5, 7],
    description: 'Acorde Suspenso (Aberto / Sem terça definida)',
  },
};

// Todas as 12 notas cromáticas ocidentais
export const CHROMATIC_NOTES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
] as const;

export type ChromaticNote = typeof CHROMATIC_NOTES[number];

// Mapeamento de enarmônicos (sustenidos para bemóis)
export const ENHARMONICS: Record<string, string> = {
  'C#': 'D♭',
  'D#': 'E♭',
  'F#': 'G♭',
  'G#': 'A♭',
  'A#': 'B♭',
};

// Notas naturais
export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type NaturalNote = typeof NATURAL_NOTES[number];

/**
 * Converte nota base + acidente em uma nota cromática padrão
 */
export function getChromaticNote(baseNote: NaturalNote, accidental: Accidental): ChromaticNote {
  const baseIndices: Record<NaturalNote, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  let semitone = baseIndices[baseNote];

  if (accidental === 'sharp') semitone = (semitone + 1) % 12;
  if (accidental === 'flat') semitone = (semitone + 11) % 12;

  return CHROMATIC_NOTES[semitone];
}

/**
 * Retorna o nome formatado da nota (exibindo sustenido ou bemol)
 */
export function formatNoteName(note: ChromaticNote, preferFlat = false): string {
  if (preferFlat && ENHARMONICS[note]) {
    return ENHARMONICS[note];
  }
  return note;
}

/**
 * Calcula as notas reais (com oitavas) para sintetizar o acorde
 */
export function getChordNotes(
  root: ChromaticNote, 
  quality: ChordQuality, 
  baseOctave = 3
): string[] {
  const rootIndex = CHROMATIC_NOTES.indexOf(root);
  const intervals = CHORD_QUALITIES[quality].intervals;

  return intervals.map((interval) => {
    const totalSemitones = rootIndex + interval;
    const noteName = CHROMATIC_NOTES[totalSemitones % 12];
    const octave = baseOctave + Math.floor(totalSemitones / 12);
    return `${noteName}${octave}`;
  });
}

/**
 * Formata o símbolo completo do acorde (ex: "F#m7(♭5)" ou "B♭7M")
 */
export function getChordFullName(
  root: ChromaticNote, 
  quality: ChordQuality, 
  preferFlat = false
): string {
  const noteName = formatNoteName(root, preferFlat);
  const symbol = CHORD_QUALITIES[quality].symbol;
  return `${noteName}${symbol}`;
}
