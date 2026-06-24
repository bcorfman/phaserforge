import express from 'express';
import { z } from 'zod';

import type { Settings } from '../../settings';
import { newId } from '../../security/ids';
import { requireAuth, type AuthedRequest } from '../auth/sessionAuth';
import type { Repositories } from '../types';

const UploadAssetSchema = z.object({
  dataUrl: z.string().min(1),
  originalName: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().trim().min(1).max(255).optional(),
});

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string | null } | null {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mimeType = typeof match[1] === 'string' && match[1].trim().length > 0 ? match[1].trim() : null;
  const payload = match[2] ?? '';
  try {
    return { bytes: new Uint8Array(Buffer.from(payload, 'base64')), mimeType };
  } catch {
    return null;
  }
}

export function assetsRouter(settings: Settings, repositories: Repositories) {
  const router = express.Router();
  router.use(requireAuth(settings, repositories));

  router.post('/', async (req, res) => {
    const parsed = UploadAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const decoded = decodeDataUrl(parsed.data.dataUrl);
    if (!decoded) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const userId = (req as AuthedRequest).userId;
    const now = new Date().toISOString();
    const assetId = newId('asset');
    const originalName = parsed.data.originalName?.trim() || null;
    const mimeType = parsed.data.mimeType?.trim() || decoded.mimeType;
    await repositories.assets.create({
      id: assetId,
      userId,
      bytes: decoded.bytes,
      mimeType,
      originalName,
      createdAt: now,
    });
    res.status(201).json({
      asset: {
        kind: 'cloud',
        assetId,
        ...(originalName ? { originalName } : {}),
        ...(mimeType ? { mimeType } : {}),
      },
    });
  });

  router.get('/:id/content', async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const asset = await repositories.assets.findByIdForUser(req.params.id, userId);
    if (!asset) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.setHeader('content-type', asset.mimeType || 'application/octet-stream');
    res.send(Buffer.from(asset.bytes));
  });

  return router;
}
