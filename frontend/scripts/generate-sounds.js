const fs = require('fs');
const path = require('path');

function writeWav(filename, freq = 440, durationSec = 0.4) {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, (numSamples - i) / (sampleRate * 0.15));
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.25 * envelope * 32767;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
}

const dir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(dir, { recursive: true });

writeWav(path.join(dir, 'bell.wav'), 523, 0.45);
writeWav(path.join(dir, 'chime.wav'), 659, 0.35);
writeWav(path.join(dir, 'marimba.wav'), 440, 0.4);
writeWav(path.join(dir, 'piano.wav'), 392, 0.5);

console.log('Generated alarm sounds in', dir);