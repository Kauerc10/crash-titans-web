# Encounter victory and checkpoint consolidation

Regras de progressão de objetivos e consolidação atômica de checkpoints para o primeiro encontro de combate e a passagem subsequente.

## 1. Mapeamento de objetivos e pré-requisitos

* **Encontro original**:
  * Objetivo `L1_E1_Combat2` (`gameplay.json`, `episode-one-objectives.json`).
  * Grupo de spawner: `L1_E1CombatGroup2` com 2 Chirattas (`L1_E1EnemyLocator3` e `L1_E1EnemyLocator4`).
  * Condição de vitória original: `WAIT_NumActorsInGroup ['L1_E1CombatGroup2', 0]`.
* **Próximo checkpoint**:
  * `WhumpaE1LevelReset3`: volume de trigger `WhumpaE1ResetVolume3` e posição de reset `WhumpaE1ResetLocator3` `[93.68, 17.19, -17.98]`.
  * **Pré-requisito**: `requires: ['L1_E1_Combat2']`. A ativação do checkpoint 3 exige formalmente a conclusão do encontro, impedindo que o jogador consiga consolidar o progresso ou pular a batalha apenas passando pelo volume de gatilho.

## 2. Ciclo de vitória e transição

* Quando todos os inimigos do encontro têm vida reduzida a 0:
  * `Combat.step()` emite o evento `cleared` com o id `'L1_E1_Combat2'`.
  * `game-flow.js` intercepta o evento e invoca `progress.complete(event.id)`.
  * O HUD e os avisos na tela notificam a vitória com a mensagem "Encontro vencido".
  * Nenhum inimigo, colisor ou controle fica preso em estado de combate.

## 3. Comportamento determinístico de checkpoint e anti-farming

* **Morte antes da vitória**:
  * Caso o jogador seja derrotado durante o combate, `recover()` restaura o checkpoint anterior (`WhumpaE1LevelReset2` ou posição de entrada).
  * O encontro é reiniciado do zero, inimigos derrotados na tentativa incompleta são rearmados e Mojo coletado durante a tentativa é descartado atomicamente.
* **Morte após a vitória, mas antes do checkpoint 3**:
  * Caso o jogador morra antes de cruzar o volume do checkpoint 3, ele retorna ao checkpoint 2 com o total anterior.
* **Morte após cruzar o checkpoint 3**:
  * A entrada em `WhumpaE1ResetVolume3` dispara a consolidação atômica de `combat.markCheckpoint()` e `pickups.markCheckpoint()`.
  * Em mortes subsequentes, `recover()` posiciona o Crash no `WhumpaE1ResetLocator3`.
  * O encontro permanece na lista `cleared`, sem re-spawn de inimigos ou duplicação de itens.
