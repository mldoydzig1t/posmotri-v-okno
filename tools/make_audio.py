#!/usr/bin/env python3
"""Оригинальные фоновые треки для «Посмотри в окно».

Синтезируем мягкие эмбиент-подложки: пэды с медленным LFO, лёгкий шум,
редкие «колокольные» отзвуки. Никаких чужих записей — только математика.
"""
import os
import subprocess
import wave

import numpy as np

SR = 44100
DURATION = 48
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "audio")


def adsr(n, attack=0.25, release=0.6):
    env = np.ones(n)
    a = int(SR * attack)
    r = int(SR * release)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    return env


def pad(freq, n, detune=0.0, lfo=0.06, depth=0.004, phase=0.0):
    t = np.arange(n) / SR
    vib = 1 + depth * np.sin(2 * np.pi * lfo * t + phase)
    wave_ = np.sin(2 * np.pi * freq * vib * t + phase)
    if detune:
        wave_ += 0.6 * np.sin(2 * np.pi * (freq * (1 + detune)) * t + phase * 0.7)
    return wave_ / (1.6 if detune else 1.2)


def noise_bed(n, color="brown"):
    white = np.random.default_rng(7).normal(0, 1, n)
    if color == "brown":
        out = np.cumsum(white) / n * 12
    else:
        out = white
    out = out / (np.max(np.abs(out)) + 1e-9)
    t = np.arange(n) / SR
    out *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t)
    return out


def bell(freq, n, start, decay=2.4):
    t = np.arange(n) / SR
    env = np.exp(-decay * t)
    sig = np.sin(2 * np.pi * freq * t) * env
    sig += 0.35 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-decay * 1.6 * t)
    sig += 0.18 * np.sin(2 * np.pi * freq * 2.99 * t) * np.exp(-decay * 2.4 * t)
    out = np.zeros(n + start)
    out[start:] += sig
    return out


def mix(*layers):
    n = max(len(layer) for layer in layers)
    out = np.zeros(n)
    for layer in layers:
        out[: len(layer)] += layer
    return out


def build(name, chords, root_freq, noise_color="brown", bells=(), level=0.5):
    n = SR * DURATION
    parts = []
    for chord in chords:
        for freq in chord:
            parts.append(pad(freq, n, detune=0.0025, lfo=0.05 + 0.01 * len(parts), phase=len(parts)))
    bed = mix(*parts) / max(len(parts) ** 0.5, 1)
    bed *= adsr(n, 2.5, 4.0)

    rain = noise_bed(n, noise_color) * 0.12
    out = mix(bed * 0.5, rain)

    for freq, start, decay in bells:
        out = mix(out, bell(freq, SR * 6, int(start * SR), decay) * 0.22)

    peak = np.max(np.abs(out))
    if peak > 0:
        out = out / peak * level

    out = np.tanh(out * 1.2) / 1.05

    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as fh:
        fh.setnchannels(1)
        fh.setsampwidth(2)
        fh.setframerate(SR)
        fh.writeframes((out * 32767).astype("<i2").tobytes())
    return path


def main():
    os.makedirs(OUT, exist_ok=True)

    tracks = {
        "rassvet": (
            [[146.83, 220.00, 277.18, 329.63, 415.30],
             [130.81, 196.00, 246.94, 329.63, 493.88],
             [146.83, 220.00, 277.18, 369.99, 440.00]],
            146.83, "brown", [(880.0, 9.0, 2.6), (1174.7, 21.0, 2.2), (987.8, 33.0, 2.4)],
        ),
        "dozhd": (
            [[110.00, 164.81, 220.00, 261.63],
             [98.00, 146.83, 196.00, 246.94]],
            110.00, "pink", [(659.3, 14.0, 2.0), (523.3, 27.0, 2.2)],
        ),
        "nochnoy": (
            [[82.41, 123.47, 164.81, 246.94],
             [73.42, 110.00, 146.83, 220.00]],
            82.41, "brown", [(261.6, 11.0, 3.0), (392.0, 24.0, 2.8), (329.6, 37.0, 3.2)],
        ),
    }

    for name, (chords, root, color, bells) in tracks.items():
        wav = build(name, chords, root, color, bells)
        mp3 = wav.replace(".wav", ".mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "128k", mp3],
            check=True,
        )
        print(name, os.path.getsize(mp3) // 1024, "KB")


if __name__ == "__main__":
    main()
