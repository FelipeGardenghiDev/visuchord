import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { 
  type NaturalNote, 
  type Accidental, 
  type ChordQuality, 
  type ChromaticNote, 
  getChromaticNote 
} from './musicTheory';

export interface HandGestureState {
  isDetected: boolean;
  handType: 'Left' | 'Right';
  landmarks: NormalizedLandmark[];
  extendedFingersCount: number;
  isPinching: boolean;
  handCenter: { x: number; y: number };
}

export interface VisuChordDetectionResult {
  leftHand: HandGestureState | null;
  rightHand: HandGestureState | null;
  selectedRoot: ChromaticNote;
  selectedBaseNote: NaturalNote;
  selectedAccidental: Accidental;
  selectedQuality: ChordQuality;
  shouldTriggerStrum: boolean;
}

class VisionEngine {
  private handLandmarker: HandLandmarker | null = null;
  private isModelLoading = false;
  private lastStrumTime = 0;
  private previousRightHandY = 0;

  /**
   * Carrega o modelo do Google MediaPipe Hands via WebAssembly + GPU
   */
  public async loadModel(): Promise<void> {
    if (this.handLandmarker || this.isModelLoading) return;
    this.isModelLoading = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      });
      console.log('MediaPipe Hands carregado com sucesso!');
    } catch (error) {
      console.error('Erro ao inicializar MediaPipe HandLandmarker:', error);
      throw error;
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Processa um frame de vídeo da webcam
   */
  public processVideoFrame(video: HTMLVideoElement, timestamp: number): VisuChordDetectionResult | null {
    if (!this.handLandmarker) return null;

    const results = this.handLandmarker.detectForVideo(video, timestamp);
    if (!results.landmarks || results.landmarks.length === 0) {
      return null;
    }

    let leftHand: HandGestureState | null = null;
    let rightHand: HandGestureState | null = null;

    results.landmarks.forEach((landmarks, index) => {
      const handednessObj = results.handednesses?.[index]?.[0];
      const detectedCategory = handednessObj?.categoryName;
      
      const avgX = landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length;
      const avgY = landmarks.reduce((sum, p) => sum + p.y, 0) / landmarks.length;

      const extendedFingers = this.countExtendedFingers(landmarks);
      const isPinching = this.checkPinch(landmarks);

      const handState: HandGestureState = {
        isDetected: true,
        handType: (detectedCategory as 'Left' | 'Right') || (avgX > 0.5 ? 'Right' : 'Left'),
        landmarks,
        extendedFingersCount: extendedFingers,
        isPinching,
        handCenter: { x: avgX, y: avgY },
      };

      if (avgX < 0.5) {
        leftHand = handState;
      } else {
        rightHand = handState;
      }
    });

    // Mão Esquerda determina a Tônica (Nota Base + Acidente)
    let selectedBaseNote: NaturalNote = 'C';
    let selectedAccidental: Accidental = 'natural';

    if (leftHand) {
      selectedBaseNote = this.detectBaseNote(leftHand);
      selectedAccidental = this.detectAccidental(leftHand);
    }

    const selectedRoot = getChromaticNote(selectedBaseNote, selectedAccidental);

    // Mão Direita determina a Qualidade (O "Jeito" do Acorde) e o Gatilho
    let selectedQuality: ChordQuality = 'major';
    let shouldTriggerStrum = false;

    if (rightHand) {
      selectedQuality = this.detectQuality(rightHand);
      shouldTriggerStrum = this.detectStrumming(rightHand, timestamp);
    }

    return {
      leftHand,
      rightHand,
      selectedRoot,
      selectedBaseNote,
      selectedAccidental,
      selectedQuality,
      shouldTriggerStrum,
    };
  }

  /**
   * Conta quantos dedos estão estendidos (levantados)
   */
  private countExtendedFingers(lm: NormalizedLandmark[]): number {
    let count = 0;

    // Indicador (tip: 8, pip: 6)
    if (lm[8].y < lm[6].y) count++;
    // Médio (tip: 12, pip: 10)
    if (lm[12].y < lm[10].y) count++;
    // Anelar (tip: 16, pip: 14)
    if (lm[16].y < lm[14].y) count++;
    // Mínimo (tip: 20, pip: 18)
    if (lm[20].y < lm[18].y) count++;
    // Polegar (distância para a base do indicador)
    const thumbDistance = Math.hypot(lm[4].x - lm[2].x, lm[4].y - lm[2].y);
    if (thumbDistance > 0.08) count++;

    return count;
  }

  /**
   * Detecta se o polegar e o indicador estão se tocando (Pinch)
   */
  private checkPinch(lm: NormalizedLandmark[]): boolean {
    const thumbTip = lm[4];
    const indexTip = lm[8];
    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    return distance < 0.055;
  }

  /**
   * Mapeia os gestos da mão esquerda para as 7 notas naturais
   */
  private detectBaseNote(hand: HandGestureState): NaturalNote {
    const fingers = hand.extendedFingersCount;
    const lm = hand.landmarks;

    if (fingers === 1) return 'C';
    if (fingers === 2) return 'D';
    if (fingers === 3) return 'E';
    if (fingers === 4) return 'F';
    if (fingers >= 5) return 'G';

    const isPinkyUp = lm[20].y < lm[18].y;
    const isThumbOut = Math.hypot(lm[4].x - lm[2].x, lm[4].y - lm[2].y) > 0.08;
    const isMiddleDown = lm[12].y > lm[10].y;

    if (isPinkyUp && isThumbOut && isMiddleDown) {
      return 'A';
    }

    if (fingers === 0) {
      return 'B';
    }

    return 'C';
  }

  /**
   * Detecta acidente (# ou ♭) pela altura vertical da mão esquerda
   */
  private detectAccidental(hand: HandGestureState): Accidental {
    const y = hand.handCenter.y;

    if (y < 0.35) {
      return 'sharp';
    }
    if (y > 0.65) {
      return 'flat';
    }
    return 'natural';
  }

  /**
   * Mapeia os gestos da mão direita para o "jeito" do acorde (Qualidade Harmônica)
   */
  private detectQuality(hand: HandGestureState): ChordQuality {
    const fingers = hand.extendedFingersCount;
    const isPinch = hand.isPinching;

    if (isPinch) {
      return 'halfDiminished';
    }
    if (fingers === 0) {
      return 'diminished';
    }
    if (fingers === 1) {
      return 'dominant7';
    }
    if (fingers === 2) {
      return 'minor';
    }
    if (fingers === 3) {
      return 'minor7';
    }
    if (fingers === 4) {
      return 'major7';
    }
    return 'major';
  }

  /**
   * Detecta movimento de palhetada (descida rápida da mão direita)
   */
  private detectStrumming(hand: HandGestureState, timestamp: number): boolean {
    const currentY = hand.handCenter.y;
    const dy = currentY - this.previousRightHandY;
    this.previousRightHandY = currentY;

    const isDownwardStroke = dy > 0.04;
    const canTrigger = timestamp - this.lastStrumTime > 280;

    if (isDownwardStroke && canTrigger) {
      this.lastStrumTime = timestamp;
      return true;
    }

    return false;
  }
}

export const visionEngine = new VisionEngine();
