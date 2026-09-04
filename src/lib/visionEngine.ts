import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { 
  type NaturalNote, 
  type Accidental, 
  type ChordQuality, 
  type ChromaticNote, 
  getChromaticNote 
} from './musicTheory';
import {
  type GestureId,
  type GestureMappingConfig,
  loadGestureConfig,
} from './gestureConfig';

export interface HandGestureState {
  isDetected: boolean;
  handType: 'Left' | 'Right';
  landmarks: NormalizedLandmark[];
  extendedFingersCount: number;
  isPinching: boolean;
  handCenter: { x: number; y: number };
  detectedGesture: GestureId;
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
  private gestureConfig: GestureMappingConfig = loadGestureConfig();

  /**
   * Atualiza a configuração de mapeamento de gestos em tempo real
   */
  public setGestureConfig(config: GestureMappingConfig): void {
    this.gestureConfig = config;
  }

  public getGestureConfig(): GestureMappingConfig {
    return this.gestureConfig;
  }

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
      const detectedGesture = this.identifyGesture(screenLandmarks);

      const handState: HandGestureState = {
        isDetected: true,
        handType: (detectedCategory as 'Left' | 'Right') || (screenAvgX > 0.5 ? 'Right' : 'Left'),
        landmarks: screenLandmarks,
        extendedFingersCount: extendedFingers,
        isPinching,
        handCenter: { x: screenAvgX, y: avgY },
        detectedGesture,
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
   * Distância euclidiana 2D entre dois marcos anatômicos
   */
  private landmarkDist(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  /**
   * Avalia individualmente se um dedo longo (indicador, médio, anelar ou mínimo) está estendido.
   * Utiliza tanto a distância euclidiana relativa ao punho (lm[0]) quanto projeções verticais,
   * garantindo robustez a inclinações leves da mão.
   */
  private isLongFingerExtended(lm: NormalizedLandmark[], tipIdx: number, pipIdx: number, mcpIdx: number): boolean {
    const dWristTip = this.landmarkDist(lm[tipIdx], lm[0]);
    const dWristPip = this.landmarkDist(lm[pipIdx], lm[0]);
    const dWristMcp = this.landmarkDist(lm[mcpIdx], lm[0]);

    // O dedo está estendido se a ponta estiver consideravelmente mais longe do punho que a articulação base/média
    const isFartherThanPip = dWristTip > dWristPip * 1.10;
    const isFartherThanMcp = dWristTip > dWristMcp * 1.22;
    const isAbovePip = lm[tipIdx].y < lm[pipIdx].y + 0.04;

    return (isFartherThanPip && isFartherThanMcp) || (isAbovePip && dWristTip > dWristMcp * 1.15);
  }

  /**
   * Avalia se um dedo longo está dobrado/recolhido em direção à palma (curled)
   */
  private isLongFingerCurled(lm: NormalizedLandmark[], tipIdx: number, pipIdx: number, mcpIdx: number): boolean {
    const dWristTip = this.landmarkDist(lm[tipIdx], lm[0]);
    const dWristPip = this.landmarkDist(lm[pipIdx], lm[0]);
    const dWristMcp = this.landmarkDist(lm[mcpIdx], lm[0]);

    // Ponta está recolhida próxima à palma/punho
    return dWristTip <= dWristPip * 1.08 || dWristTip <= dWristMcp * 1.25 || lm[tipIdx].y > lm[pipIdx].y - 0.01;
  }

  /**
   * Avalia se o polegar está estendido/aberto lateralmente ou para cima
   */
  private isThumbExtended(lm: NormalizedLandmark[]): boolean {
    const thumbDistToIndexMcp = this.landmarkDist(lm[4], lm[5]);
    const dWristThumbTip = this.landmarkDist(lm[4], lm[0]);
    const dWristThumbMcp = this.landmarkDist(lm[2], lm[0]);

    return thumbDistToIndexMcp > 0.09 && dWristThumbTip > dWristThumbMcp * 1.15;
  }

  /**
   * Conta quantos dedos estão estendidos
   */
  private countExtendedFingers(lm: NormalizedLandmark[]): number {
    let count = 0;
    if (this.isLongFingerExtended(lm, 8, 6, 5)) count++;
    if (this.isLongFingerExtended(lm, 12, 10, 9)) count++;
    if (this.isLongFingerExtended(lm, 16, 14, 13)) count++;
    if (this.isLongFingerExtended(lm, 20, 18, 17)) count++;
    if (this.isThumbExtended(lm)) count++;
    return count;
  }

  /**
   * Detecta se o polegar e o indicador estão em pinça (Pinch)
   */
  private checkPinch(lm: NormalizedLandmark[]): boolean {
    const distance = this.landmarkDist(lm[4], lm[8]);
    return distance < 0.065;
  }

  /**
   * Identifica de forma robusta e precisa o gesto da mão entre o catálogo disponível
   */
  public identifyGesture(lm: NormalizedLandmark[]): GestureId {
    const isIndexExt = this.isLongFingerExtended(lm, 8, 6, 5);
    const isMiddleExt = this.isLongFingerExtended(lm, 12, 10, 9);
    const isRingExt = this.isLongFingerExtended(lm, 16, 14, 13);
    const isPinkyExt = this.isLongFingerExtended(lm, 20, 18, 17);
    const isThumbExt = this.isThumbExtended(lm);

    const isIndexCurled = this.isLongFingerCurled(lm, 8, 6, 5);
    const isMiddleCurled = this.isLongFingerCurled(lm, 12, 10, 9);
    const isRingCurled = this.isLongFingerCurled(lm, 16, 14, 13);
    const isPinkyCurled = this.isLongFingerCurled(lm, 20, 18, 17);

    // 1. PINCH (Polegar + Indicador juntos)
    if (this.checkPinch(lm)) {
      return 'pinch';
    }

    // 2. PUNHO FECHADO (FIST) / THUMB UP
    // Se os 4 dedos principais (indicador, médio, anelar e mínimo) estão dobrados para dentro da palma:
    const allFourFingersCurled = isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && !isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt;

    if (allFourFingersCurled) {
      // Se o polegar estiver explicitamente apontado para cima acima das articulações:
      const isThumbPointingUp = lm[4].y < lm[3].y && lm[4].y < lm[2].y && lm[4].y < lm[5].y && isThumbExt;
      if (isThumbPointingUp) {
        return 'thumb_up';
      }
      // Caso contrário, é garantidamente PUNHO FECHADO (Si / Diminuto)
      // Não importa onde o polegar esteja repousando sobre os dedos!
      return 'fist';
    }

    // 3. HANG LOOSE (Shaka: Polegar + Mínimo estendidos, dedos centrais recolhidos)
    if (isThumbExt && isPinkyExt && isIndexCurled && isMiddleCurled && isRingCurled) {
      return 'hang_loose';
    }

    // 4. CHIFRINHO / HORNS (Indicador + Mínimo estendidos, médio e anelar recolhidos)
    if (isIndexExt && isPinkyExt && isMiddleCurled && isRingCurled) {
      return 'horns';
    }

    // 5. CONTAGEM DE DEDOS PADRÃO
    const extendedFourCount = (isIndexExt ? 1 : 0) + (isMiddleExt ? 1 : 0) + (isRingExt ? 1 : 0) + (isPinkyExt ? 1 : 0);

    // Se todos os 5 dedos estão abertos
    if (extendedFourCount === 4 && isThumbExt) {
      return 'five_fingers';
    }

    if (extendedFourCount === 4) {
      return 'four_fingers';
    }

    if (extendedFourCount === 3 && isIndexExt && isMiddleExt && isRingExt) {
      return 'three_fingers';
    }

    if (extendedFourCount === 2 && isIndexExt && isMiddleExt) {
      return 'two_fingers';
    }

    if (extendedFourCount === 1 && isIndexExt) {
      return 'one_finger';
    }

    // Fallbacks para contagem geral de dedos estendidos
    const totalCount = extendedFourCount + (isThumbExt ? 1 : 0);
    if (totalCount >= 5) return 'five_fingers';
    if (totalCount === 4) return 'four_fingers';
    if (totalCount === 3) return 'three_fingers';
    if (totalCount === 2) return 'two_fingers';
    if (totalCount === 1) return 'one_finger';

    return 'fist';
  }

  /**
   * Mapeia os gestos da mão esquerda para as 7 notas naturais usando a configuração dinâmica
   */
  private detectBaseNote(hand: HandGestureState): NaturalNote {
    const gesture = hand.detectedGesture;

    // Busca nas configurações do usuário qual nota está mapeada para o gesto detectado
    const mapping = this.gestureConfig.leftHandNotes;
    for (const [noteKey, mappedGesture] of Object.entries(mapping)) {
      if (mappedGesture === gesture) {
        return noteKey as NaturalNote;
      }
    }

    // Caso o gesto não esteja explicitamente mapeado, mantém o valor anterior estável ou fallback inteligente
    const lastNote = this.leftNoteHistory[this.leftNoteHistory.length - 1];
    return lastNote || 'C';
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
   * Mapeia os gestos da mão direita para a qualidade do acorde usando a configuração dinâmica
   */
  private detectQuality(hand: HandGestureState): ChordQuality {
    const gesture = hand.detectedGesture;

    // Busca nas configurações do usuário qual qualidade está mapeada para o gesto detectado
    const mapping = this.gestureConfig.rightHandQualities;
    for (const [qualityKey, mappedGesture] of Object.entries(mapping)) {
      if (mappedGesture === gesture) {
        return qualityKey as ChordQuality;
      }
    }

    // Caso o gesto não esteja explicitamente mapeado, mantém o valor anterior estável ou fallback inteligente
    const lastQuality = this.rightQualityHistory[this.rightQualityHistory.length - 1];
    return lastQuality || 'major';
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
