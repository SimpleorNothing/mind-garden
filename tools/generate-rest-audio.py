"""Render original piano and synthesized nature soundscapes; no external recordings."""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
RATE, SECONDS = 22050, 48
SIZE = RATE * SECONDS
rng = np.random.default_rng(470)

def add_note(out, at, semitone, level=0.23, duration=5):
    t = np.arange(int(RATE * duration)) / RATE
    f = 261.625565 * 2 ** (semitone / 12)
    attack = np.minimum(t / 0.025, 1)
    tail = np.minimum((duration - t) / 0.4, 1)
    sound = sum((0.6 ** (h - 1)) * np.exp(-t * (0.65 + h * 0.18)) * np.sin(2 * np.pi * f * h * t) for h in range(1, 6))
    np.add.at(out, (int(at * RATE) + np.arange(len(t))) % SIZE, level * attack * tail * sound)

def piano():
    out = np.zeros(SIZE)
    melody = [0, 4, 7, 12, 11, 7, 2, 5, 9, 14, 12, 9, 4, 7, 11, 16, 14, 11, 2, 7, 4, 0, 7, 4]
    for i, tone in enumerate(melody):
        add_note(out, i * 2, tone)
        if i % 4 == 0:
            for tone in [0, 7, 12]: add_note(out, i * 2, tone - 12, 0.06, 7)
    return out

def filtered_noise(low, high):
    extended = rng.normal(0, 1, SIZE + RATE * 2)
    audio = sosfilt(butter(2, [low, high], btype='bandpass', fs=RATE, output='sos'), extended)[-SIZE:]
    # Join independent noise seamlessly with a wrap crossfade.
    fade = RATE
    weights = np.linspace(0, 1, fade)
    audio[:fade] = audio[-fade:] * (1 - weights) + audio[:fade] * weights
    return audio / max(float(np.std(audio)), 0.001)

base = piano()
forest = base * 0.42
clock = np.arange(SIZE) / RATE
forest += filtered_noise(120, 1300) * (0.018 + 0.007 * np.sin(2 * np.pi * clock / 16))
for at in [3, 9.5, 17, 28, 35.5, 43]:
    t = np.arange(int(RATE * 0.65)) / RATE
    env = np.sin(np.pi * t / 0.65) ** 2
    phase = 2 * np.pi * (1900 * t + 300 * t * t + 55 / (2 * np.pi * 8) * np.sin(2 * np.pi * 8 * t))
    chirp = 0.075 * env * np.sin(phase)
    i = int(at * RATE); forest[i:i + len(t)] += chirp
rain = base * 0.3
rain += filtered_noise(350, 6500) * (0.05 + 0.005 * np.sin(2 * np.pi * clock / 24))
for at in rng.uniform(0, SECONDS - 0.1, 250):
    t = np.arange(int(RATE * 0.07)) / RATE
    drop = 0.018 * np.exp(-t * 65) * np.sin(2 * np.pi * rng.uniform(1400, 3300) * t)
    i = int(at * RATE); rain[i:i + len(t)] += drop
for name, audio in [('piano', base), ('forest', forest), ('rain', rain)]:
    audio *= min(1, 0.65 / max(float(abs(audio).max()), 0.001))
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / 'sound.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            w.writeframes((audio * 32767).astype('<i2').tobytes())
        destination = ROOT / 'app/src/main/res/raw' / (name + '.ogg')
        destination.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libvorbis', '-q:a', '2', str(destination)], check=True)
        web_path = ROOT / 'web/audio' / destination.name
        web_path.parent.mkdir(parents=True, exist_ok=True)
        web_path.write_bytes(destination.read_bytes())
        print(name, 'peak', round(float(abs(audio).max()), 3), 'rms', round(float(np.sqrt(np.mean(audio**2))), 3))
# Retain the existing melody for browser playback as well.
(ROOT / 'web/audio/meditation.ogg').write_bytes((ROOT / 'app/src/main/res/raw/meditation.ogg').read_bytes())
