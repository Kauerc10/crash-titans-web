# Pacote: primeiro encontro completo e primeiro titã no percurso normal

## Problem Statement

A prévia já permite explorar, combater Chirattas e interagir com objetos, mas os atalhos de teste demonstram sistemas isolados. O jogador ainda não pode percorrer de forma validada a sequência original de apresentação, combate, recompensa, checkpoint, tutoriais e primeiro titã. Algumas regras e efeitos são reconstruções aproximadas. O objetivo é completar esse trecho com comportamento e apresentação comparáveis ao PS2 antes de avançar para outra fase.

## Solution

Entregar um percurso contínuo no PC, iniciado no menu, passando pelo primeiro encontro até o primeiro obstáculo obrigatório resolvido com Spike. Cada incremento deve ser jogável e verificável, preservando o mapa, a animação e o HUD já aprovados. Evidência extraída e comparação com o jogo original orientam a implementação; lacunas ficam explícitas.

## User Stories

1. Como jogador de PC, quero iniciar pelo menu e chegar ao primeiro encontro pelo percurso normal, para jogar sem atalhos de desenvolvimento.
2. Como jogador de PC, quero ver a apresentação Amb1 na ordem confirmada no original, para entender a entrada dos inimigos.
3. Como jogador de PC, quero pular uma apresentação quando permitido sem quebrar os objetivos, para retomar o controle corretamente.
4. Como jogador de PC, quero receber os tutoriais no contexto correto, para aprender os comandos de PC ou controle.
5. Como jogador de PC, quero encontrar Chirattas nas posições e condições de origem, para reconhecer o encontro original.
6. Como jogador de PC, quero acertar somente inimigos dentro do alcance e da janela do golpe, para que o combate seja previsível.
7. Como jogador de PC, quero encadear o combo leve sem repetir contatos indevidos, para causar o dano correspondente aos ataques.
8. Como jogador de PC, quero ver e ouvir a reação a cada golpe válido, para perceber quando acertei ou fui atingido.
9. Como jogador de PC, quero receber dano dos inimigos e acompanhar minha vida, para saber quando recuar.
10. Como jogador de PC, quero ver a derrota dos Chirattas sem barras de vida inventadas, para manter a apresentação original.
11. Como jogador de PC, quero receber somente os drops confirmados para cada inimigo, para obter recompensas coerentes com o original.
12. Como jogador de PC, quero coletar Mojo e atualizar seu total uma única vez, para não perder nem duplicar recompensas.
13. Como jogador de PC, quero ver o combo surgir e expirar conforme as regras verificadas, para acompanhar a sequência de acertos.
14. Como jogador de PC, quero ouvir impactos, coleta e derrota respeitando mute e volumes, para manter o feedback consistente.
15. Como jogador de PC, quero ver partículas e efeitos nos contatos corretos, para reconhecer a resposta visual do original.
16. Como jogador de PC, quero vencer o encontro e liberar a passagem correspondente, para continuar a fase naturalmente.
17. Como jogador de PC, quero ativar o próximo checkpoint somente ao cumprir seus pré-requisitos, para preservar a sequência dos objetivos.
18. Como jogador de PC, quero morrer e retornar com inimigos, itens e objetos coerentes com o checkpoint, para tentar novamente sem inconsistências.
19. Como jogador de PC, quero pausar e perder o foco da janela sem receber ataques ou acumular comandos, para retomar com segurança.
20. Como jogador de PC, quero chegar à primeira interação obrigatória com Spike pelo percurso normal, para aprender a mecânica de titãs.
21. Como jogador de PC, quero atordoar Spike seguindo as regras recuperadas, para abrir a oportunidade de montar.
22. Como jogador de PC, quero identificar claramente a oportunidade e o comando de montar, para entender quando posso agir.
23. Como jogador de PC, quero montar usando Aku Aku com a transição original disponível, para assumir o controle do titã.
24. Como jogador de PC, quero mover Spike com colisão e câmera adequadas, para explorar sem atravessar o cenário.
25. Como jogador de PC, quero executar os ataques necessários de Spike, para enfrentar inimigos e obstáculos do trecho.
26. Como jogador de PC, quero ver o HUD correspondente ao controle do titã, para entender seu estado e suas ações.
27. Como jogador de PC, quero desmontar conforme as regras confirmadas, para voltar ao controle de Crash.
28. Como jogador de PC, quero sofrer a perda do titã sem perder o controle do jogo, para continuar ou retornar ao checkpoint corretamente.
29. Como jogador de PC, quero romper o primeiro obstáculo que exige a força do titã, para avançar pela passagem original.
30. Como jogador de PC, quero retomar um checkpoint com Crash ou Spike no estado coerente, para não ficar preso na progressão.
31. Como jogador de PC, quero usar teclado ou controle padrão com comandos contextuais claros, para concluir o mesmo percurso nas duas entradas.
32. Como jogador de PC, quero repetir o trecho sem duplicar cenas, inimigos, recompensas ou eventos de vitória, para manter uma sessão consistente.
33. Como jogador de PC, quero jogar o trecho sem quedas prolongadas de fluidez em um PC de referência documentado, para manter os comandos responsivos.
34. Como jogador de PC, quero consultar o que está confirmado e o que ainda é aproximação, para avaliar a fidelidade do porte honestamente.
35. Como jogador de PC, quero obter instruções de instalação que não dependam de arquivos do jogo publicados no GitHub, para preparar meus próprios recursos localmente.

