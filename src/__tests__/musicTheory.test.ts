import { describe, it, expect } from 'vitest';
import {
  CHORD_QUALITIES,
  CHROMATIC_NOTES,
  ENHARMONICS,
  NATURAL_NOTES,
  formatNoteName,
  getChordFullName,
  getChordNotes,
  getChromaticNote,
  type ChordQuality,
} from '../lib/musicTheory';

describe('Music Theory Engine', () => {
  describe('Constants & Structures', () => {
    it('deve conter exatamente 12 notas cromáticas ocidentais', () => {
      expect(CHROMATIC_NOTES).toHaveLength(12);
      expect(CHROMATIC_NOTES).toEqual([
        'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
      ]);
    });

    it('deve conter 7 notas naturais', () => {
      expect(NATURAL_NOTES).toHaveLength(7);
      expect(NATURAL_NOTES).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    });

    it('deve mapear os 5 acidentes enarmônicos principais', () => {
      expect(ENHARMONICS).toEqual({
        'C#': 'D♭',
        'D#': 'E♭',
        'F#': 'G♭',
        'G#': 'A♭',
        'A#': 'B♭',
      });
    });

    it('deve definir todas as 8 qualidades harmônicas com intervalos válidos', () => {
      const qualities: ChordQuality[] = [
        'major',
        'minor',
        'dominant7',
        'major7',
        'minor7',
        'halfDiminished',
        'diminished',
        'sus4',
      ];

      qualities.forEach((q) => {
        const def = CHORD_QUALITIES[q];
        expect(def).toBeDefined();
        expect(def.quality).toBe(q);
        expect(def.intervals.length).toBeGreaterThanOrEqual(3);
        expect(def.intervals[0]).toBe(0); // A tônica deve ser sempre 0 semitons
      });
    });
  });

  describe('getChromaticNote() - Conversão de Base + Acidente', () => {
    it('deve retornar a nota natural sem alteração quando accidental for "natural"', () => {
      expect(getChromaticNote('C', 'natural')).toBe('C');
      expect(getChromaticNote('E', 'natural')).toBe('E');
      expect(getChromaticNote('B', 'natural')).toBe('B');
    });

    it('deve calcular corretamente o sustenido (+1 semitom)', () => {
      expect(getChromaticNote('C', 'sharp')).toBe('C#');
      expect(getChromaticNote('F', 'sharp')).toBe('F#');
      expect(getChromaticNote('G', 'sharp')).toBe('G#');
      // Casos enarmônicos sem tecla preta intermediária:
      expect(getChromaticNote('E', 'sharp')).toBe('F');
      expect(getChromaticNote('B', 'sharp')).toBe('C');
    });

    it('deve calcular corretamente o bemol (-1 semitom)', () => {
      expect(getChromaticNote('D', 'flat')).toBe('C#'); // D♭
      expect(getChromaticNote('A', 'flat')).toBe('G#'); // A♭
      expect(getChromaticNote('B', 'flat')).toBe('A#'); // B♭
      // Casos enarmônicos sem tecla preta intermediária:
      expect(getChromaticNote('C', 'flat')).toBe('B');
      expect(getChromaticNote('F', 'flat')).toBe('E');
    });
  });

  describe('formatNoteName() - Apresentação Visual', () => {
    it('deve manter o nome da nota padrão quando preferFlat for false', () => {
      expect(formatNoteName('C#', false)).toBe('C#');
      expect(formatNoteName('G#', false)).toBe('G#');
      expect(formatNoteName('D', false)).toBe('D');
    });

    it('deve converter para enarmônico com bemol quando preferFlat for true', () => {
      expect(formatNoteName('C#', true)).toBe('D♭');
      expect(formatNoteName('A#', true)).toBe('B♭');
      expect(formatNoteName('F#', true)).toBe('G♭');
    });

    it('não deve alterar notas naturais mesmo com preferFlat true', () => {
      expect(formatNoteName('C', true)).toBe('C');
      expect(formatNoteName('A', true)).toBe('A');
    });
  });

  describe('getChordNotes() - Geração de Acordes com Oitavas', () => {
    it('deve gerar tríade de C Maior (C3, E3, G3)', () => {
      const notes = getChordNotes('C', 'major', 3);
      expect(notes).toEqual(['C3', 'E3', 'G3']);
    });

    it('deve gerar tríade de A Menor (A3, C4, E4) com avanço de oitava correto', () => {
      const notes = getChordNotes('A', 'minor', 3);
      expect(notes).toEqual(['A3', 'C4', 'E4']);
    });

    it('deve gerar tétrade de G Dominante 7 (G3, B3, D4, F4)', () => {
      const notes = getChordNotes('G', 'dominant7', 3);
      expect(notes).toEqual(['G3', 'B3', 'D4', 'F4']);
    });

    it('deve gerar tétrade de C Sétima Maior (C3, E3, G3, B3)', () => {
      const notes = getChordNotes('C', 'major7', 3);
      expect(notes).toEqual(['C3', 'E3', 'G3', 'B3']);
    });

    it('deve gerar tétrade Meio-Diminuta de Bm7(♭5) (B3, D4, F4, A4)', () => {
      const notes = getChordNotes('B', 'halfDiminished', 3);
      expect(notes).toEqual(['B3', 'D4', 'F4', 'A4']);
    });

    it('deve gerar tétrade Diminuta de C° (C3, D#3, F#3, A3)', () => {
      const notes = getChordNotes('C', 'diminished', 3);
      expect(notes).toEqual(['C3', 'D#3', 'F#3', 'A3']);
    });

    it('deve gerar acorde Suspenso Dsus4 (D3, G3, A3)', () => {
      const notes = getChordNotes('D', 'sus4', 3);
      expect(notes).toEqual(['D3', 'G3', 'A3']);
    });
  });

  describe('getChordFullName() - Notação Harmônica Completa', () => {
    it('deve formatar acordes maiores omitindo o sufixo "M"', () => {
      expect(getChordFullName('C', 'major')).toBe('C');
      expect(getChordFullName('F#', 'major')).toBe('F#');
    });

    it('deve formatar acordes menores com "m"', () => {
      expect(getChordFullName('A', 'minor')).toBe('Am');
      expect(getChordFullName('D', 'minor')).toBe('Dm');
    });

    it('deve formatar tétrades complexas e enriquecidas', () => {
      expect(getChordFullName('G', 'dominant7')).toBe('G7');
      expect(getChordFullName('C', 'major7')).toBe('C7M');
      expect(getChordFullName('D', 'minor7')).toBe('Dm7');
      expect(getChordFullName('B', 'halfDiminished')).toBe('Bm7(♭5)');
      expect(getChordFullName('C', 'diminished')).toBe('C°');
      expect(getChordFullName('A', 'sus4')).toBe('Asus4');
    });

    it('deve aplicar bemóis enarmônicos na notação quando solicitado', () => {
      expect(getChordFullName('A#', 'minor7', true)).toBe('B♭m7');
      expect(getChordFullName('D#', 'major7', true)).toBe('E♭7M');
    });
  });
});
