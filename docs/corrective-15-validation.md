# Validação da correção #15 — 22/10/2026

Base revisada: `c6efb1d`. Correções na branch `integration/corrective-15`, incluindo o ajuste de visibilidade do botão de skip em `772cf13`. Esta evidência permite revisar a correção e o novo aceite de #6; não conclui o pacote original até Spike.

## Regressões automatizadas

43 testes core e 14 testes source passaram. O core também passou num export independente do Git após instalação nova, sem recursos originais, dependências anteriores ou links para assets locais; não houve skips. A suíte source exige dados convertidos localmente.

As regressões cobrem rollback conjunto de objetivo e combate, recompensas pendentes sem perda/duplicação, tutoriais disponíveis e posição do flash de derrota quando Crash se afasta. Efeitos WebGL usam texturas recuperadas, cor e fade; os emissores permanecem uma aproximação nativa. A inspeção visual local não observou erro de shader. O botão de pular conversa ficou oculto fora da apresentação.

## Percurso real do primeiro encontro

Executado em Chrome headless com SwiftShader, viewport 1280 × 900, desde o título e criação de perfil na dificuldade normal. Foram usados os botões de iniciar/pular oferecidos pela interface e entradas reais de teclado/mouse. A inspeção somente leu estado: sem teleporte, escrita de vida/objetivos ou chamada direta de início do gameplay.

1. Caminhar por R1 até Amb1 e os dois Chirattas, sem recuperação involuntária.
2. Acionar Amb1 pela entrada física no volume e usar o skip nativo da interface.
3. Vencer com ataques J; retomar pela interface antes de consolidar e observar objetivo Combat2 e combate voltarem pendentes juntos.
4. Caminhar novamente, vencer e alcançar fisicamente o checkpoint 3.
5. Retomar após consolidar e observar vitória e objetivo preservados.
6. Caminhar até R2 e observar apenas region2 visível; retomar o checkpoint e observar apenas region1 visível.

O harness local concluiu esse percurso sem erros de página. Scripts, relatórios, dados e capturas de gameplay ficam locais, sem publicação de recursos originais.

## Limites e rastreamento

- O teste cobre o primeiro encontro e checkpoint 3; não cobre o percurso completo até Spike. #7 permanece aberta e bloqueia #8.
- Os retries dessa travessia usaram a interface. Morte e atraso de drops têm regressões determinísticas; nem todos esses casos foram repetidos como morte física no navegador.
- A sala bônus teve diagnóstico separado com posicionamento controlado; não se afirma uma passagem real pelo portal ainda ausente.
- Um trajeto exploratório anterior não alcançou um waypoint desnecessário numa encosta de R2. O aceite final cobre a transição necessária e o retorno, sem tratar aquela tentativa como caminho completo.
- A permissão de skip e o enquadramento originais de Amb1 continuam não verificados. O teste demonstra o comportamento nativo disponível.
- Não houve medição comparativa de FPS ou controle físico. SwiftShader não representa desempenho de GPU do usuário.

#6 recebeu novo aceite da inconsistência corrigida em #15 e aguarda revisão/merge da correção para fechamento. O PR corretivo pode fechar #15 e #6 quando integrado; o PR #14 continua rascunho pelo escopo original incompleto.
