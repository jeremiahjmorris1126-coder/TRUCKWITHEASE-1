import { CallerIdentity } from '../data/fleetStore';
import { createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

export interface SignedUploadUrlResult {
  uploadUrl: string;
  objectPath: string;
  downloadUrl: string;
  expiresAt: string;
  fields?: Record<string, string>;
  isPrivateBucket: boolean;
}

const SIGNED_URL_SECRET = process.env.SIGNED_URL_SECRET || 'twe_private_storage_hmac_secret_2026';
const UPLOAD_EXPIRY_SECONDS = 900; // 15 minutes short-lived

// In-memory store for pending private uploads in development
const pendingPrivateUploads = new Map<string, {
  token: string;
  fleetId: string;
  driverId: string;
  objectPath: string;
  contentType: string;
  expiresAt: number;
}>();

export class SignedUploadService {
  /**
   * Generates a short-lived (15-minute) signed upload URL for a private storage bucket.
   * Path is scoped strictly by fleetId and driverId: fleet_<fleetId>/driver_<driverId>/private/<fileName>
   */
  async generateUploadUrl(
    caller: CallerIdentity,
    options: {
      fileName: string;
      contentType: string;
      documentType?: string;
    }
  ): Promise<SignedUploadUrlResult> {
    if (!caller || !caller.fleetId) {
      const err = new Error('Fleet authentication required to generate signed upload URLs.');
      (err as any).statusCode = 401;
      throw err;
    }

    const rawFileName = options.fileName || `doc_${Date.now()}.png`;
    const sanitizedFileName = path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const contentType = options.contentType || 'image/jpeg';
    const documentType = options.documentType || 'document';

    // Scoped path inside private bucket
    const objectPath = `private/fleet_${caller.fleetId}/driver_${caller.uid}/${documentType}/${Date.now()}_${sanitizedFileName}`;

    const expiresAtMs = Date.now() + UPLOAD_EXPIRY_SECONDS * 1000;
    const expiresAtIso = new Date(expiresAtMs).toISOString();

    // 1. Generate secure HMAC signature token
    const tokenPayload = `${caller.fleetId}:${caller.uid}:${objectPath}:${expiresAtMs}`;
    const token = createHmac('sha256', SIGNED_URL_SECRET).update(tokenPayload).digest('hex') + randomBytes(8).toString('hex');

    pendingPrivateUploads.set(token, {
      token,
      fleetId: caller.fleetId,
      driverId: caller.uid,
      objectPath,
      contentType,
      expiresAt: expiresAtMs,
    });

    // Cleanup expired tokens
    const now = Date.now();
    for (const [k, v] of pendingPrivateUploads.entries()) {
      if (v.expiresAt < now) pendingPrivateUploads.delete(k);
    }

    const uploadUrl = `/api/storage/upload/${token}`;
    const downloadUrl = `/api/storage/private/${encodeURIComponent(objectPath)}`;

    return {
      uploadUrl,
      objectPath,
      downloadUrl,
      expiresAt: expiresAtIso,
      isPrivateBucket: true,
    };
  }

  /**
   * Verify an upload token for private storage write
   */
  verifyUploadToken(token: string): { valid: boolean; record?: any; reason?: string } {
    const record = pendingPrivateUploads.get(token);
    if (!record) {
      return { valid: false, reason: 'Upload token is invalid or has expired.' };
    }
    if (Date.now() > record.expiresAt) {
      pendingPrivateUploads.delete(token);
      return { valid: false, reason: 'Signed upload URL has expired (15 minute limit).' };
    }
    return { valid: true, record };
  }
}

export const signedUploadService = new SignedUploadService();
