import { describe, it, expect } from 'vitest';
import { generateSimulatedHandLandmarks } from '../lib/virtualHandSimulator';
import { GESTURE_IDS } from '../lib/gestureConfig';

describe('virtualHandSimulator', () => {
  it('should generate exactly 21 normalized landmarks for all supported gestures', () => {
    GESTURE_IDS.forEach((gesture) => {
      const leftLandmarks = generateSimulatedHandLandmarks(gesture, 'Left');
      expect(leftLandmarks).toHaveLength(21);

      const rightLandmarks = generateSimulatedHandLandmarks(gesture, 'Right');
      expect(rightLandmarks).toHaveLength(21);

      // Verify all landmarks have finite coordinates within reasonable boundaries
      leftLandmarks.forEach((pt) => {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      });
      rightLandmarks.forEach((pt) => {
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.y)).toBe(true);
      });
    });
  });

  it('should position the wrist at the base of the hand', () => {
    const landmarks = generateSimulatedHandLandmarks('five_fingers', 'Left', 0.3, 0.5);
    const wrist = landmarks[0];
    const indexTip = landmarks[8];

    // Wrist y should be lower (higher numerical value in canvas coordinates) than index tip
    expect(wrist.y).toBeGreaterThan(indexTip.y);
  });

  it('should differentiate left and right hand horizontal orientations', () => {
    const leftHand = generateSimulatedHandLandmarks('five_fingers', 'Left', 0.28, 0.5);
    const rightHand = generateSimulatedHandLandmarks('five_fingers', 'Right', 0.72, 0.5);

    // Left hand center is on the left side (< 0.5)
    expect(leftHand[0].x).toBeLessThan(0.5);
    // Right hand center is on the right side (> 0.5)
    expect(rightHand[0].x).toBeGreaterThan(0.5);
  });
});
