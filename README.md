# Crash Titans Web

Reconstrução nativa experimental de **Crash of the Titans**, para navegador no PC, usando Three.js e Rapier. Projeto não oficial em desenvolvimento. A prévia local ainda não reproduz a primeira fase inteira nem todas as regras do PS2.

Este repositório público contém código, conversores, testes e documentação. **Não contém a ISO nem recursos originais do jogo**: modelos, texturas, fontes, sons, vídeos, dados extraídos e capturas permanecem locais. Um clone novo não vem pronto para jogar. Os recursos pertencem aos respectivos titulares.

## Estado atual

- Menus, perfis locais, opções, abertura e primeira cutscene NIS01.
- Exploração nativa com colisão, movimento, salto e recuperação por checkpoint.
- Primeiro combate com dois Chirattas, combo leve, dano, reações e morte/retorno.
- Objetos quebráveis, Mojo e snapshot de coleta/objetos no checkpoint.
- HUD de vida, Mojo e combo; áudio de combate e interações.

Parte das regras físicas, IA, câmera, efeitos e transições ainda é aproximada. Apresentação Amb1, validação do percurso contínuo, recompensas específicas dos inimigos e mecânicas do primeiro titã permanecem pendentes.

## Preparação local

Requer Node.js com suporte a módulos ES. Para os conversores, Python 3.11+ e as dependências de `tools/requirements.txt`.

```sh
npm ci
npm run test:core
```

Os testes acima não exigem recursos originais. `npm test` inclui também testes de integração de dados extraídos e requer a preparação local desses recursos.

Com os recursos já convertidos em `public/assets/`:

```sh
npm start
```

Abra http://127.0.0.1:4173. O servidor escuta apenas na interface local. No Windows, `Iniciar.cmd` também inicia a prévia. Navegadores exigem interação antes de reproduzir áudio.

WASD/setas movem, Espaço pula, J ataca e Esc pausa. Controle padrão utiliza a Gamepad API; o comportamento em hardware físico ainda precisa de validação.

Entradas de desenvolvimento locais: `?combat-test=1` e `?interactions-test=1`. Elas não comprovam a progressão normal da fase e não salvam progresso jogável no perfil.

## Conversão de recursos

A edição usada no desenvolvimento é a americana de PS2, **SLUS_215.83**. Os conversores leem uma ISO local; não há download de conteúdo do jogo.

A conversão de menus aceita caminhos explícitos:

```sh
python -m pip install -r tools/requirements.txt
python tools/convert_menu.py --iso "CAMINHO_DA_ISO" --out "public/assets"
```

Esse comando prepara apenas os menus. Outros conversores preparam personagens, mapa, cenas, combate, áudio e interações. A preparação completa ainda não está unificada em um comando: alguns scripts legados usam caminhos de saída relativos ao workspace original (`outputs/crash-menu` e `outputs/crash-analysis`). Confira os argumentos e caminhos antes de usá-los fora dessa estrutura. Não se promete um bootstrap completo do gameplay a partir de um clone novo nesta entrega.

## Planejamento e evidências

O trabalho é acompanhado nas [Issues](https://github.com/Kauerc10/crash-titans-web/issues). O próximo pacote cobre o primeiro encontro completo e o percurso até a primeira passagem obrigatória com Spike; a [especificação aprovada e os 12 tickets com dependências](docs/planning/README.md) estão publicados nas Issues.

- [Roadmap do episódio 1](docs/episode-one-roadmap.md)
- [HUD e dados de combate](docs/hud-combat-milestone.md)

Os documentos de marcos registram o que foi implementado, a evidência disponível e as limitações. Relatórios e capturas de testes com recursos originais permanecem locais. Nunca adicionar a ISO ou `public/assets/` ao histórico Git, releases ou GitHub Pages.

Referências de formatos e avisos de terceiros: [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) e os avisos incluídos em `tools/`.
