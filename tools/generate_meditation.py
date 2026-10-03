"""Render the original meditation melody as a loopable offline PCM recording."""
from array import array
from pathlib import Path
import math
import sys
import wave

RATE = 16000
SECONDS = 72
MELODY = [0, 4, 7, 11, 7, 4, 2, 7, 9, 14, 9, 7, 4, 9, 11, 16, 11, 9, 2, 7, 4, 0, 4, 7]


def render(path):
    samples = [0.0] * (RATE * SECONDS)

    def note(semitone, start, length, level):
        frequency = 130.8128 * 2 ** (semitone / 12)
        for frame in range(int(length * RATE)):
            t = frame / RATE
            envelope = min(1.0, t / 0.4) * math.exp(-t / 2.5) * min(1.0, (length - t) / 0.3)
            value = (math.sin(2 * math.pi * frequency * t) + 0.12 * math.sin(4 * math.pi * frequency * t))
            samples[(int(start * RATE) + frame) % len(samples)] += level * envelope * value

    for i, pitch in enumerate(MELODY):
        note(pitch + 12, i * 3, 5.8, 0.38)
        if i % 4 == 0:
            root = [0, 2, 4, 0][(i // 4) % 4]
            for pitch in [root, root + 7, root + 12]:
                note(pitch, i * 3, 11.5, 0.09)
    pcm = array('h', [int(max(-0.95, min(0.95, value)) * 32767) for value in samples])
    if sys.byteorder != 'little':
        pcm.byteswap()
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as output:
        output.setparams((1, 2, RATE, len(pcm), 'NONE', 'not compressed'))
        output.writeframes(pcm.tobytes())


if __name__ == '__main__':
    render(Path(__file__).resolve().parents[1] / 'app/src/main/res/raw/meditation.wav')
