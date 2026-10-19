import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AVAILABLE_GESTURES,
  DEFAULT_GESTURE_CONFIG,
  loadGestureConfig,
  saveGestureConfig,
  resetGestureConfig,
  type GestureMappingConfig,
  type GestureId,
} from '../lib/gestureConfig';

describe('Gesture Configuration Engine', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    // Stubs para simular o ambiente de browser do cliente
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  describe('Catalog & Defaults', () => {
    it('deve conter catálogo com 10 gestos anatômicos reconhecíveis', () => {
      const keys = Object.keys(AVAILABLE_GESTURES);
      expect(keys).toHaveLength(10);
      expect(keys).toContain('fist');
      expect(keys).toContain('one_finger');
      expect(keys).toContain('two_fingers');
      expect(keys).toContain('three_fingers');
      expect(keys).toContain('four_fingers');
      expect(keys).toContain('five_fingers');
      expect(keys).toContain('hang_loose');
      expect(keys).toContain('horns');
      expect(keys).toContain('pinch');
      expect(keys).toContain('thumb_up');
    });

    it('todos os gestos do catálogo devem ter nome, emoji e descrição preenchidos', () => {
      Object.values(AVAILABLE_GESTURES).forEach((gesture) => {
        expect(gesture.id).toBeTruthy();
        expect(gesture.name).toBeTruthy();
        expect(gesture.emoji).toBeTruthy();
        expect(gesture.description).toBeTruthy();
      });
    });

    it('a configuração padrão deve mapear todas as 7 notas naturais para a mão esquerda', () => {
      const notes = Object.keys(DEFAULT_GESTURE_CONFIG.leftHandNotes);
      expect(notes).toHaveLength(7);
      expect(notes).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    });

    it('a configuração padrão deve mapear todas as 8 qualidades harmônicas para a mão direita', () => {
      const qualities = Object.keys(DEFAULT_GESTURE_CONFIG.rightHandQualities);
      expect(qualities).toHaveLength(8);
      expect(qualities).toEqual([
        'major',
        'minor',
        'dominant7',
        'major7',
        'minor7',
        'sus4',
        'halfDiminished',
        'diminished',
      ]);
    });
  });

  describe('Storage Persistence (load / save / reset)', () => {
    it('deve retornar DEFAULT_GESTURE_CONFIG quando o localStorage estiver vazio', () => {
      const config = loadGestureConfig();
      expect(config).toEqual(DEFAULT_GESTURE_CONFIG);
    });

    it('deve salvar e recarregar corretamente uma personalização de gestos', () => {
      const customConfig: GestureMappingConfig = {
        leftHandNotes: {
          ...DEFAULT_GESTURE_CONFIG.leftHandNotes,
          C: 'fist', // Customizou C para punho fechado
        },
        rightHandQualities: {
          ...DEFAULT_GESTURE_CONFIG.rightHandQualities,
          major: 'thumb_up', // Customizou Maior para polegar pra cima
        },
      };

      saveGestureConfig(customConfig);
      const reloaded = loadGestureConfig();

      expect(reloaded.leftHandNotes.C).toBe('fist');
      expect(reloaded.rightHandQualities.major).toBe('thumb_up');
      // Demais notas devem permanecer preservadas
      expect(reloaded.leftHandNotes.D).toBe('two_fingers');
    });

    it('deve fazer merge resiliente se o localStorage contiver dados parciais', () => {
      const partialData = {
        leftHandNotes: {
          C: 'horns' as GestureId,
        },
      };
      localStorage.setItem('visuchord_gesture_mapping_v1', JSON.stringify(partialData));

      const loaded = loadGestureConfig();
      expect(loaded.leftHandNotes.C).toBe('horns');
      // As demais propriedades não devem ser undefined
      expect(loaded.leftHandNotes.E).toBe('three_fingers');
      expect(loaded.rightHandQualities.minor).toBe('two_fingers');
    });

    it('deve retornar configuração padrão e não quebrar se o localStorage estiver corrompido', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem('visuchord_gesture_mapping_v1', '{invalid-json---corrupted');
      const loaded = loadGestureConfig();
      expect(loaded).toEqual(DEFAULT_GESTURE_CONFIG);
      warnSpy.mockRestore();
    });

    it('deve resetar o armazenamento com resetGestureConfig()', () => {
      saveGestureConfig({
        ...DEFAULT_GESTURE_CONFIG,
        leftHandNotes: { ...DEFAULT_GESTURE_CONFIG.leftHandNotes, A: 'fist' },
      });

      const resetResult = resetGestureConfig();
      expect(resetResult).toEqual(DEFAULT_GESTURE_CONFIG);
      expect(localStorage.getItem('visuchord_gesture_mapping_v1')).toBeNull();
    });
  });
});
