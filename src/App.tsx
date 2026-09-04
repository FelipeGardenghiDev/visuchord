import { useState } from 'react';
import { ControlsHeader, type PlayMode } from './components/ControlsHeader';
import { CameraHUD } from './components/CameraHUD';
import { GestureGuideModal } from './components/GestureGuideModal';
import { GestureSettingsModal } from './components/GestureSettingsModal';
import { 
  type GestureMappingConfig, 
  loadGestureConfig, 
  saveGestureConfig 
} from './lib/gestureConfig';
import { visionEngine } from './lib/visionEngine';
import { Globe, Code2 } from 'lucide-react';

export function App() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('strum');
  const [gestureConfig, setGestureConfig] = useState<GestureMappingConfig>(() => loadGestureConfig());

  const handleSaveGestureConfig = (newConfig: GestureMappingConfig) => {
    setGestureConfig(newConfig);
    saveGestureConfig(newConfig);
    visionEngine.setGestureConfig(newConfig);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950 pb-8">
      <div>
        <ControlsHeader 
          onOpenGuide={() => setGuideOpen(true)} 
          onOpenSettings={() => setSettingsOpen(true)}
          playMode={playMode}
          onPlayModeChange={setPlayMode}
        />

        <main className="px-4">
          <CameraHUD 
            onOpenGuide={() => setGuideOpen(true)} 
            onOpenSettings={() => setSettingsOpen(true)}
            playMode={playMode}
          />
        </main>
      </div>

      {/* Guia de Gestos */}
      <GestureGuideModal 
        isOpen={guideOpen} 
        onClose={() => setGuideOpen(false)} 
        config={gestureConfig}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Modal de Personalização / Mapeamento de Gestos */}
      {settingsOpen && (
        <GestureSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={gestureConfig}
          onSaveConfig={handleSaveGestureConfig}
        />
      )}

      {/* Rodapé Elegante */}
      <footer className="mt-12 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-slate-900 pt-6 px-4">
        <p className="m-0">
          VisuChord — Desenvolvido por <strong className="text-slate-300">Felipe Gardenghi Gonçalves</strong>
        </p>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/FelipeGardenghiDev"
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <Code2 className="w-3.5 h-3.5" />
            GitHub
          </a>
          <span>•</span>
          <a
            href="https://felipegardenghi.dev"
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <Globe className="w-3.5 h-3.5" />
            Portfólio
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
