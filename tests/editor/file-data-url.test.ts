import { describe, expect, it } from 'vitest';
import { fileToDataUrl } from '../../src/editor/fileDataUrl';

describe('fileToDataUrl', () => {
  it('encodes binary file contents into a data URL', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'tiny.png', { type: 'image/png' });

    await expect(fileToDataUrl(file)).resolves.toBe('data:image/png;base64,iVBORw==');
  });

  it('falls back to octet-stream when the mime type is empty', async () => {
    const file = new File([new Uint8Array([0x61, 0x62, 0x63])], 'plain.bin');

    await expect(fileToDataUrl(file)).resolves.toBe('data:application/octet-stream;base64,YWJj');
  });
});
