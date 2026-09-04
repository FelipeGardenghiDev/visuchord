import React from 'react';
import { X, Hand, Sparkles, Music2, Settings2 } from 'lucide-react';
import { 
  AVAILABLE_GESTURES, 
  DEFAULT_GESTURE_CONFIG, 
  type GestureMappingConfig 
} from '../lib/gestureConfig';
import { NATURAL_NOTES, CHORD_QUALITIES, type NaturalNote } from '../lib/musicTheory';

interface GestureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: GestureMappingConfig;
  onOpenSettings?: () => void;
}

const NOTE_NAMES_PT: Record<NaturalNote, string> = {
  C: 'Dó (C)',
  D: 'Ré (D)',
  E: 'Mi (E)',
  F: 'Fá (F)',
  G: 'Sol (G)',
  A: 'Lá (A)',
  B: 'Si (B)',
};

export const GestureGuideModal: React.FC<GestureGuideModalProps> = ({ 
  isOpen, 
  onClose,
  config = DEFAULT_GESTURE_CONFIG,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Guia de Gestos do VisuChord</h2>
              <p className="text-xs text-slate-400">Controle musical completo pelas suas mãos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all"
                title="Personalizar os gestos de cada nota e acorde"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Personalizar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Mão Esquerda */}
          <div className="bg-slate-950/60 border border-cyan-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm uppercase tracking-wider">
                <Hand className="w-4 h-4" />
                Mão Esquerda: Tônica (Nota Base)
              </div>
              <span className="text-[10px] text-cyan-400/80 font-mono">Posições Ativas</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {NATURAL_NOTES.map((note) => {
                const gestureId = config.leftHandNotes[note];
                const gesture = AVAILABLE_GESTURES[gestureId];
                return (
                  <div key={note} className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                    <span className="font-semibold text-slate-300">
                      {gesture ? `${gesture.emoji} ${gesture.name}` : gestureId}
                    </span>
                    <span className="font-bold text-cyan-400 font-mono text-sm">
                      {NOTE_NAMES_PT[note]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Modificador de Acidente (# / b) */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <p className="text-xs font-bold text-cyan-300 mb-2">🎯 Altura da Mão = Acidentes (# / ♭):</p>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <p className="font-bold">Parte Alta</p>
                  <p className="text-[10px] text-amber-200/80">Sustenido (#)</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <p className="font-bold">Centro</p>
                  <p className="text-[10px] text-emerald-200/80">Natural</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300">
                  <p className="font-bold">Parte Baixa</p>
                  <p className="text-[10px] text-purple-200/80">Bemol (♭)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mão Direita */}
          <div className="bg-slate-950/60 border border-purple-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm uppercase tracking-wider">
                <Music2 className="w-4 h-4" />
                Mão Direita: Qualidade & Palhetada
              </div>
              <span className="text-[10px] text-purple-400/80 font-mono">Harmonia</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {Object.entries(CHORD_QUALITIES).map(([qualKey, def]) => {
                const gestureId = config.rightHandQualities[qualKey as keyof typeof CHORD_QUALITIES];
                const gesture = AVAILABLE_GESTURES[gestureId];
                return (
                  <div key={qualKey} className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                    <span className="font-semibold text-slate-300">
                      {gesture ? `${gesture.emoji} ${gesture.name}` : gestureId}
                    </span>
                    <span className="font-bold text-purple-400 font-mono text-sm">
                      {def.label} {def.symbol ? `(${def.symbol})` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Modos de Execução */}
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
              <p className="text-xs font-bold text-purple-300">⚡ Modos de Execução Sonora:</p>
              <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs">
                <strong>Modo Palhetada:</strong> Faça um movimento rápido de <strong>descida com a mão direita no ar</strong> para dedilhar o acorde como um violão.
              </div>
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs">
                <strong>Modo Sustentação:</strong> O acorde soa continuamente como um <strong>teclado/pad espacial</strong> enquanto ambas as mãos estiverem erguidas.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {onOpenSettings && (
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
            >
              <Settings2 className="w-4 h-4 text-cyan-400" />
              <span>Personalizar Mapeamento de Posições</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all ml-auto"
          >
            Entendido, vamos tocar!
          </button>
        </div>
      </div>
    </div>
  );
};
