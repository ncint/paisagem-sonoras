#!/usr/bin/env python3
"""Gera os três ficheiros de áudio PROVISÓRIOS (sintetizados) do protótipo.

Estes sons NÃO são gravações de campo reais. São texturas sintéticas
criadas apenas para permitir o desenvolvimento e teste do instrumento.
Na Fase 2 devem ser substituídos por gravações de campo devidamente
licenciadas (ver ../audio/LICENCA-E-FONTES.md).

Uso:  python3 gerar_audios.py
Requer: numpy
"""

import numpy as np
import wave
import os
import random

SR = 44100
PASTA = os.path.join(os.path.dirname(__file__), "..", "audio")


def salvar(nome, dados, duracao):
    # Normaliza e converte para WAV de 16 bits
    pico = np.max(np.abs(dados))
    if pico > 0:
        dados = dados / pico * 0.85
    pcm = (dados * 32767).astype(np.int16)
    caminho = os.path.join(PASTA, nome)
    if os.path.exists(caminho) and os.environ.get("SOBRESCREVER") != "1":
        print(f"{nome}: JÁ EXISTE — mantido (usa SOBRESCREVER=1 para substituir)")
        return
    with wave.open(caminho, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    print(f"{nome}: {duracao:.1f} s, {os.path.getsize(caminho) / 1024:.0f} KiB")


def canto_ave(f0, f1, dur):
    """Um chilreio: varredura de frequência com envelope percussivo."""
    n = int(dur * SR)
    tt = np.linspace(0, dur, n, endpoint=False)
    freq = f0 + (f1 - f0) * (tt / dur) ** 2
    fase = 2 * np.pi * np.cumsum(freq) / SR
    env = np.sin(np.pi * tt / dur) ** 2
    return np.sin(fase) * env


def gerar_aves(duracao=9.0):
    """Ambiente de jardim: chilreios dispersos sobre um leito suave."""
    n = int(duracao * SR)
    saida = np.zeros(n)
    random.seed(11)

    # Leito suave (rumor de folhagem muito discreto)
    leito = np.random.default_rng(7).normal(0, 1, n)
    kernel = np.ones(220) / 220
    leito = np.convolve(leito, kernel, mode="same") * 0.012

    # Chilreios aleatórios
    tempo = 0.0
    while tempo < duracao - 1.0:
        f0 = random.uniform(2400, 3800)
        f1 = f0 * random.choice([0.55, 0.7, 1.35, 1.6])
        dur = random.uniform(0.06, 0.18)
        s = canto_ave(f0, f1, dur)
        i0 = int(tempo * SR)
        i1 = min(i0 + len(s), n)
        ganho = random.uniform(0.25, 0.6)
        saida[i0:i1] += s[: i1 - i0] * ganho
        # ligeiro eco para dar espaço
        eco_at = min(i1 + int(0.09 * SR), n)
        comp = min(i1 - i0, n - eco_at)
        saida[eco_at : eco_at + comp] += s[:comp] * ganho * 0.25
        tempo += random.uniform(0.15, 0.9)

    return leito + saida, duracao


def gerar_agua(duracao=9.0):
    """Água corrente: ruído filtrado com modulações + gotas."""
    n = int(duracao * SR)
    rng = np.random.default_rng(3)
    ruido = rng.normal(0, 1, n)

    # Filtro passa-banda aproximado (média móvel dupla com degrau)
    k1 = np.ones(40) / 40
    k2 = np.ones(400) / 400
    base = np.convolve(ruido, k1, mode="same") - np.convolve(ruido, k2, mode="same")

    # Modulação de amplitude lenta (fluxo irregular)
    t = np.arange(n) / SR
    mod = 0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t + 1.3) * np.sin(2 * np.pi * 0.23 * t)
    agua = base * mod * 0.5

    # Gotas: plinks curtos com pitch descendente
    random.seed(5)
    tempo = 0.2
    while tempo < duracao - 0.5:
        f0 = random.uniform(900, 2200)
        dur = random.uniform(0.02, 0.05)
        nn = int(dur * SR)
        tt = np.linspace(0, dur, nn, endpoint=False)
        freq = f0 * (1 - 0.4 * tt / dur)
        fase = 2 * np.pi * np.cumsum(freq) / SR
        env = np.exp(-tt * 90)
        gota = np.sin(fase) * env * random.uniform(0.3, 0.8)
        i0 = int(tempo * SR)
        i1 = min(i0 + nn, n)
        agua[i0:i1] += gota[: i1 - i0]
        tempo += random.uniform(0.25, 1.4)

    return agua, duracao


