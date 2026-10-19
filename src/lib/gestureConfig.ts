import { type NaturalNote, type ChordQuality } from './musicTheory';

export type GestureId = 
  | 'fist'           // ✊ Punho Fechado
  | 'one_finger'     // ☝️ 1 Dedo (Indicador)
  | 'two_fingers'    // ✌️ 2 Dedos (Indicador + Médio)
  | 'three_fingers'  // 🤟 3 Dedos (Indicador + Médio + Anelar)
  | 'four_fingers'   // 🖖 4 Dedos (Indicador + Médio + Anelar + Mínimo)
  | 'five_fingers'   // 🖐️ 5 Dedos (Mão Aberta)
  | 'hang_loose'     // 🤙 Hang Loose (Polegar + Mínimo)
  | 'horns'          // 🤘 Chifrinho (Indicador + Mínimo)
  | 'pinch'          // 👌 Pinch (Polegar + Indicador em pinça)
  | 'thumb_up';      // 👍 Polegar para Cima

export interface GestureInfo {
  id: GestureId;
  name: string;
  emoji: string;
  description: string;
}

export const AVAILABLE_GESTURES: Record<GestureId, GestureInfo> = {
  fist: {
    id: 'fist',
    name: 'Punho Fechado',
    emoji: '✊',
    description: 'Mão totalmente fechada',
  },
  one_finger: {
    id: 'one_finger',
    name: '1 Dedo',
    emoji: '☝️',
    description: 'Apenas dedo indicador levantado',
  },
  two_fingers: {
    id: 'two_fingers',
    name: '2 Dedos (V)',
    emoji: '✌️',
    description: 'Indicador e médio levantados',
  },
  three_fingers: {
    id: 'three_fingers',
    name: '3 Dedos',
    emoji: '🤟',
    description: 'Indicador, médio e anelar levantados',
  },
  four_fingers: {
    id: 'four_fingers',
    name: '4 Dedos',
    emoji: '🖖',
    description: 'Indicador, médio, anelar e mínimo levantados',
  },
  five_fingers: {
    id: 'five_fingers',
    name: 'Mão Aberta (5 Dedos)',
    emoji: '🖐️',
    description: 'Todos os dedos estendidos e abertos',
  },
  hang_loose: {
    id: 'hang_loose',
    name: 'Hang Loose (Shaka)',
    emoji: '🤙',
    description: 'Polegar e mínimo estendidos, dedos do meio fechados',
  },
  horns: {
    id: 'horns',
    name: 'Chifrinho (Rock)',
    emoji: '🤘',
    description: 'Indicador e mínimo estendidos, dedos do meio fechados',
  },
  pinch: {
    id: 'pinch',
    name: 'Pinch (Pinça)',
    emoji: '👌',
    description: 'Pontas do polegar e indicador se tocando',
  },
  thumb_up: {
    id: 'thumb_up',
    name: 'Polegar para Cima',
    emoji: '👍',
    description: 'Polegar estendido para cima, outros dedos recolhidos',
  },
};

export const GESTURE_IDS: GestureId[] = Object.keys(AVAILABLE_GESTURES) as GestureId[];

export interface GestureMappingConfig {
  leftHandNotes: Record<NaturalNote, GestureId>;
  rightHandQualities: Record<ChordQuality, GestureId>;
}

export const DEFAULT_GESTURE_CONFIG: GestureMappingConfig = {
  leftHandNotes: {
    C: 'one_finger',
    D: 'two_fingers',
    E: 'three_fingers',
    F: 'four_fingers',
    G: 'five_fingers',
    A: 'hang_loose',
    B: 'fist',
  },
  rightHandQualities: {
    major: 'five_fingers',
    minor: 'two_fingers',
    dominant7: 'one_finger',
    major7: 'four_fingers',
    minor7: 'three_fingers',
    sus4: 'horns',
    halfDiminished: 'pinch',
    diminished: 'fist',
  },
};

const STORAGE_KEY = 'visuchord_gesture_mapping_v1';

export function loadGestureConfig(): GestureMappingConfig {
  if (typeof window === 'undefined') return DEFAULT_GESTURE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GESTURE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<GestureMappingConfig>;
    return {
      leftHandNotes: {
        ...DEFAULT_GESTURE_CONFIG.leftHandNotes,
        ...(parsed.leftHandNotes || {}),
      },
      rightHandQualities: {
        ...DEFAULT_GESTURE_CONFIG.rightHandQualities,
        ...(parsed.rightHandQualities || {}),
      },
    };
  } catch (err) {
    console.warn('Erro ao carregar configurações de gestos do localStorage:', err);
    return DEFAULT_GESTURE_CONFIG;
  }
}

export function saveGestureConfig(config: GestureMappingConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Erro ao salvar configurações de gestos no localStorage:', err);
  }
}

export function resetGestureConfig(): GestureMappingConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  }
  return { ...DEFAULT_GESTURE_CONFIG };
}
