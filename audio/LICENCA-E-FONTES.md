# Ficheiros de áudio — estado atual e licenças

## Estado atual: PROVISÓRIO (sintetizado)

Os três ficheiros incluídos nesta versão do protótipo **não são gravações
de campo reais**. Foram sintetizados por computador (ruído filtrado e
varreduras de frequência) para permitir desenvolver e testar o
instrumento antes de existirem gravações finais. Não devem ser
apresentados como gravações reais da natureza.

| Ficheiro     | Elemento | Conteúdo provisório                  | Duração | Formato       |
|--------------|----------|--------------------------------------|---------|---------------|
| aves.wav     | Vermelho | Chilreios sintéticos sobre leito de ruído suave | 9 s | WAV mono 16-bit 44,1 kHz |
| agua.wav     | Verde    | Ruído filtrado modulado com "gotas" sintéticas | 9 s | WAV mono 16-bit 44,1 kHz |
| vento.wav    | Azul     | Ruído grave com rajadas lentas sintéticas | 9 s | WAV mono 16-bit 44,1 kHz |
| grilos.wav   | Amarelo  | Pulsos rítmicos agudos sintéticos (provisório) | 9 s | WAV mono 16-bit 44,1 kHz |
| trovoada.wav  | Preto    | Rumores graves lentos sintéticos (provisório) | 9 s | WAV mono 16-bit 44,1 kHz |

Os ficheiros foram gerados pelo script `ferramentas/gerar_audios.py`,
incluído no projeto, e podem ser regenerados em qualquer altura.
Como são obra sintética criada para o projeto, não têm restrições de
licença de terceiros, mas **não representam sons da natureza**.

## Objetivo para a Fase 2: gravações de campo licenciadas

A versão final deve substituir estes ficheiros por gravações de campo
reais, mantendo os mesmos nomes (`aves.wav`, `agua.wav`, `vento.wav`)
e aproximando a duração de 8 a 15 segundos, com início e fim adequados
a reprodução em ciclo contínuo.

Critérios para cada gravação escolhida:

- **Nome e descrição** clara do conteúdo.
- **Fonte original** (sítio, coleção ou autor).
- **Autor**, quando aplicável.
- **Licença** que permita expressamente:
  - redistribuição do ficheiro dentro da aplicação;
  - utilização pública e gratuita da aplicação;
  - idealmente, modificação (para edição, fades, normalização).
- **Atribuição**: verificar se a licença exige crédito e, se sim,
  acrescentá-lo a este ficheiro e à interface.
- **Formato e edição**: WAV ou MP3; provavelmente será preciso aplicar
  fade in/out curto nas extremidades para evitar "clics" no loop.

Boas fontes prováveis (verificar sempre a licença de cada ficheiro à
data da utilização): Freesound (ficheiros Creative Commons, filtrar por
licença), Xeno-canto (gravações de aves, várias licenças CC) e o
arquivo da BBC ou outros arquivos de sons da natureza. **Nenhuma fonte
deve ser assumida sem confirmar a licença do ficheiro específico.**

Se uma gravação escolhida não permitir redistribuição, mas apenas
utilização por ligação, fica fora dos critérios deste projeto: os sons
têm de acompanhar a aplicação.
