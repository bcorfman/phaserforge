import type { Route } from '@playwright/test';

export function makeTestWavBuffer(options?: { amplitude?: number; durationSeconds?: number }): Buffer {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.floor(sampleRate * (options?.durationSeconds ?? 1)));
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  const amplitude = Math.max(0, Math.min(32767, Math.floor(options?.amplitude ?? 0)));

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = amplitude === 0
      ? 0
      : Math.round(Math.sin((2 * Math.PI * 220 * index) / sampleRate) * amplitude);
    buffer.writeInt16LE(sample, 44 + index * bytesPerSample);
  }

  return buffer;
}

export async function fulfillRouteWithTestWav(route: Route, options?: { amplitude?: number; delayMs?: number; durationSeconds?: number }): Promise<void> {
  if (options?.delayMs) {
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
  }
  await route.fulfill({
    status: 200,
    contentType: 'audio/wav',
    body: makeTestWavBuffer(options),
  });
}
