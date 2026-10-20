# Paisagens Sonoras

Instrumento musical interativo por webcam: objetos **vermelhos**,
**verdes**, **azuis**, **amarelos** e **pretos** colocados sobre uma
mesa ativam paisagens sonoras naturais — aves, água, vento, grilos e
trovoada distante. A posição vertical do objeto no
enquadramento controla a intensidade do som: no topo da imagem é mais
intenso; no fundo (perto de quem usa), mais suave.

- Vermelho → **aves**
- Verde → **água**
- Azul → **vento**
- Amarelo → **grilos**
- Preto → **trovoada distante**

A aplicação funciona inteiramente no navegador: o vídeo nunca é
enviado para nenhum servidor. Não requer instalação nem contas.

> **Estado:** protótipo funcional com gravações de campo reais
> licenciadas (Wikimedia Commons, CC/domínio público) — ver
> `audio/LICENCA-E-FONTES.md`.

## Estrutura do projeto

```
index.html            Página principal e interface
css/estilo.css        Estilo da interface
js/app.js             Orquestração: câmara, loop, botões, indicadores
js/deteccao.js        Deteção de cores em espaço HSV (com histerese)
js/audio.js           Motor Web Audio (loops com fades suaves)
audio/aves.wav        Canto de aves — gravação real CC BY-SA 4.0
audio/agua.wav        Água a correr — gravação real, domínio público
audio/vento.wav       Vento em floresta — gravação real CC BY 4.0
audio/grilos.wav      Grilo-arborícola — gravação real CC BY-SA 4.0
audio/trovoada.wav    Trovoada — gravação real CC BY-SA 4.0
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

- **Mesa forrada com papel branco** (ou uma parede branca como fundo).
  O branco é ignorado pela deteção e evita disparos indesejados de
  fundo — é a configuração recomendada.
- Objetos com cores vivas e saturadas: tampas de garrafa, cartolina,
  blocos de brincar. Evita objetos escuros, com estampas ou reflexivos.
- Boa iluminação frontal, sem sombras fortes sobre a mesa.

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

A lógica de deteção e do motor de áudio tem testes que correm sem
navegador:

```bash
node ferramentas/teste-deteccao.mjs
node ferramentas/teste-audio.mjs
```

Os de deteção cobrem a classificação das cores nas gamas certas,
rejeição de cores pouco saturadas e de tons de pele, tempos de
ativação/desativação da histerese, posição vertical e intensidade.
Os de áudio cobrem os fluxos do motor (com Web Audio simulada):
iniciar, ouvir antes de iniciar, substituição de sons a quente,
parar/reiniciar a manter sons substituídos e falhas de carregamento.

## Ouvir sons e carregar sons personalizados

Cada elemento no painel tem dois botões:

- **Ouvir**: toca o som desse elemento uma vez, para avaliar sem
  precisar de ativar a deteção.
- **Trocar som**: substitui o som desse elemento por um ficheiro do
  teu computador (MP3, WAV, OGG…). A substituição vale para a sessão
  atual do navegador; ao recarregar a página voltam os sons incluídos.
  A responsabilidade de licença dos sons carregados é de quem os
  carrega.

## Notas técnicas resumidas

- **Deteção:** conversão de cada frame (reduzido a ~160 px de largura)
  para o espaço HSV; os píxeis são classificados por matiz (hue) com
  limiares mínimos de saturação. O HSV é mais robusto a variações de
  iluminação do que limiares RGB diretos.
- **Estabilidade:** histerese (ligar exige 3 frames consecutivos,
  desligar exige 8) e suavização exponencial da intensidade, evitando
  ativações/desativações repetidas com pequenos movimentos.
- **Áudio:** cinco loops contínuos com `GainNode` e `StereoPanner`;
  presença/posição apenas ajustam ganho e pan com transições
  exponenciais — o loop nunca reinicia quando o objeto se move. A
  posição horizontal do objeto move o som no estéreo; a vertical
  controla a intensidade. Um `DynamicsCompressor` na saída evita
  picos e distorção quando várias paisagens tocam em simultâneo, e
  cada canal está limitado a 75% do ganho máximo.
- **Privacidade:** todo o processamento é local; nenhum vídeo sai do
  dispositivo.

## Roadmap

- **Fase 2:** refinar limiares de cor; melhorar interface e acessibilidade;
  melhorar as gravações de campo (seleção alternativa, maior duração).
- **Fase 3:** executar o plano em `TESTES.md` com professores.
- **Fase 4:** publicar e partilhar URL.
- **Fase 5:** mais cores, filtros, pan, modos alternativos, atividades
  pedagógicas.
