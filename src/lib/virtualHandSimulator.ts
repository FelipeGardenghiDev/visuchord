import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { GestureId } from './gestureConfig';

const lm = (x: number, y: number, z = 0): NormalizedLandmark => ({
  x,
  y,
  z,
  visibility: 1,
});

/**
 * Gera marcos anatômicos sintéticos (21 landmarks normalizados padrão MediaPipe)
 * para simulação visual e fallback sem câmera (Playground Virtual).
 */
export function generateSimulatedHandLandmarks(
  gesture: GestureId,
  handSide: 'Left' | 'Right',
  cx: number = handSide === 'Left' ? 0.28 : 0.72,
  cy: number = 0.52
): NormalizedLandmark[] {
  const isLeft = handSide === 'Left';
  const thumbDir = isLeft ? 1 : -1; // Direção lateral do polegar em relação à palma espelhada

  // Posições base das articulações
  const wrist = lm(cx, cy + 0.16, 0);

  // Base dos dedos (MCPs)
  const mcpIndex = lm(cx - thumbDir * 0.04, cy + 0.02, 0);
  const mcpMiddle = lm(cx - thumbDir * 0.015, cy, 0);
  const mcpRing = lm(cx + thumbDir * 0.015, cy + 0.01, 0);
  const mcpPinky = lm(cx + thumbDir * 0.04, cy + 0.03, 0);

  // Determina quais dedos devem estar estendidos conforme o gesto
  let extThumb = false;
  let extIndex = false;
  let extMiddle = false;
  let extRing = false;
  let extPinky = false;
  let isPinch = false;
  let isThumbUp = false;

  switch (gesture) {
    case 'one_finger':
      extIndex = true;
      break;
    case 'two_fingers':
      extIndex = true;
      extMiddle = true;
      break;
    case 'three_fingers':
      extIndex = true;
      extMiddle = true;
      extRing = true;
      break;
    case 'four_fingers':
      extIndex = true;
      extMiddle = true;
      extRing = true;
      extPinky = true;
      break;
    case 'five_fingers':
      extThumb = true;
      extIndex = true;
      extMiddle = true;
      extRing = true;
      extPinky = true;
      break;
    case 'pinch':
      isPinch = true;
      extMiddle = true;
      extRing = true;
      extPinky = true;
      break;
    case 'thumb_up':
      isThumbUp = true;
      extThumb = true;
      break;
    case 'hang_loose':
      extThumb = true;
      extPinky = true;
      break;
    case 'horns':
      extIndex = true;
      extPinky = true;
      break;
    case 'fist':
    default:
      // Todos os dedos recolhidos
      break;
  }

  // Gera articulações para um dedo longo (MCP, PIP, DIP, TIP)
  const createFinger = (
    mcp: NormalizedLandmark,
    isExtended: boolean,
    length: number
  ): [NormalizedLandmark, NormalizedLandmark, NormalizedLandmark] => {
    if (isExtended) {
      const pip = lm(mcp.x, mcp.y - length * 0.38, 0);
      const dip = lm(mcp.x, mcp.y - length * 0.72, 0);
      const tip = lm(mcp.x, mcp.y - length * 1.05, 0);
      return [pip, dip, tip];
    } else {
      // Recolhido em direção à palma
      const pip = lm(mcp.x, mcp.y - length * 0.25, 0.02);
      const dip = lm(mcp.x, mcp.y - 0.01, 0.04);
      const tip = lm(mcp.x, mcp.y + 0.03, 0.05);
      return [pip, dip, tip];
    }
  };

  const [pipIndex, dipIndex, tipIndex] = createFinger(mcpIndex, extIndex, 0.16);
  const [pipMiddle, dipMiddle, tipMiddle] = createFinger(mcpMiddle, extMiddle, 0.18);
  const [pipRing, dipRing, tipRing] = createFinger(mcpRing, extRing, 0.165);
  const [pipPinky, dipPinky, tipPinky] = createFinger(mcpPinky, extPinky, 0.135);

  // Polegar
  const cmcThumb = lm(cx + thumbDir * 0.05, cy + 0.11, 0);
  const mcpThumb = lm(cx + thumbDir * 0.07, cy + 0.07, 0);
  let ipThumb: NormalizedLandmark;
  let tipThumb: NormalizedLandmark;

  if (isPinch) {
    // Ponta do polegar encosta na ponta do indicador
    ipThumb = lm((mcpThumb.x + tipIndex.x) / 2, (mcpThumb.y + tipIndex.y) / 2, 0);
    tipThumb = lm(tipIndex.x + thumbDir * 0.01, tipIndex.y, 0);
  } else if (isThumbUp) {
    ipThumb = lm(cx + thumbDir * 0.07, cy - 0.02, 0);
    tipThumb = lm(cx + thumbDir * 0.07, cy - 0.09, 0);
  } else if (extThumb) {
    ipThumb = lm(cx + thumbDir * 0.11, cy + 0.04, 0);
    tipThumb = lm(cx + thumbDir * 0.15, cy + 0.02, 0);
  } else {
    // Polegar repousando sobre os dedos
    ipThumb = lm(cx + thumbDir * 0.04, cy + 0.04, 0.03);
    tipThumb = lm(cx, cy + 0.04, 0.04);
  }

  // Monta array no padrão de índices 0..20 do MediaPipe Hands
  return [
    wrist,      // 0
    cmcThumb,   // 1
    mcpThumb,   // 2
    ipThumb,    // 3
    tipThumb,   // 4
    mcpIndex,   // 5
    pipIndex,   // 6
    dipIndex,   // 7
    tipIndex,   // 8
    mcpMiddle,  // 9
    pipMiddle,  // 10
    dipMiddle,  // 11
    tipMiddle,  // 12
    mcpRing,    // 13
    pipRing,    // 14
    dipRing,    // 15
    tipRing,    // 16
    mcpPinky,   // 17
    pipPinky,   // 18
    dipPinky,   // 19
    tipPinky,   // 20
  ];
}
