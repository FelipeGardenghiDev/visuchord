# 🏛️ Architecture Decision Records (ADRs) — VisuChord

Este documento consolida as decisões arquiteturais, motivações e trade-offs técnicos adotados no **VisuChord**, garantindo rigor de engenharia de software multimídia, computação gráfica em tempo real e processamento de áudio determinístico no navegador.

---

## 📌 Índice de Decisões Arquiteturais

* [ADR-001: Seleção do Google MediaPipe Tasks Vision (GPU WebGL / Wasm) vs. TensorFlow.js](#adr-001-seleção-do-google-mediapipe-tasks-vision-gpu-webgl--wasm-vs-tensorflowjs)
* [ADR-002: Arquitetura de Coordenação Bimanual Harmônica & Modulação Espacial](#adr-002-arquitetura-de-coordenação-bimanual-harmônica--modulação-espacial)
* [ADR-003: Filtro Temporal de Votação Majoritária (Anti-Jitter Buffer)](#adr-003-filtro-temporal-de-votação-majoritária-anti-jitter-buffer)
* [ADR-004: Audio Graph Polifônico com Tone.js e Proteção de Transientes via Limiter (-1 dB)](#adr-004-audio-graph-polifônico-com-tonejs-e-proteção-de-transientes-via-limiter--1-db)
* [ADR-005: Suíte de Testes Unitários Cinemáticos Isolados de Dispositivos de Captura (Vitest)](#adr-005-suíte-de-testes-unitários-cinemáticos-isolados-de-dispositivos-de-captura-vitest)

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
     * O vetor de velocidade vertical descendente ($\Delta Y > 0.065$ com janela de debounce de 280ms) aciona o gatilho de palhetada (*strumming*), disparando as notas em cascata com atraso acústico de 35ms.
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
  `Tone.PolySynth` ➔ `Tone.Chorus` ➔ `Tone.Reverb` ➔ `Tone.Limiter(-1 dB)` ➔ `Tone.Volume(-6 dB)` ➔ `Tone.Destination`.
* **Trade-offs:**
  * *Vantagens:* Proteção absoluta contra clipping e fadiga auditiva; transientes suaves e sonoridade polida estilo estúdio musical; suporte a múltiplos timbres dinâmicos via envelopes ADSR.
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
  3. A suíte de persistência ([`gestureConfig.test.ts`](../src/__tests__/gestureConfig.test.ts)) opera com isolamento de `localStorage`.
* **Trade-offs:**
  * *Vantagens:* Execução ultrarrápida da suíte completa no CI (43 testes em menos de 500ms) com 100% de determinismo e zero dependência de drivers de vídeo.
  * *Desvantagens:* Testes de integração de vídeo requerem validação manual periódica ou testes E2E com drivers virtuais no Playwright.
