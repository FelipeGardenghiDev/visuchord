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

  // Buffers para estabilização temporal de gestos (elimina flickering entre frames)
  private leftNoteHistory: NaturalNote[] = [];
  private leftAccidentalHistory: Accidental[] = [];
  private rightQualityHistory: ChordQuality[] = [];
  private readonly historyCapacity = 5;

  private getMajorityValue<T>(history: T[], fallback: T): T {
    if (history.length === 0) return fallback;
    const frequency = new Map<T, number>();
    for (const item of history) {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    }
    let bestItem = fallback;
    let maxCount = 0;
    for (const [item, count] of frequency.entries()) {
      if (count > maxCount) {
        maxCount = count;
        bestItem = item;
      }
    }
    return bestItem;
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
      
      // Espelha coordenadas X para corresponder à tela da webcam espelhada
      const screenLandmarks: NormalizedLandmark[] = landmarks.map((p) => ({
        ...p,
        x: 1 - p.x,
      }));

      const screenAvgX = screenLandmarks.reduce((sum, p) => sum + p.x, 0) / screenLandmarks.length;
      const avgY = screenLandmarks.reduce((sum, p) => sum + p.y, 0) / screenLandmarks.length;

      const extendedFingers = this.countExtendedFingers(screenLandmarks);
      const isPinching = this.checkPinch(screenLandmarks);

      const handState: HandGestureState = {
        isDetected: true,
        handType: (detectedCategory as 'Left' | 'Right') || (screenAvgX > 0.5 ? 'Right' : 'Left'),
        landmarks: screenLandmarks,
        extendedFingersCount: extendedFingers,
        isPinching,
        handCenter: { x: screenAvgX, y: avgY },
      };

      // Mão no lado esquerdo da tela (visão do usuário) = Tônica / Acidentes
      // Mão no lado direito da tela = Qualidade / Strumming
      if (screenAvgX < 0.5) {
        leftHand = handState;
      } else {
        rightHand = handState;
      }
    });

    // Mão Esquerda determina a Tônica (Nota Base + Acidente)
    let rawBaseNote: NaturalNote = 'C';
    let rawAccidental: Accidental = 'natural';

    if (leftHand) {
      rawBaseNote = this.detectBaseNote(leftHand);
      rawAccidental = this.detectAccidental(leftHand);

      this.leftNoteHistory.push(rawBaseNote);
      if (this.leftNoteHistory.length > this.historyCapacity) this.leftNoteHistory.shift();

      this.leftAccidentalHistory.push(rawAccidental);
      if (this.leftAccidentalHistory.length > this.historyCapacity) this.leftAccidentalHistory.shift();
    } else {
      this.leftNoteHistory = [];
      this.leftAccidentalHistory = [];
    }

    const selectedBaseNote = this.getMajorityValue(this.leftNoteHistory, rawBaseNote);
    const selectedAccidental = this.getMajorityValue(this.leftAccidentalHistory, rawAccidental);
    const selectedRoot = getChromaticNote(selectedBaseNote, selectedAccidental);

    // Mão Direita determina a Qualidade (O "Jeito" do Acorde) e o Gatilho
    let rawQuality: ChordQuality = 'major';
    let shouldTriggerStrum = false;

    if (rightHand) {
      rawQuality = this.detectQuality(rightHand);
      shouldTriggerStrum = this.detectStrumming(rightHand, timestamp);

      this.rightQualityHistory.push(rawQuality);
      if (this.rightQualityHistory.length > this.historyCapacity) this.rightQualityHistory.shift();
    } else {
      this.rightQualityHistory = [];
    }

    const selectedQuality = this.getMajorityValue(this.rightQualityHistory, rawQuality);

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
    const lm = hand.landmarks;

    if (isPinch) {
      return 'halfDiminished';
    }

    // Gesto Horns/Chifrinho (Indicador + Mínimo estendidos, Médio e Anelar abaixados)
    const isIndexUp = lm[8].y < lm[6].y;
    const isPinkyUp = lm[20].y < lm[18].y;
    const isMiddleDown = lm[12].y > lm[10].y;
    const isRingDown = lm[16].y > lm[14].y;
    if (isIndexUp && isPinkyUp && isMiddleDown && isRingDown) {
      return 'sus4';
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
