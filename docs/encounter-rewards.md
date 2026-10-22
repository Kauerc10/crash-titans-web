# Encounter rewards and drop mechanics

Evidências recuperadas da ROM original PS2 (SLUS_215.83, DEFAULT.RCF) e especificação nativa para drops dos Chirattas, regras de sorteio, coleta e garantias contra farming.

## 1. Dados e semântica recuperados da origem

* **Tabela de Spawner do Chiratta** (`script\SpawnableTemplateActor.blua`, setter `SetBehaviourDataFodder`, linha 11434):
  * Slot 1: `Collectables:c_mojoS`, contagem `7.0` (garantido).
  * Slot 2: `Collectables:c_freeJack`, contagem `-5.0` (probabilístico).
  * Slot 3: `Collectables:c_health`, contagem `-5.0` (probabilístico).
* **Semântica de contagem negativa decodificada do ELF MIPS** (`CSpawnerBehaviour::SpawnActor`, VA `0x383c70`):
  * Contagem positiva $\ge 0$: concede a quantidade exata especificada sem sorteio (7 unidades de `c_mojoS`).
  * Contagem negativa $-K$: representa probabilidade percentual calculada via $|K| \times 0.01$ (portanto $-5 \rightarrow 0.05$ ou 5%).
  * **Exclusão mútua de slots probabilísticos**: Se um slot negativo anterior for sorteado com sucesso (`t9 = 1`), os slots negativos subsequentes são suprimidos sem realizar novo sorteio.
  * **Distribuição estatística**:
    * 7 $\times$ `c_mojoS`: 100% (70 de Mojo garantidos).
    * `c_freeJack`: $5.0\%$.
    * `c_health`: $(1 - 0.05) \times 0.05 = 4.75\%$.
    * Nenhum drop probabilístico: $90.25\%$.
    * Ambos `c_freeJack` e `c_health` juntos: **0% (impossível)**.

## 2. Temporização da derrota e emissão de drops

* **Separação de eventos**:
  * No FightTree original (`fighttrees\Fodder.bfig`), o estado de derrota `GetHitToDeath` executa `PTRN_chiratta_impact_heavy` (54 frames a 30 fps, 1.80s).
  * O método `SpawnStuff()` é invocado no **frame 18** (exatamente **0.60s**), e não no frame 0.
  * No runtime nativo, a emissão do evento `enemyReward` aguarda `e.age >= 0.6` e é protegida pela flag única `rewardEmitted`, impedindo disparos prematuros no início do golpe fatal ou duplicações em frames subsequentes.
  * O desvanecimento e a conclusão da colisão ocorrem entre 1.5s e 1.8s, culminando no evento `enemyDeathDone` e remoção visual.

## 3. Coleta e reflexo no HUD

* **Coleta de Mojo**:
  * Cada item `c_mojoS` concede 10 pontos de Mojo ao total acumulado.
  * O incremento aciona a animação de destaque do contador de Mojo no HUD durante 0.5s.
* **Coleta de Vida (`c_health`)**:
  * Concede 10 pontos de cura através de `combat.healPlayer(amount)`.
  * A vida é limitada ao teto de vida máxima (90 HP para o Crash).
  * O jogador não pode ser curado após a morte (`health <= 0`).
* **Contador de Combo**:
  * Incrementa a cada acerto (`enemyHit`) e permanece visível por 3.0s antes de desaparecer.

## 4. Garantia atômica de checkpoint e prevenção de farming

* `Pickups.markCheckpoint()` salva uma cópia atômica profunda (`structuredClone`) do mapa de itens e do total acumulado de Mojo.
* Em caso de morte do jogador ou reinício antes da consolidação do próximo checkpoint:
  * `pickups.resetToCheckpoint()` restaura estritamente o total e os itens do checkpoint anterior.
  * Recompensas coletadas durante a tentativa incompleta são descartadas.
  * O encontro é reiniciado do zero, impedindo o acúmulo infinito de Mojo através de mortes sucessivas (anti-farming).
