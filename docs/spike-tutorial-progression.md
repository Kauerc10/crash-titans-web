# Progressão de Tutoriais e Primeira Interação com Spike (Ticket #7 / Issue #7)

## 1. Visão Geral e Evidências da ROM PS2 (SLUS_215.83)

Este ticket implementa a continuidade da fase *Episode 1* a partir da vitória em `L1_E1_Combat2` e do Checkpoint 3 (`WhumpaE1LevelReset3`) ao longo de toda a rota de tutoriais e checkpoints intermediários até a entrada na arena do primeiro titã (`Spike`).

### 1.1 Fontes Originais Recuperadas
- **String Bibles P3D (Chunk `0x1800e`)**: Extraídas de `package\c1e387c7.p3d` e tabelas de hash `ingameU` / `ingameE` com módulo 65599:
  - `Hint_Movement_PS2` (`USE THE LEFT ANALOG STICK TO WALK OR RUN. PRESS ✕ TO JUMP.`)
  - `Hint_LightAttack` (`PRESS ▢ TO SMASH STUFF.`)
  - `TUT_Mojo` (`THE ESSENCE OF LIFE ITSELF. COLLECT IT AND EARN REWARDS.`)
  - `TUT_AirJump` (`PRESS THE JUMP BUTTON TWICE • ✕, ✕`)
  - `TUT_BouncePad` (`JUMP AS YOU LAND ON A SPRINGY OBJECT • ✕`)
  - `TUT_SpinHover` (`PRESS JUMP AND REPEATEDLY PRESS LIGHT ATTACK • ✕, ▢, ▢, ▢ . . .`)
  - `Hint_BlockBreaker` (`PRESS AND HOLD △ TO BREAK AN ENEMY'S BLOCK.`)
  - `TUT_Jacking` (`STUN AN ENEMY AND PRESS ◯ TO JACK • PRESS ◯ TO UNJACK`)
- **Áudios de Tutoriais**: Extraídos de `ENGLISH.RCF` e `SOUND.RCF` via FFmpeg em formato `.ogg`:
  - `basic.ogg`: `tutorial_basic_ps2.wav` (`sound\rsd\english\3\30102f5c89509fa9.rsd`)
  - `light_attack.ogg`: `tutorial090_aku_ps2.wav` (`sound\rsd\english\5\5334156f483375e5.rsd`)
  - `air_jump.ogg`: `tutorial003_aku_ps2.wav` (`sound\rsd\english\6\6ce4f92b7b64b829.rsd`)
  - `heavy_attack.ogg`: `tutorial059_aku_ps2.wav` (`sound\rsd\english\8\82cfea49c5229be0.rsd`)
  - `multiplier.ogg`: `tutorial159_aku_gen.wav` (`sound\rsd\english\a\af607e000d0e15b8.rsd`)
  - `spin_hover.ogg`: `tutorial114_aku_ps2.wav` (`sound\rsd\english\b\b1311aa91964a3ec.rsd`)
  - `bounce_pad.ogg`: `tutorial099_aku_ps2.wav` (`sound\rsd\english\b\b178225d6b4292ec.rsd`)
  - `chime.ogg`: `button_01.wav` (`sound\rsd\3\314ba63ffd39f779.rsd`)
- **Assets Gráficos do HUD**:
  - `message_bar_background.webp` (faixa tribal de aviso)
  - `tut_icon_crash.webp` (ícone original de perfil de Crash)
  - `fe_divider_2_flipped_sharp.webp` (divisor ornamental)

---

## 2. Instruções Contextuais para Teclado e Gamepad

A classe `TutorialManager` detecta dinamicamente o método de entrada (`keyboard` vs `gamepad`):
- **Teclado**:
  - Movimento: WASD / Setas
  - Salto / Salto duplo: ESPAÇO / ESPAÇO, ESPAÇO
  - Ataque leve: J
  - Quebra de bloqueio / Ataque pesado: Segurar K
  - Montar no titã (Jack): L
  - Spin Hover: ESPAÇO + J, J, J...
- **Gamepad / Controle Padrão**:
  - Movimento: Analógico esquerdo
  - Salto / Salto duplo: ✕ (A) / ✕, ✕ (A, A)
  - Ataque leve: ▢ (X)
  - Quebra de bloqueio / Ataque pesado: Segurar △ (Y)
  - Montar no titã (Jack): ◯ (B)
  - Spin Hover: ✕ + ▢, ▢, ▢...

A troca de dispositivo atualiza imediatamente o texto da interface ativa sem reiniciar a duração do prompt nem interromper o controle do jogador.

---

## 3. Não-Bloqueio e Ciclo de Vida dos Prompts

- **Controle Ininterrupto**: Exibir uma dica ou aviso nunca paralisa o movimento, ataque ou pulo de Crash.
- **Pausa Conforme as Regras**: Em caso de pausa (`pause(true)`), o tempo restante (`active.remaining`) é congelado e retomado sem perda ou extensão indevida após o despausar.
- **Encerramento Automático**: O término do timer emite `tutorialEnded` e oculta a barra suavemente.

---

## 4. Prevenção de Repetição e Rollback de Checkpoint

- Tutoriais acionados entram em `completed`, garantindo que transitar novamente pelas pedras ou volumes não gere repetições spam.
- Ao alcançar um checkpoint válido (`WhumpaE1LevelReset...`), `markCheckpoint()` consolida os tutoriais vistos.
- Em caso de morte e retorno ao checkpoint (`resetToCheckpoint()`), os tutoriais consolidados antes do checkpoint permanecem marcados, evitando que o jogador tenha que rever dicas já absorvidas.

---

## 5. Chegada à Interação com Spike (`PlaySpike`)

- Volume: `PlaySpike` em `[-200.165, 91.980, -206.613]`.
- Checkpoint prévio: `WhumpaE1LevelReset24` em `[-198.26, 77.67, -227.93]`.
- Pré-requisitos:
  - Tentativas de acionamento prematuro (antes de vencer `L1_E1_Combat2`) são rejeitadas com `spikeInteractionBlocked`.
  - Chegada pelo percurso normal após vencer Combat 2 ativa `spikeInteractionReached` (`SpikeCinematic`), completando o objetivo e preparando o terreno para o Ticket #8 (combate com Spike).
