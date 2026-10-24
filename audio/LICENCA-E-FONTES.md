# Ficheiros de áudio — fontes e licenças

## Versão atual: gravações de campo reais, licenciadas

Os cinco sons do instrumento são **gravações de campo reais** obtidas
do Wikimedia Commons, com licenças que permitem a redistribuição
dentro desta aplicação pública. Cada ficheiro foi editado (trecho de
~10 s, conversão para WAV mono 44,1 kHz 16-bit, normalização
loudnorm −20 LUFS, fades de 0,5 s nas extremidades para reprodução
em ciclo contínuo sem cortes audíveis). O `vento.wav` foi adicionalmente
reeditado (2026-10-24): o fade final provocava um silêncio audível a
cada volta do loop; foi usado o trecho 0,35–9,55 s e criada uma
emenda de loop com crossfade equal-power de 60 ms + micro-fade de
2 ms nos extremos — ciclo contínuo sem silêncio nem cliques.

| Ficheiro       | Elemento     | Conteúdo                        | Autor / Fonte | Licença | Atribuição necessária |
|----------------|--------------|---------------------------------|--------------|---------|-----------------------|
| aves.wav       | Vermelho — Aves | Canto de aves ao amanhecer, Bourne Woods (Reino Unido) | Robert EA Harvey, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Birdsong_Bourne_Woods_2020-04-27_0722.mp3) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Sim: crédito ao autor + link da licença |
| agua.wav       | Verde — Água | Água a correr, a verter e escorrer | stephan, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Water_flowing_pouring_trickling.ogg) | Domínio público | Não |
| vento.wav      | Azul — Vento | Vento em floresta | Gravity Sound, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Wind_in_forest_(Gravity_Sound).wav) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | Sim: crédito ao autor + link da licença |
| grilos.wav     | Amarelo — Grilos | Grilo-arborícola (Oecanthus pellucens) | Olivier Grimm, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Oecanthus_pellucens_-_Tree_Cricket_XC558882.mp3) (original: Xeno-canto XC558882) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Sim: crédito ao autor + link da licença |
| trovoada.wav   | Preto — Trovoada | Trovoada | Amuzujoe, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Thunder_01.ogg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Sim: crédito ao autor + link da licença |
| mosca.wav      | Laranja — Mosca | Zumbido de inseto (abelha em voo) | Free Sounds Library (Spanac), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bee_buzzing_sound_(animal_noises).opus) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) | Sim: crédito ao autor + link da licença |
| chuva.wav      | Castanho — Chuva | Chuva | via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rain.ogg) | Domínio público (PD-self) | Não |
| cao.wav        | Roxo — Cão | Latidos de cão (Canis lupus familiaris) | Amada44, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Barking_of_a_dog.ogg e [File:Barking_of_a_dog_2.ogg](https://commons.wikimedia.org/wiki/File:Barking_of_a_dog_2.ogg)) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | Sim: crédito ao autor + link da licença |

## Cumprimento das licenças

As licenças Creative Commons acima **exigem atribuição** (crédito ao
autor e indicação da licença, com link quando razoável) e, no caso
das CC BY-SA, partilha da obra derivada (o trecho editado) **pela
mesma licença**. Este ficheiro — incluído na aplicação e no
repositório — serve de atribuição central. Os links de cada ficheiro
estão na tabela; cada página original do Commons contém também o
histórico completo de autores e a licença exata.

- Os trechos editados (fades, normalização, recorte) são obras
  derivadas dos originais e seguem a licença do respetivo original.
- A aplicação em si não está limitada por estas licenças de som:
  apenas os ficheiros de áudio e as suas derivadas.

## Histórico

Antes desta versão, o protótipo usava cinco sons provisórios
sintetizados por computador (gerados por `ferramentas/gerar_audios.py`),
claramente identificados como não sendo gravações reais. Foram
substituídos pelas gravações reais acima. O script gerador mantém-se
no repositório apenas como referência; já não é utilizado pela
aplicação.
