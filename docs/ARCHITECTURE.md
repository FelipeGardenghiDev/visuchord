# 🏛️ Architecture Decision Records (ADRs) — VisuChord

Este documento consolida as decisões arquiteturais, motivações e trade-offs técnicos adotados no **VisuChord**, garantindo rigor de engenharia de software multimídia, computação gráfica em tempo real e processamento de áudio determinístico no navegador.

---

## 📌 Índice de Decisões Arquiteturais

* [ADR-001: Seleção do Google MediaPipe Tasks Vision (GPU WebGL / Wasm) vs. TensorFlow.js](#adr-001-seleção-do-google-mediapipe-tasks-vision-gpu-webgl--wasm-vs-tensorflowjs)
* [ADR-002: Arquitetura de Coordenação Bimanual Harmônica & Modulação Espacial](#adr-002-arquitetura-de-coordenação-bimanual-harmônica--modulação-espacial)
* [ADR-003: Filtro Temporal de Votação Majoritária (Anti-Jitter Buffer)](#adr-003-filtro-temporal-de-votação-majoritária-anti-jitter-buffer)
* [ADR-004: Audio Graph Polifônico com Tone.js e Proteção de Transientes via Limiter (-1 dB)](#adr-004-audio-graph-polifônico-com-tonejs-e-proteção-de-transientes-via-limiter--1-db)
* [ADR-005: Suíte de Testes Unitários Cinemáticos Isolados de Dispositivos de Captura (Vitest)](#adr-005-suíte-de-testes-unitários-cinemáticos-isolados-de-dispositivos-de-captura-vitest)
* [ADR-006: Integração com Web MIDI API para Interoperabilidade com DAWs Profissionais](#adr-006-integração-com-web-midi-api-para-interoperabilidade-com-daws-profissionais)
* [ADR-007: Modulação Expressiva Contínua com Filtro Moog e Osciloscópio FFT](#adr-007-modulação-expressiva-contínua-com-filtro-moog-e-osciloscópio-fft)
* [ADR-008: Motor Rítmico com Metrônomo, Bateria Eletrônica e Looper de Compassos](#adr-008-motor-rítmico-com-metrônomo-bateria-eletrônica-e-looper-de-compassos)
* [ADR-009: Estratégia de Chunk Splitting no Vite para Bundle Principal Sub-70 kB](#adr-009-estratégia-de-chunk-splitting-no-vite-para-bundle-principal-sub-70-kb)

---

### ADR-001: Seleção do Google MediaPipe Tasks Vision (GPU WebGL / Wasm) vs. TensorFlow.js

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Aplicações de interação gestual em tempo real requerem taxas de amostragem mínimas de 30 a 60 quadros por segundo (FPS) para que a resposta musical pareça orgânica e livre de latência perceptível (sub-25ms de round-trip delay). Modelos genéricos de visão computacional em TensorFlow.js com execução padrão na CPU ou backends WebGL não otimizados costumam consumir entre 35ms e 70ms por frame, causando perda de quadros e engasgos na thread de renderização da UI.
* **Decisão:**
  Adotar o **Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)** com modelo pré-compilado de detecção e rastreamento tridimensional de 21 marcos anatômicos da mão (`HandLandmarker`), configurado com pipeline em WebAssembly e aceleração de hardware via WebGL.
* **Trade-offs:**
  * *Vantagens:* Tempo de inferência reduzido para 8ms a 14ms em GPUs modernas, permitindo 60 FPS estáveis com overhead desprezível na thread principal do navegador; entrega de 21 coordenadas espaciais 3D normalizadas com alta precisão articular.
  * *Desvantagens:* Download inicial dos binários WebAssembly (~10 MB) que requer estratégia de pré-carregamento e tratamento resiliente de inicialização assíncrona.

---

### ADR-002: Arquitetura de Coordenação Bimanual Harmônica & Modulação Espacial

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Traduzir a complexidade da teoria musical ocidental (12 notas cromáticas multiplicadas por dezenas de formações de tétrades e tríades) em gestos de uma única mão geraria uma sobrecarga cognitiva inviável e risco constante de ambiguidade nos modelos de visão computacional.
* **Decisão:**
  Implementar o padrão de **Coordenação Bimanual Harmônica**:
  1. **Mão Esquerda (Tônica & Modulação de Acidentes):**
     * Contagem de dedos e gestos específicos definem as 7 notas naturais fundamentais (Dó, Ré, Mi, Fá, Sol, Lá, Si);
     * A coordenada $Y$ vertical do centro da mão atua como modulador contínuo de acidentes: terço superior da tela ($Y < 0.35$) adiciona Sustenido (`#`), terço central ($0.35 \le Y \le 0.65$) mantém nota Natural, e terço inferior ($Y > 0.65$) aplica Bemol (`♭`).
  2. **Mão Direita (Qualidade Harmônica & Palhetada):**
     * Posição estática dos dedos modula a qualidade do acorde (Maior, Menor, 7ª Dominante, 7M, Meio-Diminuto `m7b5`, Diminuto, Suspenso);
     * O vetor de velocidade vertical descendente ($\Delta Y > 0.04$ com janela de debounce de 280ms) aciona o gatilho de palhetada (*strumming*), disparando as notas em cascata com atraso acústico de 35ms.
* **Trade-offs:**
  * *Vantagens:* Cobre todas as notas cromáticas e qualidades harmônicas sem necessidade de tabelas complexas de 100 gestos; simula fielmente a mecânica natural de instrumentos de corda (mão esquerda no braço montando o acorde, mão direita palhetando).
  * *Desvantagens:* Exige que a câmera capture ambas as mãos no enquadramento para execução completa de tétrades.

---

### ADR-003: Filtro Temporal de Votação Majoritária (Anti-Jitter Buffer)

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Fluxos de vídeo de webcams sofrem com instabilidades ópticas como desfoque de movimento (*motion blur*), ruído de baixa luminosidade e micro-oclusões momentâneas de articulações dos dedos, o que pode gerar alternâncias espúrias de acordes entre frames consecutivos (musical jitter).
* **Decisão:**
  Implementar um **Filtro Temporal de Votação Majoritária** ([`visionEngine.ts`](../src/lib/visionEngine.ts)) com fila circular de amostragem com janela deslizante de 5 frames. O motor só efetiva a transição para um novo acorde ou acidente se a nova classificação for confirmada pela maioria estatística dos frames recentes.
* **Trade-offs:**
  * *Vantagens:* Estabilidade acústica completa; elimina disparos falsos causados por ruído óptico de iluminação ou frames corrompidos.
  * *Desvantagens:* Adiciona uma latência de transição imperceptível de aproximadamente 30ms a 50ms para confirmação de transições bruscas de notas.

---

### ADR-004: Audio Graph Polifônico com Tone.js e Proteção de Transientes via Limiter (-1 dB)

* **Status:** Aprovado / Em Produção
* **Contexto:**
  A reprodução polifônica de tétrades em cascata (*strumming*) com notas de sustentação prolongada e efeitos de Reverb espacial e Chorus pode causar sobreposição cumulativa de amplitudes, resultando em distorção harmônica e *clipping* digital severo na Web Audio API.
* **Decisão:**
  Projetar a cadeia de áudio do sistema com nós especializados em cascata:
  `Tone.PolySynth` ➔ `Tone.Filter(Moog 24dB)` ➔ `Tone.Chorus` ➔ `Tone.Reverb` ➔ `Tone.Limiter(-1 dB)` ➔ `Tone.Volume(-6 dB)` ➔ `Tone.Destination`.
  Conectar `Tone.Recorder` e `Tone.Analyser` em paralelo na saída do volume master.
* **Trade-offs:**
  * *Vantagens:* Proteção absoluta contra clipping e fadiga auditiva; transientes suaves e sonoridade polida estilo estúdio musical; suporte a múltiplos timbres dinâmicos via envelopes ADSR e captura estéreo direta.
  * *Desvantagens:* Ligeiro aumento no consumo de processamento de áudio do navegador em comparação com osciladores simples nativos da Web Audio API.

---

### ADR-005: Suíte de Testes Unitários Cinemáticos Isolados de Dispositivos de Captura (Vitest)

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Testes automatizados em aplicações de visão computacional tradicionalmente falham em pipelines de CI/CD (GitHub Actions) por exigirem dispositivos físicos de câmera ou contextos WebGL complexos de renderização headless.
* **Decisão:**
  Segregar estritamente as regras de negócio e a matemática cinemática dos drivers de hardware da webcam:
  1. A suíte de teoria musical ([`musicTheory.test.ts`](../src/__tests__/musicTheory.test.ts)) valida intervalos, oitavas e escalas como funções puras e determinísticas;
  2. A suíte cinemática ([`visionEngineKinematics.test.ts`](../src/__tests__/visionEngineKinematics.test.ts)) valida distâncias euclidianas, limiares de *pinch*, física de *strumming* e modulação de acidentes operando sobre estruturas de coordenadas sintetizadas;
  3. A suíte de simulação sintética ([`virtualHandSimulator.test.ts`](../src/__tests__/virtualHandSimulator.test.ts)) valida a geração de 21 marcos anatômicos com compatibilidade estrita aos tipos MediaPipe;
  4. A suíte de persistência ([`gestureConfig.test.ts`](../src/__tests__/gestureConfig.test.ts)) opera com isolamento de `localStorage`.
* **Trade-offs:**
  * *Vantagens:* Execução ultrarrápida da suíte completa no CI (55 testes em menos de 1 segundo) com 100% de determinismo e zero dependência de drivers de vídeo.
  * *Desvantagens:* Testes de integração de vídeo requerem validação manual periódica ou testes E2E com drivers virtuais no Playwright.

---

### ADR-006: Integração com Web MIDI API para Interoperabilidade com DAWs Profissionais

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Embora o sintetizador interno do VisuChord produza sonoridades analógicas de alta qualidade, músicos e produtores profissionais utilizam estações de trabalho de áudio digital (DAWs como Ableton Live, FL Studio, Logic Pro, Reaper) com bibliotecas de timbres VST especializadas (Kontakt, Serum, Omnisphere).
* **Decisão:**
  Implementar o subsistema [`midiEngine.ts`](../src/lib/midiEngine.ts) via **Web MIDI API** nativa (`navigator.requestMIDIAccess`). Cada acorde detectado na visão computacional despacha mensagens padrão `0x90 Note On` e `0x80 Note Off`, enquanto a movimentação contínua da mão transmite `0xB0 Control Change (CC 74 - Brightness/Cutoff)`.
* **Trade-offs:**
  * *Vantagens:* Transforma o VisuChord em um poderoso controlador MIDI sem fio no ar sem necessidade de drivers ou hardware intermediário; compatibilidade imediata com qualquer software de áudio profissional.
  * *Desvantagens:* Requer navegadores baseados em Chromium com suporte habilitado a Web MIDI (Google Chrome, Edge, Brave, Opera).

---

### ADR-007: Modulação Expressiva Contínua com Filtro Moog e Osciloscópio FFT

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Instrumentos eletrônicos baseados unicamente em disparos discretos de acordes tendem a soar estáticos e mecânicos em comparação com instrumentos acústicos com expressividade dinâmica contínua.
* **Decisão:**
  Incorporar um filtro passa-baixas modelado de 4 polos com inclinação de corte de 24 dB/oitava (`Tone.Filter` com $Q=2$) acoplado à coordenada vertical da mão direita, e um analisador de forma de onda (`Tone.Analyser`) desenhando um osciloscópio neon holográfico em tempo real na base do HUD.
* **Trade-offs:**
  * *Vantagens:* Permite efeitos expressivos dinâmicos similares ao Theremin clássico e *sweeps* de sintetizadores analógicos Moog; feedback visual de osciloscópio adiciona forte apelo sensorial e estético.
  * *Desvantagens:* Requer amostragem de dados de onda no loop gráfico de 60 FPS com guarda de amplitude mínima para evitar consumo desnecessário de GPU.

---

### ADR-008: Motor Rítmico com Metrônomo, Bateria Eletrônica e Looper de Compassos

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Praticar e improvisar sobre acordes no ar requer referência de tempo precisa e a capacidade de construir bases harmônicas contínuas sem interrupção de fluxo.
* **Decisão:**
  Criar o módulo [`rhythmEngine.ts`](../src/lib/rhythmEngine.ts) com síntese percussiva dedicada (`MembraneSynth` e `NoiseSynth`), controle de andamento (60 a 180 BPM), múltiplos padrões (Metrônomo, Lo-Fi Beat, Pulse) e um Looper de 4 compassos (16 tempos) com quantização temporal.
* **Trade-offs:**
  * *Vantagens:* Permite performances completas em camadas (gravar base de acordes, soltar o loop e solar por cima no ar); metronome auditivo auxilia na coordenação rítmica da palhetada.
  * *Desvantagens:* Requer sincronização rigorosa com o `Tone.Transport` da Web Audio API.

---

### ADR-009: Estratégia de Chunk Splitting no Vite para Bundle Principal Sub-70 kB

* **Status:** Aprovado / Em Produção
* **Contexto:**
  Bibliotecas pesadas de machine learning (`@mediapipe/tasks-vision`) e síntese sonora (`tone`) geravam um único arquivo compilado monolítico superior a 650 kB, disparando avisos de tamanho de chunk e prejudicando a pontuação de Largest Contentful Paint (LCP) em conexões móveis.
* **Decisão:**
  Configurar no [`vite.config.ts`](../vite.config.ts) o particionamento dinâmico de dependências através da função `manualChunks`:
  * `vendor-react`: Camada do React e React-DOM (~182 kB);
  * `vendor-tone`: Motor de áudio do Tone.js (~258 kB);
  * `vendor-mediapipe`: Binários do MediaPipe Tasks Vision (~154 kB);
  * `vendor-icons`: Ícones do Lucide (~14 kB);
  * `index.js`: Código da aplicação VisuChord (**69.2 kB**).
* **Trade-offs:**
  * *Vantagens:* Redução do bundle principal para menos de 70 kB; downloads paralelos e reutilização otimizada de cache HTTP imutável no navegador para dependências que mudam com menor frequência.
  * *Desvantagens:* Leve aumento no número total de requisições HTTP na primeira carga, neutralizado pelo suporte universal a HTTP/2 e HTTP/3 em CDNs modernas.
