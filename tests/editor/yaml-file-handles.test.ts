import { describe, expect, it } from 'vitest';
import { readFileHandleText, writeTextToHandle } from '../../src/editor/yamlFileHandles';

describe('yamlFileHandles', () => {
  describe('readFileHandleText', () => {
    it('reads file contents + label from a file handle', async () => {
      const handle = {
        getFile: async () => new File(['hello'], 'picked.yaml', { type: 'application/x-yaml' }),
      };

      await expect(readFileHandleText(handle)).resolves.toEqual({ text: 'hello', label: 'picked.yaml' });
    });
  });

  describe('writeTextToHandle', () => {
    it('writes to a writable file handle', async () => {
      const writes: string[] = [];
      const handle = {
        createWritable: async () => ({
          write: async (text: string) => {
            writes.push(text);
          },
          close: async () => {},
        }),
      };

      await writeTextToHandle(handle, 'yaml');
      expect(writes).toEqual(['yaml']);
    });

    it('throws for non-writable handles', async () => {
      await expect(writeTextToHandle(null, 'x')).rejects.toThrow('File handle is not writable');
      await expect(writeTextToHandle({}, 'x')).rejects.toThrow('File handle is not writable');
    });
  });
});

