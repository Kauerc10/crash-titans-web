# Vitória e consolidação de checkpoint — #6 / correção #15

## Invariante de recuperação

Vitória durante uma tentativa e vitória consolidada são estados diferentes. Objetivos do episódio, combate, objetos, itens, Mojo e tutoriais devem voltar ao mesmo limite lógico antes de devolver controle e câmera.

- Antes de vencer: retomar restaura o checkpoint anterior e permite enfrentar o grupo novamente.
- Depois de vencer, antes do próximo checkpoint: retomar desfaz tanto a conclusão do objetivo quanto o combate e as recompensas da tentativa. O checkpoint seguinte permanece bloqueado até uma nova vitória.
- Depois de consolidar: objetivo, vitória e recompensas consolidadas permanecem. O grupo não reaparece nem gera um segundo pagamento.
- Durante a derrota/atraso do drop: consolidar conserva atores e seus marcadores de pagamento; recuperar não deve perder um pagamento pendente nem repetir um já emitido.

A revisão de 22/10/2026 reproduziu uma falha: o combate voltava pendente, mas o objetivo permanecia concluído, permitindo o checkpoint seguinte. O aceite anterior de #6 foi invalidado por esse caso. A correção #15 passou por novo aceite no navegador: vitória, retry antes de consolidar, nova vitória, checkpoint 3 e retry após consolidar. O fechamento de #6 acompanha a revisão/merge da correção.

## Evidência automática

`npm run test:core` usa regras públicas com fixtures sintéticas mínimas. Os testes acionam golpes reais da regra de combate, verificam rollback de objetivo/combate e preservação de recompensas consolidadas. São regressões determinísticas; não demonstram colisões, caminho físico ou vitória numa partida no navegador.

`npm run test:source` valida separadamente referências dos checkpoints e a composição do encontro a partir dos dados convertidos localmente. Não precisa publicar recursos originais para executar o core.

## Aceite no navegador

Partir do menu, entrar no gameplay pelos controles normais, caminhar até Amb1/Combat2, vencer usando ataques e alcançar o próximo checkpoint. Repetir retry antes da vitória, após vitória antes da consolidação, durante drops e depois da consolidação; observar objetivo, inimigos, itens, Mojo e controle. Registrar evidência apenas localmente. Não usar teleporte, escrita de objetivos, atribuição de vida ou chamada direta de início do gameplay.

A aprovação desta documentação ou a execução de testes de regras não representa aprovação desse percurso. O relatório local da execução real deve registrar explicitamente qualquer obstáculo ou trecho que não tenha sido exercitado.


## Resultado observado em 22/10/2026

O [novo aceite de #15](corrective-15-validation.md) partiu do menu e comprovou a chegada ao encontro, vitória e checkpoint 3 com entradas reais. Retry antes da consolidação desfez objetivo e combate juntos; depois dela preservou ambos. A caminhada até R2 e o retorno ao checkpoint também verificaram a seleção de regiões. Morte e atraso dos drops têm regressões determinísticas; essa travessia usou retry pela interface e não repetiu todos os casos como morte física.

Esse resultado aguarda revisão/merge do PR corretivo. #7 continua aberta: não foi comprovado nem implementado o percurso completo até Spike.