def gerar_vento(duracao=9.0):
    """Vento: ruído grave com rajadas lentas e estáticas."""
    n = int(duracao * SR)
    rng = np.random.default_rng(9)
    ruido = rng.normal(0, 1, n)

    # Filtro passa-baixo simples (média móvel longa)
    kernel = np.ones(600) / 600
    base = np.convolve(ruido, kernel, mode="same")

    # Rajadas: soma de senos de baixa frequência
    t = np.arange(n) / SR
    rajada = (
        0.45
        + 0.35 * np.sin(2 * np.pi * 0.11 * t)
        + 0.25 * np.sin(2 * np.pi * 0.043 * t + 2.0)
        + 0.15 * np.sin(2 * np.pi * 0.27 * t + 0.7)
    )
    rajada = np.clip(rajada, 0.05, 1.2)

    return base * rajada * 3.0, duracao


def gerar_grilos(duracao=9.0):
    """Grilos: pulsos rítmicos agudos com batimentos diferentes."""
    n = int(duracao * SR)
    saida = np.zeros(n)
    rng = np.random.default_rng(21)

    # Três "grilos" com ritmos e frequências diferentes
    cantores = [
        (4200, 18, 0.6),   # (freq, pulsos/s, ganho)
        (5100, 24, 0.45),
        (3600, 12, 0.5),
    ]
    t = np.arange(n) / SR
    for f0, taxa, ganho in cantores:
        fase_pulso = (t * taxa) % 1.0
        env_pulso = np.exp(-fase_pulso * 22) * (fase_pulso < 0.35)
        # ligeiro tremor na frequência para soar menos mecânico
        fmod = f0 * (1 + 0.01 * np.sin(2 * np.pi * 3.1 * t + rng.uniform(0, 6)))
        fase = 2 * np.pi * np.cumsum(fmod) / SR
        # modulação de amplitude lenta (presença/ausência do grilo)
        presenca = 0.55 + 0.45 * np.sin(2 * np.pi * 0.09 * t + rng.uniform(0, 6))
        presenca = np.clip(presenca, 0, 1)
        saida += np.sin(fase) * env_pulso * ganho * presenca

    # Leito discreto de rumor noturno
    leito = rng.normal(0, 1, n)
    kernel = np.ones(180) / 180
    saida += np.convolve(leito, kernel, mode="same") * 0.008
    return saida, duracao


def gerar_trovoada(duracao=9.0):
    """Trovoada distante: rumores graves lentos sobre rumored contínuo."""
    n = int(duracao * SR)
    rng = np.random.default_rng(33)
    ruido = rng.normal(0, 1, n)
    kernel = np.ones(900) / 900
    base = np.convolve(ruido, kernel, mode="same") * 0.35

    # Duas vagas de trovão (envelope lento) em momentos fixos
    t = np.arange(n) / SR
    def vaga(t0, dur, ganho):
        env = np.zeros_like(t)
        m = (t >= t0) & (t < t0 + dur)
        tt = (t[m] - t0) / dur
        env[m] = np.sin(np.pi * tt) ** 2 * np.exp(-tt * 1.2) * ganho
        return env
    saida = base + ruido * 0.0  # placeholder para clareza
    saida = base.copy()
    saida += base * vaga(1.2, 2.6, 3.5)
    saida += base * vaga(5.4, 2.2, 2.8)
    return saida, duracao


