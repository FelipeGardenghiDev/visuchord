import { describe, it, expect } from 'vitest';

interface NormalizedPoint {
  x: number;
  y: number;
  z?: number;
}

// Heurísticas cinemáticas reproduzidas para validação matemática determinística
function calculateEuclideanDistance(p1: NormalizedPoint, p2: NormalizedPoint): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function resolveAccidentalByScreenZone(handCenterY: number): 'sharp' | 'natural' | 'flat' {
  if (handCenterY < 0.35) return 'sharp'; // Zona superior da tela
  if (handCenterY > 0.65) return 'flat';  // Zona inferior da tela
  return 'natural';                       // Zona central
}

function resolveTemporalMajority<T>(history: T[], fallback: T): T {
  if (history.length === 0) return fallback;
  const counts = new Map<T, number>();
  let bestItem = history[0];
  let maxCount = 0;

  for (const item of history) {
    const count = (counts.get(item) || 0) + 1;
    counts.set(item, count);
    if (count > maxCount) {
      maxCount = count;
      bestItem = item;
    }
  }
  return bestItem;
}

function isPinchingDetected(thumbTip: NormalizedPoint, indexTip: NormalizedPoint, threshold = 0.058): boolean {
  return calculateEuclideanDistance(thumbTip, indexTip) < threshold;
}

function isStrumDownstroke(
  currentY: number, 
  previousY: number, 
  currentTimeMs: number, 
  lastStrumTimeMs: number,
  velocityThreshold = 0.065,
  debounceMs = 280
): boolean {
  const deltaY = currentY - previousY;
  const isDescendingFast = deltaY > velocityThreshold;
  const isDebounced = (currentTimeMs - lastStrumTimeMs) > debounceMs;
  return isDescendingFast && isDebounced;
}

describe('Vision Engine Kinematics & Heuristics', () => {
  describe('Cálculo de Distâncias Geométricas', () => {
    it('deve calcular distância euclidiana correta entre dois marcos anatômicos', () => {
      const p1: NormalizedPoint = { x: 0.1, y: 0.2 };
      const p2: NormalizedPoint = { x: 0.4, y: 0.6 }; // 0.3² + 0.4² = 0.09 + 0.16 = 0.25 -> sqrt = 0.5
      expect(calculateEuclideanDistance(p1, p2)).toBeCloseTo(0.5, 4);
    });

    it('deve retornar zero para pontos idênticos', () => {
      const p: NormalizedPoint = { x: 0.5, y: 0.5 };
      expect(calculateEuclideanDistance(p, p)).toBe(0);
    });
  });

  describe('Zonas Espaciais de Modulação Cromática (Acidentes)', () => {
    it('deve classificar como sustenido (#) na terça superior da tela (Y < 0.35)', () => {
      expect(resolveAccidentalByScreenZone(0.15)).toBe('sharp');
      expect(resolveAccidentalByScreenZone(0.34)).toBe('sharp');
    });

    it('deve classificar como natural na faixa central (0.35 <= Y <= 0.65)', () => {
      expect(resolveAccidentalByScreenZone(0.35)).toBe('natural');
      expect(resolveAccidentalByScreenZone(0.50)).toBe('natural');
      expect(resolveAccidentalByScreenZone(0.65)).toBe('natural');
    });

    it('deve classificar como bemol (♭) na terça inferior da tela (Y > 0.65)', () => {
      expect(resolveAccidentalByScreenZone(0.66)).toBe('flat');
      expect(resolveAccidentalByScreenZone(0.90)).toBe('flat');
    });
  });

  describe('Detecção de Gesto de Pinça (Pinch)', () => {
    it('deve detectar pinch quando o polegar e indicador estiverem muito próximos', () => {
      const thumbTip = { x: 0.50, y: 0.50 };
      const indexTip = { x: 0.52, y: 0.51 }; // dist = ~0.022 < 0.058
      expect(isPinchingDetected(thumbTip, indexTip)).toBe(true);
    });

    it('não deve detectar pinch quando os dedos estiverem afastados', () => {
      const thumbTip = { x: 0.40, y: 0.50 };
      const indexTip = { x: 0.55, y: 0.50 }; // dist = 0.15 > 0.058
      expect(isPinchingDetected(thumbTip, indexTip)).toBe(false);
    });
  });

  describe('Gatilho de Palhetada (Strumming Downstroke Physics)', () => {
    it('deve acionar a palhetada quando a mão desce rápido o suficiente e após o debounce', () => {
      const prevY = 0.40;
      const currY = 0.49; // delta = +0.09 > 0.065 (descida rápida)
      const lastStrum = 1000;
      const now = 1350;   // 350ms decorridos > 280ms (debounce ok)

      expect(isStrumDownstroke(currY, prevY, now, lastStrum)).toBe(true);
    });

    it('não deve acionar palhetada em movimento de subida (upstroke)', () => {
      const prevY = 0.50;
      const currY = 0.42; // subindo (delta negativo)
      const lastStrum = 1000;
      const now = 1400;

      expect(isStrumDownstroke(currY, prevY, now, lastStrum)).toBe(false);
    });

    it('não deve disparar palhetada se violar a janela de debounce (evitando trigger duplo acidental)', () => {
      const prevY = 0.40;
      const currY = 0.50; // delta = +0.10 (rápido)
      const lastStrum = 1000;
      const now = 1150;   // apenas 150ms decorridos < 280ms

      expect(isStrumDownstroke(currY, prevY, now, lastStrum)).toBe(false);
    });
  });

  describe('Filtro Temporal de Votação Majoritária (Smoothing Anti-Jitter)', () => {
    it('deve filtrar ruídos e retornar o valor majoritário no histórico recente', () => {
      // 4 frames detectaram 'C' e 1 frame com ruído detectou 'D'
      const history = ['C', 'C', 'D', 'C', 'C'];
      expect(resolveTemporalMajority(history, 'C')).toBe('C');
    });

    it('deve se adaptar quando a transição harmônica for confirmada pela maioria dos frames', () => {
      // O usuário mudou de acorde: agora a maioria é 'G'
      const history = ['C', 'G', 'G', 'G', 'G'];
      expect(resolveTemporalMajority(history, 'C')).toBe('G');
    });

    it('deve retornar o fallback para histórico vazio', () => {
      expect(resolveTemporalMajority([], 'A')).toBe('A');
    });
  });
});
