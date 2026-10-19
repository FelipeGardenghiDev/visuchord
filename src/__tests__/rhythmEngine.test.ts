import { describe, it, expect, beforeEach } from 'vitest';
import { rhythmEngine } from '../lib/rhythmEngine';

describe('rhythmEngine', () => {
  beforeEach(() => {
    rhythmEngine.stop();
    rhythmEngine.stopLoop();
  });

  it('should initialize with default BPM of 100', () => {
    expect(rhythmEngine.getBpm()).toBe(100);
  });

  it('should allow clamping BPM between 40 and 240', () => {
    rhythmEngine.setBpm(120);
    expect(rhythmEngine.getBpm()).toBe(120);

    rhythmEngine.setBpm(20);
    expect(rhythmEngine.getBpm()).toBe(40);

    rhythmEngine.setBpm(300);
    expect(rhythmEngine.getBpm()).toBe(240);
  });

  it('should report loop state accurately', () => {
    const initialState = rhythmEngine.getLoopState();
    expect(initialState.isRecording).toBe(false);
    expect(initialState.isPlaying).toBe(false);
    expect(initialState.eventCount).toBe(0);

    rhythmEngine.startLoopRecording();
    expect(rhythmEngine.getLoopState().isRecording).toBe(true);

    rhythmEngine.recordChord(['C3', 'E3', 'G3']);
    expect(rhythmEngine.getLoopState().eventCount).toBe(1);

    rhythmEngine.stopLoop();
    expect(rhythmEngine.getLoopState().isRecording).toBe(false);
    expect(rhythmEngine.getLoopState().isPlaying).toBe(false);
  });
});