## Implementation Decisions

- Manter o runtime nativo Three.js/Rapier, com foco em desktop e entrada por teclado e Gamepad API. Não substituir o trabalho por emulação neste pacote.
- Preservar menus, NIS01, geometrias, colisões, skinning, mistura de animações e composição aprovada da barra de vida.
- Reutilizar os módulos de progresso do episódio, combate, atores, objetos quebráveis, coleta, áudio e HUD. Extrair coordenação adicional somente onde o fluxo exigir; evitar refatoração ampla preventiva.
- Tratar os objetivos originais como fonte de ordem e pré-requisitos. A posição exata de Amb1, tutoriais, primeiro Spike e passagem deve ser confirmada nos scripts e na referência antes de codificar transições.
- O encontro já disponível é L1_E1_Combat2. Não inventar conclusão de objetivos que não foram executados nem usar teleporte para validar progressão normal.
- Registrar por comportamento a evidência de origem, a comparação observada, a implementação e as limitações. Recuperação de dados não equivale a execução das regras originais.
- Preservar os valores-base recuperados de vida, dano e janelas de contato. Ajustar alcance, IA, modificadores e reação somente com evidência e verificações observáveis.
- Confirmar drops dos Chirattas em seus templates/scripts. Não copiar automaticamente os drops dos objetos. Recuperar convenções probabilísticas antes de implementá-las.
- Garantir recompensa por derrota uma única vez; integrar drops, coleta, combo e apresentação sem adicionar barra de vida aparente aos inimigos comuns.
- Estender a recuperação atômica existente aos objetivos, cenas, inimigos, drops, controle de Crash/Spike e obstáculos relevantes. Checkpoint em memória; persistência entre sessões fora deste pacote.
- Modelar explicitamente os estados necessários para Spike: hostil, atordoado, transição de montar, controlado e saída/perda. Detalhes de duração e ações vêm da evidência, não de valores inventados apresentados como originais.
- Compartilhar eventos observáveis entre simulação e efeitos para evitar sons, partículas e recompensas duplicados. Pausa, mute, perda de foco e descarte da sessão devem funcionar em todos os estados.
- HUD de titã e tutoriais usam os recursos originais disponíveis, com comandos adaptados ao dispositivo. Medidores e transições ainda não recuperados devem ser registrados como pendências.
- Definir o fim deste pacote no primeiro obstáculo obrigatório superado com Spike e no próximo estado estável de progressão, identificado na revisão de origem. Não chamar isso de primeira fase completa.
- O repositório público contém código, conversores, testes e documentação. ISO, arte, fontes, modelos, áudios, vídeos, scripts extraídos e capturas permanecem locais. O clone público não é uma distribuição jogável pronta.

## Testing Decisions

- Interface principal: a aplicação real no navegador, com entrada por teclado e Gamepad API simulada. O teste de aceitação começa no menu, segue o percurso normal e chega ao fim do pacote sem atalhos de teste nem teleporte.
- Reutilizar a inspeção existente somente para observar estado e diagnosticar falhas; a aceitação do percurso não pode alterar estado por essa interface.
- Reutilizar os testes atuais de combate, progresso, coleta, quebráveis, câmera e transições de animação para invariantes determinísticas. Preferir comportamento externo: dano recebido, recompensa coletada, passagem aberta, retorno coerente e controle recuperado.
- Cobrir os caminhos de vitória, morte antes/depois de coletar, retry antes/depois do checkpoint, pausa, perda de foco, skip quando permitido, montar, desmontar e perda do titã.
- Comparar HUD, cenas, reação aos golpes e efeitos com capturas locais do original em estados equivalentes. Não confundir aprovação de layout com igualdade de timing e regras.
- Testes sem recursos do jogo rodam no clone público. Integração com recursos extraídos e comparação visual rodam localmente; não publicar esses recursos nem capturas como fixtures.
- Registrar máquina, navegador, resolução, qualidade e tempo de quadros do percurso; usar a medição inicial como base e corrigir regressões observáveis. Não prometer meta de FPS sem uma máquina de referência medida.
- Controle físico continua exigindo teste manual em hardware; simulação da API não comprova compatibilidade física.

## Out of Scope

- Celular, multiplayer/co-op e reprodução de todas as opções de dificuldade/upgrades.
- Demais fases, demais titãs, todas as ramificações do episódio 1 e seu encerramento.
- Sala bônus completa, caixas explosivas e de saúde quando não forem necessárias ao trecho definido.
- Save persistente de gameplay, memory cards e backend de contas.
- Portar o executável PS2, emulação no navegador ou prometer equivalência integral ao jogo.
- Hospedar ou distribuir a ISO e recursos originais em GitHub, releases, Pages ou CI.

## Further Notes

Base existente: sete setores e sala bônus importados; exploração e checkpoints; primeiro combate de dois Chirattas; 140 objetos, 119 Mojo posicionados, drops positivos de objetos e rollback; dez sons; HUD de Crash/Mojo/combo; 29 testes Node na última verificação local. Esses números são inventário, não prova de fase concluída. Apresentação Amb1, partículas, progressão integral e primeiro titã permanecem pendentes.

A especificação e os tickets foram aprovados pelo mantenedor e publicados com a label ready-for-agent. O status de execução depende das dependências nativas do GitHub, não apenas da label. Dependências representam bloqueios técnicos reais; a ordem sugerida não transforma todo trabalho em uma cadeia artificial. O mapa de tickets é detalhado no rascunho de decomposição.
