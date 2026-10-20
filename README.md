# Paisagens Sonoras

Instrumento musical interativo por webcam: objetos **vermelhos**,
**verdes** e **azuis** colocados sobre uma mesa ativam paisagens
sonoras naturais — aves, água e vento. A posição vertical do objeto no
enquadramento controla a intensidade do som: no topo da imagem é mais
intenso; no fundo (perto de quem usa), mais suave.

- Vermelho → **aves**
- Verde → **água**
- Azul → **vento**

A aplicação funciona inteiramente no navegador: o vídeo nunca é
enviado para nenhum servidor. Não requer instalação nem contas.

> **Estado:** protótipo da Fase 1, funcional mas ainda não publicado.
> Os sons incluídos são **provisórios e sintetizados** — ver
> `audio/LICENCA-E-FONTES.md`.

## Estrutura do projeto

```
index.html            Página principal e interface
css/estilo.css        Estilo da interface
js/app.js             Orquestração: câmara, loop, botões, indicadores
js/deteccao.js        Deteção de cores em espaço HSV (com histerese)
js/audio.js           Motor Web Audio (loops com fades suaves)
audio/aves.wav        Som de aves (provisório, sintetizado)
audio/agua.wav        Som de água (provisório, sintetizado)
audio/vento.wav       Som de vento (provisório, sintetizado)
audio/LICENCA-E-FONTES.md   Estado e critérios de licenciamento dos sons
ferramentas/gerar_audios.py  Script que regenera os sons provisórios
ferramentas/teste-deteccao.mjs  Testes automatizados da lógica de deteção
TESTES.md             Plano de testes para pessoas sem conhecimentos de programação
```

## Como testar localmente

A câmara **não funciona** se abrires o `index.html` diretamente
(protocolo `file://`). É preciso servir a pasta por HTTPS ou
localhost. A forma mais simples, sem instalar nada (requer Node.js):

```bash
cd paisagens-sonoras
npx serve .
```

Abre depois o endereço que aparecer (normalmente
`http://localhost:3000`), autoriza a câmara e experimenta com objetos
coloridos.

Alternativa com Python 3:

```bash
cd paisagens-sonoras
python3 -m http.server 8000
```

Depois abre `http://localhost:8000`.

### Material sugerido para os testes

Objetos com cores vivas e saturadas: tampas de garrafa, cartolina,
blocos de brincar, legos. Evita objetos escuros, com estampas ou
reflexivos. Boa iluminação frontal, sem sombras fortes sobre a mesa.

## Publicação (GitHub Pages)

O objetivo é um URL público que os professores possam abrir sem
instalar nada. Para um repositório no GitHub:

1. Cria um repositório (público) no GitHub, por exemplo
   `utilizador/paisagens-sonoras`.
2. Sobe os ficheiros do projeto (o conteúdo desta pasta, incluindo a
   pasta `audio/`):

   ```bash
   git init
   git add .
   git commit -m "Paisagens Sonoras — Fase 1"
   git branch -M main
   git remote add origin https://github.com/utilizador/paisagens-sonoras.git
   git push -u origin main
   ```

3. No GitHub: **Settings → Pages → Build and deployment → Source:
   Deploy from a branch**; escolhe o ramo `main` e a pasta `/ (root)`.
4. Passados 1-2 minutos, a aplicação fica em
   `https://utilizador.github.io/paisagens-sonoras/`.

O GitHub Pages serve por HTTPS automaticamente, o que é exigido pelo
acesso à câmara. Alternativas equivalentes: Netlify Drop (arrastar a
pasta para netlify.com/drop) e Cloudflare Pages.

## Testes automatizados

A lógica de deteção tem testes que correm sem navegador:

```bash
node ferramentas/teste-deteccao.mjs
```

Cobrem a classificação das cores nas gamas certas, rejeição de cores
pouco saturadas, tempos de ativação/desativação da histerese,
posição vertical média e intensidade resultante.

## Notas técnicas resumidas

- **Deteção:** conversão de cada frame (reduzido a ~160 px de largura)
  para o espaço HSV; os píxeis são classificados por matiz (hue) com
  limiares mínimos de saturação. O HSV é mais robusto a variações de
  iluminação do que limiares RGB diretos.
- **Estabilidade:** histerese (ligar exige 3 frames consecutivos,
  desligar exige 8) e suavização exponencial da intensidade, evitando
  ativações/desativações repetidas com pequenos movimentos.
- **Áudio:** três loops contínuos com `GainNode`; presença/posição
  apenas ajustam o ganho com transições exponenciais — o loop nunca
  reinicia quando o objeto se move, evitando cortes.
- **Privacidade:** todo o processamento é local; nenhum vídeo sai do
  dispositivo.

## Roadmap

- **Fase 2:** substituir os sons provisórios por gravações de campo
  licenciadas; refinar limiares de cor; melhorar interface e acessibilidade.
- **Fase 3:** executar o plano em `TESTES.md` com professores.
- **Fase 4:** publicar e partilhar URL.
- **Fase 5:** mais cores, filtros, pan, modos alternativos, atividades
  pedagógicas.
