# Chiratta combat fidelity and reaction mechanics

Evidências de engenharia reversa do disco original PS2 (SLUS_215.83, DEFAULT.RCF) e parâmetros de integração nativa para o combate contra os Chirattas.

## 1. Dados recuperados da origem

* **Vida-base**:
  * Crash: 90 HP (`script\SpawnableTemplateActor.blua`, setter `SetBehaviourDataCrash`, linha 9426).
  * Chiratta: 4 HP (`script\SpawnableTemplateActor.blua`, setter `SetBehaviourDataFodder`, linha 11434).
* **Ataques leves do Crash (`fighttrees\Crash.bfig`)**:
  * `attack_lite_A`: Dano 1.0, Força 2.0, Janela ativa frames 3..6 (0.10s .. 0.20s), Direção Direita.
  * `attack_lite_B`: Dano 1.0, Força 2.0, Janela ativa frames 3..6 (0.10s .. 0.20s), Direção Esquerda.
  * `attack_lite_C`:
    * Strike 1: Dano 2.0, Força 2.0, Janela ativa frames 3..7 (0.10s .. 0.233s), Direção Direita.
    * Strike 2: Dano 3.0, Força 4.0, Janela ativa frames 10..15 (0.333s .. 0.50s), Direção Direita.
  * Combo completo A + B + C causa 1 + 1 + 2 + 3 = 7 de dano. Chiratta morre durante o primeiro golpe de C se receber a sequência completa.
* **Ataque do Chiratta (`fighttrees\Fodder.bfig`)**:
  * `attack_light`: Dano 2.0, Força 1.0, Janela ativa frames 22..27 (0.733s .. 0.90s), Duração total 1.3667s, Cooldown 1.0s.
* **Animações e Reações dos Chirattas (`package\aadd6163.p3d`)**:
  * `PTRN_chiratta_impact_light`: 36 frames @ 30 fps (1.20s). Usado em impactos leves/médios não fatais.
  * `PTRN_chiratta_impact_heavy`: 54 frames @ 30 fps (1.80s). Usado na transição de derrota `GetHitToDeath`.
  * No FightTree original, a chamada `SpawnStuff()` ocorre no frame 18 (0.60s) da animação pesada. O evento `ExitWhenFaded` conclui a transição com remoção do ator (`PrepareForDelete`).

## 2. Parâmetros nativos aproximados

* **Alcance de ataque de Crash**: 2.15 unidades no plano XZ.
* **Alcance de ataque do Chiratta**: 1.65 unidades no plano XZ.
* **Velocidade de perseguição do Chiratta**: 3.2 unidades/s.
* **Cone frontal de acerto (`facing`)**: Produto escalar normalizado > 0.15 (impede golpes em inimigos posicionados atrás do jogador).
* **Tolerância vertical entre pisos**: $\Delta Y < 1.4$ unidades (impede acertos entre andares ou desníveis excessivos).
* **Janela de invulnerabilidade do jogador**: 0.8s após sofrer dano (com 0.35s de tempo de reação `hitTime`).
* **Stagger de reação a golpe**: 0.45s de atordoamento inicial durante o qual a IA não ataca nem se move; novos golpes consecutivos reiniciam o stagger.
* **Duração de derrota e desvanecimento**: 1.8s (`impact_heavy`). Colisão física é desativada imediatamente na morte para não obstruir o jogador; opacidade decai suavemente entre 1.5s e 1.8s antes da remoção completa.

## 3. Integridade da interface e do mundo

* **Vida interna**: O Chiratta não possui barra de vida ou medidores artificiais sobre a cabeça na cena 3D, mantendo total fidelidade estética ao original. O HUD do Crash rastreia internamente a vida do alvo mais recente.
* **Sem corpos permanentes**: A remoção e o fade aos 1.8s garantem que inimigos derrotados não permaneçam na cena nem acumulem instâncias de colisão ou skinned meshes.

## 4. Limitações e próximos passos

* Recompensas de derrota (7 Mojo garantidos e drops de saúde/freeJack) são integradas no Ticket #4.
* Efeitos visuais originais (`death_effectA`, faíscas de impacto) e áudios de vozes (`labrat_vo_hit`, `disappear`) são implementados no Ticket #5.
