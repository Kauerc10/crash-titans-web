# Tutoriais disponíveis e percurso até Spike — aceite pendente

## Correção de aceite (#7, #15)

A entrega anterior confundiu inventário recuperado com progressão implementada. Os testes que forneciam diretamente posições a TutorialManager e EpisodeProgress eram testes de regras; não caminharam pela fase. O fechamento anterior de #7 não comprova a prontidão de #8.

O percurso completo desde Combat2 até Spike **continua pendente**. Faltam encontros intermediários, resgate de Aku Aku e apresentações NIS26/NIS02. A entrada em PlaySpike não executa SpikeCinematic, não conclui esse objetivo e não anuncia um titã inexistente. O inventário original de volumes, textos e áudios permanece referência para implementação futura.

## Comportamento disponível

Tutoriais de movimento, ataque leve, Mojo e salto duplo usam o gerenciador de prompts. A troca de teclado/controle atualiza a dica ativa; a pausa conserva seu tempo; retry descarta dicas não consolidadas. A apresentação da dica não substitui a execução de uma mecânica.

Orientações de pesado carregado/quebra de bloqueio, montar, spin hover, bounce e multiplicador ainda não validadas não devem aparecer como ações disponíveis. K/Y deixa de executar o terceiro golpe leve: esse golpe permanece no combo leve. Textos recuperados dessas capacidades são inventário, não controles prontos.

## Evidência e aceite

- `npm run test:core`: regras com fixtures sintéticas de coordenadas inventadas. Exercita prompts, pausa, dispositivo, rollback e ausência de conclusão artificial de Spike.
- `npm run test:source`: valida inventário extraído localmente, referências de volumes e locators. Exige recursos convertidos e não constitui um percurso jogado.
- Aceite real de #7: partir do menu, usar apenas entradas do jogador, atravessar encontros e resgate efetivos e assistir/usar skip permitido das cenas implementadas. Inspeção pode observar estado; não pode teleportar, concluir objetivos ou iniciar gameplay diretamente.

Nenhum teste por coordenadas, flag de proximidade ou teste de inventário satisfaz esse último aceite. Não fechar #7 até existir evidência reproduzível do percurso completo; #8 permanece bloqueado por ele.