def gerar_galo(duracao=9.0):
    """Galo: cucurucus dispersos (varredura descendente com vibrato)."""
    n = int(duracao * SR)
    saida = np.zeros(n)
    random.seed(41)

    def cucurucu(t0):
        dur = 0.7
        m = int(dur * SR)
        tt = np.linspace(0, dur, m, endpoint=False)
        # Quatro sílabas descendentes (go-go-go-gó)
        f0 = 700.0
        freq = np.where(
            tt < 0.12, 720,
            np.where(tt < 0.24, 660,
                     np.where(tt < 0.36, 600, 520 - 80 * (tt - 0.36) / 0.34)))
        vibrato = 1 + 0.04 * np.sin(2 * np.pi * 28 * tt)
        fase = 2 * np.pi * np.cumsum(freq * vibrato) / SR
        env = np.sin(np.pi * np.minimum(tt / 0.05, 1)) ** 2
        env *= np.exp(-tt * 1.1)
        i0 = int(t0 * SR)
        saida[i0:i0 + m] += np.sin(fase) * env * 0.8
        # segunda harmónica para timbre metálico
        saida[i0:i0 + m] += np.sin(2 * fase) * env * 0.25

    for t0 in [0.3, 2.2, 4.6, 7.3]:
        cucurucu(t0)
    return saida, duracao


def gerar_chuva(duracao=9.0):
    """Chuva contínua: rumor rosa suave com pingos dispersos."""
    n = int(duracao * SR)
    rng = np.random.default_rng(43)
    # rumor: ruído filtrado (média móvel longa = graves suaves)
    ruido = rng.normal(0, 1, n)
    kernel = np.ones(320) / 320
    base = np.convolve(ruido, kernel, mode="same") * 0.25
    # agudos: ruído quase cru, atenuado
    base += ruido * 0.045
    # pingos: impulsos curtos aleatórios
    saida = base
    for _ in range(90):
        t0 = rng.uniform(0, duracao - 0.02)
        m = int(0.02 * SR)
        tt = np.linspace(0, 0.02, m, endpoint=False)
        pingo = np.sin(2 * np.pi * rng.uniform(1800, 3600) * tt) * np.exp(-tt * 400)
        i0 = int(t0 * SR)
        saida[i0:i0 + m] += pingo * rng.uniform(0.05, 0.15)
    return saida, duracao


def gerar_cao(duracao=9.0):
    """Cão: latidos dispersos (formantes graves com ataque rápido)."""
    n = int(duracao * SR)
    saida = np.zeros(n)
    random.seed(47)

    def latido(t0, f0=320.0):
        dur = 0.28
        m = int(dur * SR)
        tt = np.linspace(0, dur, m, endpoint=False)
        vibrato = 1 + 0.12 * np.sin(2 * np.pi * 22 * tt)
        fase = 2 * np.pi * np.cumsum(f0 * vibrato * np.exp(-tt * 2)) / SR
        env = np.sin(np.pi * np.minimum(tt / 0.015, 1)) ** 2
        env *= np.exp(-tt * 5)
        i0 = int(t0 * SR)
        saida[i0:i0 + m] += (np.sin(fase) + 0.5 * np.sin(2 * fase) + 0.3 * np.sin(3 * fase)) * env * 0.9

    # pares de latidos com pausas
    for t0 in [0.4, 0.75, 2.8, 3.15, 5.5, 5.85, 7.6, 7.95]:
        latido(t0, 300 + random.uniform(0, 50))
    return saida, duracao


if __name__ == "__main__":
    os.makedirs(PASTA, exist_ok=True)
    for nome, (dados, dur) in [
        ("aves.wav", gerar_aves()),
        ("agua.wav", gerar_agua()),
        ("vento.wav", gerar_vento()),
        ("grilos.wav", gerar_grilos()),
        ("trovoada.wav", gerar_trovoada()),
        ("galo.wav", gerar_galo()),
        ("chuva.wav", gerar_chuva()),
        ("cao.wav", gerar_cao()),
    ]:
        salvar(nome, dados, dur)
    print("Concluído.")
