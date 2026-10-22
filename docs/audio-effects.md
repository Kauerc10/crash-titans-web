# Combat audio, feedback and visual effects

Mapeamento de evidências originais da ROM PS2 (SLUS_215.83, SOUND.RCF, DEFAULT.RCF) e arquitetura nativa para efeitos audiovisuais de combate e coleta.

## 1. Vínculos de áudio recuperados da origem

* **Áudios de Combate e Derrota dos Chirattas** (`SOUND.RCF`, `sound\zscripts\map.p3d`, `sound\zscripts\char_common.p3d`, `sound\zscripts\char_fodder.p3d`):
  * `bone_crushers`: `in_game_art\sound\sounds\impact_effects\bone_crusher_04.wav` (`sound\rsd\2\2bfbb649e7b36347.rsd`). Acionado no frame 0 da derrota pesada `GetHitToDeath` (`defeat.ogg`).
  * `disappear`: `in_game_art\sound\sounds\enemies\fodder_death_flash.wav` (`sound\rsd\7\722836cdf4b1a230.rsd`). Acionado no frame 0 do estado `Dead` (`disappear.ogg`).
  * `fodder_bodyfalls`: `in_game_art\sound\sounds\enemies\fodder_bodyfall_03.wav` (`sound\rsd\6\61050cde35825eb0.rsd`). Acionado nos frames 6 e 10 de queda do corpo (`bodyfall.ogg`).
  * `impact_punch`: `in_game_art\sound\sounds\crash\crash_generic_impact_01.wav` e `02.wav` (`hit.ogg` e `hurt.ogg`).
  * `slap`: `in_game_art\sound\sounds\enemies\chiratta_slap_2a.wav` (`enemy.ogg`). Ataque básico do Chiratta.
  * `whoosh`: `in_game_art\sound\sounds\crash\crash_light_whoosh_03.wav` (`swing.ogg`).
* **Áudios de Coletáveis e Itens** (`SOUND.RCF`):
  * Mojo: `in_game_art\sound\sounds\fe_and_pickups\mojo_collect_02.wav` (`mojo.ogg`).
  * Fruta Wumpa (`c_health`): `in_game_art\sound\sounds\fe_and_pickups\whumpa_pu_01.wav` (`health.ogg`).
  * FreeJack (`c_freeJack`): `in_game_art\sound\sounds\props\freejack_glow_03.wav` (`freejack.ogg`).

## 2. Texturas de partículas recuperadas

* **Efeito de Impacto** (`package\c6173b06.p3d`, `impact_punch_grey_star`):
  * `flash06.webp`, `flash13.webp`, `glowa.webp`, `spark1.webp`, `star03.webp`.
* **Efeito de Derrota** (`fx\ab40fe25.p3d`, `death_effectA`):
  * `flash09.webp`, `glow01.webp`, `streak03.webp`.

## 3. Arquitetura do pool limitado e controle de voz

* **Polifonia limitada**:
  * O gerenciador `GameplayAudio` restringe a no máximo 8 fontes ativas concorrentes (`sources.size >= 8`), evitando saturação de áudio ou degradação em combates movimentados.
  * Throttling mínimo de 0.06s por categoria de som para descartar disparos excessivos no mesmo frame.
  * Respeita imediatamente `muted`, controle de volume (`effects`) e modo de canais (mono/stereo).
  * O estado de pausa interrompe todas as vozes em execução e suspende o `AudioContext`; a recuperação de checkpoint ou término limpa todos os buffers.
* **Pool de partículas (`GameplayEffects`)**:
  * Pool de 128 partículas usando dois `THREE.InstancedMesh`: impacto/coleta com `impact/star03.webp` e desaparecimento/recompensa com `death/flash09.webp`. As demais texturas convertidas estão disponíveis, mas não são usadas neste renderer.
  * O total de partículas ativas é limitado a 128, compartilhadas entre dois lotes instanciados; cada lote reserva capacidade fixa. Não há promessa de zero alocações no loop.
  * As partículas orientam-se continuamente para a câmera (`billboard`) e sofrem atenuação linear de opacidade por instância e escala até expirar. A cor por evento multiplica a textura recuperada.
  * `clear()` reinicia imediatamente o pool na pausa ou ao retornar a um checkpoint.

## 4. Lacunas e limitações conhecidas

* A simulação física completa dos emissores Pure3D (canais `SPAR`, `SPEM`, `PSPG` sob o chunk `0x1580c`) permanece como aproximação por quads billboard instanciados com as texturas originais.
* Falas aleatórias dos inimigos em combate (`labrat_vo_hit`, `labrat_vo_hitbig`) ainda necessitam de decodificação das tabelas de diálogo por idioma.

## Seleção de setores

O suporte físico do jogador escolhe o setor visível, preservando a seleção usada antes da regressão. Setores inativos, incluindo a sala bônus, não participam dos oclusores da câmera. A travessia integral e as cenas ainda ausentes continuam pendentes; testes por teleporte são apenas diagnósticos de seleção, nunca prova do percurso.
