# Plano de testes — Paisagens Sonoras (Fase 1)

Instruções para uma pessoa **sem conhecimentos de programação**.
Registra o resultado de cada teste numa coluna à direita.

## Preparação

- Computador portátil ou tablet com navegador moderno (Chrome, Edge,
  Firefox ou Safari recentes) e webcam integrada.
- Três objetos coloridos: um **vermelho**, um **verde**, um **azul**,
  com cores vivas (tampas de garrafa, cartolina, blocos).
- Mesa iluminada de forma uniforme, sem sombras fortes.
- Colunas ou auscultores ligados.

## Testes

| # | O que testar | Como testar | Resultado esperado | Feito? | Resultado |
|---|--------------|-------------|--------------------|--------|------------|
| 1 | Abertura da página | Abrir o endereço da aplicação | A página carrega com o título «Paisagens Sonoras» e o botão «Iniciar instrumento» ativo | ☐ | |
| 2 | Permissão da câmara | Clicar «Iniciar instrumento» e autorizar a câmara | A imagem da câmara aparece na página; não há mensagens de erro | ☐ | |
| 3 | Recusa da câmara | Recarregar, clicar «Iniciar» e recusar a permissão | Surge uma mensagem clara a explicar como resolver; o botão volta a ficar utilizável | ☐ | |
| 4 | Detecção do vermelho | Colocar só o objeto vermelho na mesa | O indicador «Aves» fica ativo e ouve-se o som de aves | ☐ | |
| 5 | Detecção do verde | Retirar o vermelho e colocar o objeto verde | «Água» fica ativo e ouve-se o som de água | ☐ | |
| 6 | Detecção do azul | Retirar o verde e colocar o objeto azul | «Vento» fica ativo e ouve-se o som de vento | ☐ | |
| 7 | Falso positivo | Mesa vazia, sem objetos no enquadramento | Nenhum dos três sons fica ativo | ☐ | |
| 8 | Coexistência | Colocar os três objetos em simultâneo | Os três indicadores ficam ativos e os três sons ouvem-se misturados | ☐ | |
| 9 | Posição vertical | Mover um objeto devagar do topo da imagem para o fundo | O som fica mais intenso no fundo (perto de ti) e mais suave no topo, sem saltos abruptos | ☐ | |
| 10 | Retirar objeto | Retirar um objeto do enquadramento | O som desse elemento desliga-se gradualmente (cerca de meio segundo), sem corte seco | ☐ | |
| 11 | Volume geral | Mexer o cursor «Volume geral» | O volume total muda imediatamente | ☐ | |
| 12 | Sensibilidade | Baixar a sensibilidade ao mínimo e testar deteção; depois subir ao máximo | No mínimo, a deteção exige cores mais fortes/maiores; no máximo, deteta mais facilmente | ☐ | |
| 13 | Parar e reiniciar | Clicar «Parar» e depois «Iniciar instrumento» novamente | A câmara e os sons voltam a funcionar normalmente | ☐ | |
| 14 | Iluminação diferente | Repetir os testes 4-6 com luz diferente (mais escura, luz lateral) | A deteção continua a funcionar, eventualmente com ajuste de sensibilidade | ☐ | |
| 15 | Transições sonoras | Mover os objetos continuamente durante 1 minuto | Não há cliques, estalidos nem reinícios audíveis dos sons | ☐ | |
| 16 | Tablet | Abrir a aplicação num tablet e repetir os testes 2, 4, 6 e 9 | Funciona com câmara frontal ou traseira e toque nos controlos | ☐ | |

## Estado dos testes (para preencher)

- Testes efetivamente realizados até agora: **nenhum** — a aplicação
  ainda não foi testada com câmara real. Este plano define os testes a
  executar.
- Testes apenas planeados: todos os acima.

## Problemas conhecidos da Fase 1

- Os sons são provisórios e sintetizados (ver
  `audio/LICENCA-E-FONTES.md`); a avaliação artística só faz sentido
  depois de serem substituídos por gravações reais.
- Objetos com cores pouco saturadas (por exemplo, pastéis ou tecidos
  escuros) podem não ser detetados; usar cores vivas.
- Roupas ou fundos com as cores alvo podem provocar falsos positivos;
  ajustar a sensibilidade ou o enquadramento.
