import React from 'react';
import { X, Hand, Sparkles, Music2 } from 'lucide-react';

interface GestureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GestureGuideModal: React.FC<GestureGuideModalProps> = ({ isOpen, onClose }) => {
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
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Mão Esquerda */}
          <div className="bg-slate-950/60 border border-cyan-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm uppercase tracking-wider">
              <Hand className="w-4 h-4" />
              Mão Esquerda: Tônica (Nota Base)
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">☝️ 1 Dedo levantado</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">Dó (C)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">✌️ 2 Dedos levantados</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">Ré (D)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🤟 3 Dedos levantados</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">Mi (E)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🖖 4 Dedos levantados</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">Fá (F)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🖐️ 5 Dedos (Mão Aberta)</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">Sol (G)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🤙 Hang Loose (Polegar + Mínimo)</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">Lá (A)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">✊ Mão Fechada (Punho)</span>
                <span className="font-bold text-cyan-400 font-mono text-sm">Si (B)</span>
              </div>
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
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm uppercase tracking-wider">
              <Music2 className="w-4 h-4" />
              Mão Direita: Qualidade & Palhetada
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🖐️ Mão Aberta (5 Dedos)</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Maior (Maj)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">✌️ 2 Dedos (Paz &amp; Amor)</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Menor (m)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">☝️ 1 Dedo (Indicador)</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Dominante (7)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🖖 4 Dedos levantados</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Sétima Maior (7M)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🤟 3 Dedos levantados</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Menor com 7ª (m7)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">🤘 Horns (Indicador + Mínimo)</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Suspenso 4 (sus4)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">👌 Pinch (Polegar + Indicador)</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Meio-Diminuto (m7b5)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/60">
                <span className="font-semibold text-slate-300">✊ Mão Fechada (Punho)</span>
                <span className="font-bold text-purple-400 font-mono text-sm">Diminuto (°)</span>
              </div>
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

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all"
          >
            Entendido, vamos tocar!
          </button>
        </div>
      </div>
    </div>
  );
};
