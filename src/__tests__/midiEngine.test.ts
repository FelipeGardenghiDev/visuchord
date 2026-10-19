import { describe, it, expect } from 'vitest';
import { noteToMidiNumber } from '../lib/midiEngine';

describe('midiEngine - noteToMidiNumber', () => {
  it('should correctly convert standard middle C (C4) to 60', () => {
    expect(noteToMidiNumber('C4')).toBe(60);
  });

  it('should correctly convert A4 to 69', () => {
    expect(noteToMidiNumber('A4')).toBe(69);
  });

  it('should handle sharps and flats properly', () => {
    expect(noteToMidiNumber('C#4')).toBe(61);
    expect(noteToMidiNumber('Db4')).toBe(61);
    expect(noteToMidiNumber('F#3')).toBe(54);
    expect(noteToMidiNumber('Eb3')).toBe(51);
  });

  it('should handle different octaves', () => {
    expect(noteToMidiNumber('C0')).toBe(12);
    expect(noteToMidiNumber('C1')).toBe(24);
    expect(noteToMidiNumber('C3')).toBe(48);
    expect(noteToMidiNumber('C5')).toBe(72);
  });

  it('should clamp out-of-range notes to valid 0-127 MIDI range', () => {
    expect(noteToMidiNumber('C-2')).toBe(0);
    expect(noteToMidiNumber('G9')).toBe(127);
  });

  it('should fallback to 60 for invalid strings', () => {
    expect(noteToMidiNumber('invalid')).toBe(60);
    expect(noteToMidiNumber('')).toBe(60);
  });
});
