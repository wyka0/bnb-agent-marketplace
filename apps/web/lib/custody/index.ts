import "server-only";
import { createKmsProvider } from "./kms/factory.ts";
import { prismaCustodyPersistence } from "./persistence.server.ts";
import {
  decryptAltanaSecret as decrypt,
  destroyAltanaSecret as destroy,
  encryptAltanaSecret as encrypt,
  rotateAltanaSecret as rotate,
} from "./service.ts";
import type { CustodyOwner, EncryptedSecretType, KmsProvider } from "./types.ts";

/**
 * Server-only custody entry. This is the ONLY module Altana session logic
 * (X.45+) may import from lib/custody. It wires the Prisma persistence
 * boundary and the configured KMS provider; the raw secret is returned in
 * memory only and never exposed over any API.
 */
export interface AltanaCustody {
  encryptAltanaSecret(input: {
    owner: CustodyOwner;
    sessionId: string;
    plaintext: Buffer;
    secretType?: EncryptedSecretType;
  }): Promise<{ encryptedSecretId: string }>;
  decryptAltanaSecret(input: { owner: CustodyOwner; sessionId: string }): Promise<Buffer>;
  destroyAltanaSecret(input: { owner: CustodyOwner; sessionId: string }): Promise<{ destroyedAt: Date }>;
  rotateAltanaSecret(input: { owner: CustodyOwner; sessionId: string; newProvider?: KmsProvider }): Promise<{
    kmsKeyId: string;
    kmsKeyVersion: string;
  }>;
}

export function createAltanaCustody(env: Record<string, string | undefined> = process.env): AltanaCustody {
  const provider = createKmsProvider(env);
  const persistence = prismaCustodyPersistence;
  return {
    encryptAltanaSecret: (input) => encrypt({ persistence, provider, owner: input.owner, sessionId: input.sessionId, plaintext: input.plaintext, secretType: input.secretType }),
    decryptAltanaSecret: (input) => decrypt({ persistence, provider, owner: input.owner, sessionId: input.sessionId }),
    destroyAltanaSecret: (input) => destroy({ persistence, owner: input.owner, sessionId: input.sessionId }),
    rotateAltanaSecret: (input) => rotate({ persistence, oldProvider: provider, newProvider: input.newProvider ?? provider, owner: input.owner, sessionId: input.sessionId }),
  };
}
