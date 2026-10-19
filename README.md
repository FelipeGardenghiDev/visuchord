# 🎵 VisuChord — Instrumento Musical por Visão Computacional & Gestos

[![CI Pipeline](https://github.com/felipegardenghidev/visuchord/actions/workflows/ci.yml/badge.svg)](https://github.com/felipegardenghidev/visuchord/actions)
![Tests](https://img.shields.io/badge/Tests-46%20Passing%20(Vitest)-brightgreen?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?style=flat-square&logo=vite)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript)
![MediaPipe](https://img.shields.io/badge/AI-Google_MediaPipe_Hands-0097A7?style=flat-square&logo=google)
![Tone.js](https://img.shields.io/badge/Audio-Tone.js_PolySynth-f59e0b?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwind-css)
![PWA Ready](https://img.shields.io/badge/PWA-Offline_Cache_Ready-emerald?style=flat-square)

**VisuChord** é uma aplicação web interativa em nível de engenharia sênior que transforma a webcam do computador em um instrumento musical polifônico e gestual, utilizando **Visão Computacional em tempo real (Google MediaPipe Hands)** acelerada por WebGL/Wasm na GPU do navegador e síntese sonora rica com **Tone.js**.

---

## 🏛️ Arquitetura & Decisões Formais (ADRs)

A engenharia do VisuChord é formalmente documentada em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) através de 5 Architecture Decision Records:

1. **ADR-001:** Adoção de Google MediaPipe Hands Tasks-Vision (Wasm/GPU) em detrimento de TensorFlow.js/COCO-SSD.
2. **ADR-002:** Arquitetura de Coordenação Bimanual Harmônica desacoplada (Mão Esquerda = Tônica Cromática; Mão Direita = Qualidade/Modo Harmônico).
3. **ADR-003:** Estabilização Temporal e Anti-Jitter via Janela Deslizante de Votação Majoritária (Temporal Majority Voting).
4. **ADR-004:** Grafo de Áudio com Brickwall Limiter (-1 dBFS) e Gravação Estéreo via `Tone.Recorder`.
5. **ADR-005:** Estratégia de Testes Unitários Cinemáticos Isolados de Hardware e Aceleração de CI.

---

## 🎹 Como Funciona a Mecânica Musical

O sistema opera com um modelo de **Coordenação Bimanual Harmônica**:

```mermaid
graph LR
    LeftHand["🖐️ Mão Esquerda<br/><b>Tônica & Acidentes</b><br/><i>(Dó, Ré, Mi... # / ♭)</i>"] --> Core["🧠 VisuChord Engine<br/><i>Teoria Musical & Detecção</i>"]
    RightHand["🖐️ Mão Direita<br/><b>Qualidade Harmônica & Strum</b><br/><i>(Maior, Menor, 7, m7b5...)</i>"] --> Core
    Core --> Tone["🔊 Tone.js PolySynth<br/><i>(Limiter + Reverb + Chorus + Som)</i>"]
    Core --> Recorder["🔴 Tone.Recorder<br/><i>(Gravação e Download WebM/WAV)</i>"]
    Core --> Canvas["🎨 HUD Holográfico Neon<br/><i>(Feedback Visual 60 FPS)</i>"]
    Core --> Telemetry["📊 Telemetria em Tempo Real<br/><i>(FPS, Latência Neural e Áudio)</i>"]
```

### 1. Mão Esquerda: Tônica & Modulação Cromática
Permite selecionar **qualquer uma das 12 notas cromáticas ocidentais**:
* **Contagem de Dedos (Notas Naturais):**
  * ☝️ **1 dedo:** Dó (C)
  * ✌️ **2 dedos:** Ré (D)
  * 🤟 **3 dedos:** Mi (E)
  * 🖖 **4 dedos:** Fá (F)
  * 🖐️ **5 dedos:** Sol (G)
  * 🤙 **Hang Loose (Polegar + Mínimo):** Lá (A)
  * ✊ **Punho Fechado:** Si (B)
* **Modulador de Altura Espacial (Acidentes # / ♭):**
  * ▲ **Zona Superior da Tela:** Sustenido (`#`) — ex: *Fá#*, *Dó#*, *Sol#*
  * ◼ **Zona Central da Tela:** Nota Natural — ex: *Dó*, *Sol*, *Lá*
  * ▼ **Zona Inferior da Tela:** Bemol (`♭`) — ex: *Si♭*, *Mi♭*, *Lá♭*

---

### 2. Mão Direita: Qualidade do Acorde ("O Jeito") & Palhetada
Modula o tipo de tétrade ou tríade executada:
* 🖐️ **Mão Totalmente Aberta (5 dedos):** Acorde Maior (*ex: C, G, D*)
* ✌️ **2 Dedos (Paz & Amor):** Acorde Menor (*ex: Cm, Am, Em*)
* ☝️ **1 Dedo (Indicador):** Acorde Dominante com 7ª (*ex: G7, C7, E7*)
* 🤟 **4 Dedos:** Acorde Maior com Sétima Maior (*ex: C7M, F7M*)
* 👌 **Pinch (Polegar + Indicador se tocando):** Acorde Meio-Diminuto (*ex: Bm7b5, F#m7b5*)
* ✊ **Punho Fechado:** Acorde Diminuto Completo (*ex: C°*)

> 💡 **Customização Total de Gestos:** Todas as posições de mão para as notas e qualidades harmônicas podem ser livremente remapeadas no botão **Mapear** da barra de controles e são salvas automaticamente no navegador.

#### ⚡ O Gatilho (Palhetada no Ar / Strumming):
Ao fazer um movimento rápido de **descida no ar com a mão direita**, o motor de áudio calcula as notas exatas e as toca em cascata (*strumming* de 35ms), simulando o dedilhado de um violão ou harpa com efeito visual de onda de choque no canvas.

---

## ⚡ Recursos de Nível Sênior Implementados

1. **🔴 Gravador de Áudio & Exportador Integrado (`Tone.Recorder`):**
   - Captura direta do fluxo estéreo na saída do limitador.
   - Timer visual ao vivo no HUD (`REC 00:00`) com pulso luminoso.
   - Download instantâneo de arquivo de áudio com timestamp único ao encerrar a gravação.

2. **📊 Telemetria em Tempo Real & Performance Monitor:**
   - Taxa de quadros gráfica em janela deslizante (alvo: **60 FPS** com semáforo visual).
   - Latência de Inferência da Rede Neural em milissegundos calculada a cada quadro via `performance.now()`.
   - Latência de saída de buffer do contexto Web Audio API (`baseLatency` + `outputLatency`).
   - Ciclo de renderização otimizado e desacoplado via amostragem suave a cada 400ms para evitar qualquer *re-render thrashing*.

3. **🛡️ Resiliência de Hardware & Fallback com Playground Virtual:**
   - Captura e tratamento granular de exceções WebRTC (`NotAllowedError`, `NotFoundError`, `NotReadableError`).
   - **Playground Virtual Interativo:** Permite usar e usufruir de todas as capacidades sonoras do VisuChord mesmo sem câmera física ou em caso de permissão bloqueada.
   - Mãos virtuais sintéticas animadas via cinemática vetorial geradas em tempo real na tela, ensinando visualmente a anatomia dos gestos musicais.
   - Controle total via atalhos do teclado numérico (`1-7`), acidentes (`Z, X, C`), qualidades (`Q-U`) e barra de espaço.

4. **🚀 PWA Offline Ready & Configuração de Deploy Vercel:**
   - `vercel.json` com roteamento SPA limpo, políticas de segurança `Permissions-Policy: camera=*, microphone=*` e cache imutável de 1 ano para arquivos WebAssembly e modelos binários.
   - `manifest.json` com tema Dark Cyberpunk e Service Worker com Cache-First para recursos estáticos e Network-First para assets de IA.

---

## 🛠️ Tecnologias & Engenharia

* **React 19 + Vite 8:** Arquitetura Single Page Application (SPA) para máxima performance gráfica com taxa de atualização de 60 frames por segundo.
* **Google MediaPipe Tasks Vision:** Detecção tridimensional de 21 marcos anatômicos (landmarks) das articulações da mão via WebAssembly e aceleração de GPU.
* **Tone.js:** Síntese sonora polifônica baseada na Web Audio API com envelope ADSR modelado, Reverb espacial, Chorus analógico e gravação direta.
* **Vitest 5.0.5:** Suíte de 46 testes unitários ultrarrápidos cobrindo teoria musical, lógica cinemática, gerador sintético de mãos e persistência de mapeamentos.
* **Tailwind CSS v4:** Interface no estilo Sci-Fi / Cyberpunk com suporte a múltiplos timbres sonoros (*Warm Pad*, *Piano Elétrico*, *Violão*, *Synth Lead*).

---

## 🚀 Como Executar Localmente

```bash
# 1. Clonar o repositório
git clone https://github.com/FelipeGardenghiDev/visuchord.git
cd visuchord

# 2. Instalar dependências
pnpm install

# 3. Rodar a suíte de testes automatizados (Vitest)
pnpm test

# 4. Rodar o servidor de desenvolvimento
pnpm dev
# Acesse http://localhost:5173
```

---

## 👨‍💻 Autor

Desenvolvido por **Felipe Gardenghi Gonçalves**  
Sertãozinho, SP — Brasil

* **GitHub:** [github.com/FelipeGardenghiDev](https://github.com/FelipeGardenghiDev)
* **LinkedIn:** [linkedin.com/in/felipegardenghi](https://www.linkedin.com/in/felipegardenghi/)
* **Portfólio:** [felipegardenghi.dev](https://felipegardenghi.dev)
