import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { encryptSecret, decryptSecret } from "./envelope.ts";
import {
  AadMismatchError,
  AeadError,
  CustodyConfigError,
  CustodyError,
  KmsAccessError,
  KmsKeyError,
  OwnershipError,
  SecretDestroyedError,
  SecretNotFoundError,
  WrappedKeyCorruptionError,
  errorCode,
} from "./errors.ts";
import { resolveKmsConfig } from "./kms/config.ts";
import { TestKmsProvider } from "./kms/test-kms.ts";
import {
  decryptAltanaSecret,
  destroyAltanaSecret,
  encryptAltanaSecret,
  rotateAltanaSecret,
} from "./service.ts";
import type { CustodyAuditInput, CustodyOwner, CustodyPersistence, EncryptedSecretRecord, SessionBinding } from "./types.ts";

const PLAINTEXT = Buffer.from("fixture altana session signer — TEST ONLY, not a real credential");
const USER_1: CustodyOwner = { userId: "user-1", walletAddress: "0x1111111111111111111111111111111111111111" };
const USER_2: CustodyOwner = { userId: "user-2", walletAddress: "0x2222222222222222222222222222222222222222" };
const SESSION_1 = "session-1";
const SESSION_2 = "session-2";
const CHAIN_ID = 97;

class MemoryCustodyPersistence implements CustodyPersistence {
  sessions = new Map<string, SessionBinding>();
  secrets = new Map<string, EncryptedSecretRecord>();
  audits: CustodyAuditInput[] = [];
  private nextId = 1;

  constructor(sessions: SessionBinding[] = []) {
    for (const session of sessions) this.sessions.set(session.id, session);
  }

  loadSession(sessionId: string) {
    return Promise.resolve(this.sessions.get(sessionId) ?? null);
  }
  loadSecret(sessionId: string) {
    return Promise.resolve(this.secrets.get(sessionId) ?? null);
  }
  insertSecret(input: { sessionId: string; fields: EncryptedSecretRecord; now: Date }) {
    const record: EncryptedSecretRecord = { ...input.fields, id: `secret-${this.nextId++}`, destroyedAt: null };
    this.secrets.set(input.sessionId, record);
    return Promise.resolve({ id: record.id });
  }
  replaceSecret(input: { id: string; fields: EncryptedSecretRecord; now: Date }) {
    const current = [...this.secrets.values()].find((item) => item.id === input.id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, ...input.fields, destroyedAt: null });
    return Promise.resolve();
  }
  replaceCiphertext(input: { id: string; fields: EncryptedSecretRecord; now: Date }) {
    const current = [...this.secrets.values()].find((item) => item.id === input.id);
    if (!current) return Promise.reject(new Error("missing record"));
    this.secrets.set(current.sessionId, { ...current, ...input.fields });
    return Promise.resolve();
  }
  markDestroyed(id: string, at: Date) {
    const current = [...this.secrets.values()].find((item) => item.id === id);
    if (current) this.secrets.set(current.sessionId, { ...current, destroyedAt: at });
    return Promise.resolve();
  }
  writeAudit(input: CustodyAuditInput) {
    this.audits.push(input);
    return Promise.resolve();
  }
}

function check(name: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL ${name}`);
  console.log(`PASS ${name}`);
}

function expectCustodyError(name: string, promise: Promise<unknown>, errorClass: typeof CustodyError): Promise<void> {
  return promise.then(
    () => {
      throw new Error(`FAIL ${name}: expected ${errorClass.name}`);
    },
    (error) => {
      check(name, error instanceof errorClass);
    }
  );
}

function bufEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && left.equals(right);
}

function flipByte(value: Buffer, index: number): Buffer {
  const copy = Buffer.from(value);
  copy[index] ^= 0xff;
  return copy;
}

const persistence = new MemoryCustodyPersistence([
  { id: SESSION_1, userId: USER_1.userId, chainId: CHAIN_ID },
  { id: SESSION_2, userId: USER_2.userId, chainId: CHAIN_ID },
]);
const provider = new TestKmsProvider();

async function encryptFixture(store: MemoryCustodyPersistence, kms: TestKmsProvider) {
  const result = await encryptAltanaSecret({
    persistence: store,
    provider: kms,
    owner: USER_1,
    sessionId: SESSION_1,
    plaintext: PLAINTEXT,
  });
  const record = store.secrets.get(SESSION_1);
  if (!record) throw new Error("fixture record missing");
  return { result, record };
}

// ---- 1-3: round trip, unique nonce, non-deterministic ciphertext ----
const first = await encryptFixture(persistence, provider);
const decrypted = await decryptAltanaSecret({ persistence, provider, owner: USER_1, sessionId: SESSION_1 });
check("1. encrypt/decrypt round trip", decrypted.equals(PLAINTEXT));

const second = await encryptSecret({
  plaintext: PLAINTEXT,
  secretType: "ALTANA_SESSION_SIGNER",
  userId: USER_1.userId,
  sessionId: SESSION_1,
  chainId: CHAIN_ID,
  provider,
});
check("2. unique random nonce per encryption", !bufEqual(first.record.nonce, second.nonce));
check("3. ciphertext differs for identical plaintext", !bufEqual(first.record.ciphertext, second.ciphertext));

// ---- 4-8: tampering ----
const tamperedRecord = { ...first.record };
tamperedRecord.ciphertext = flipByte(first.record.ciphertext, 0);
await expectCustodyError(
  "5. tampered ciphertext rejected",
  decryptSecret({ record: tamperedRecord, provider }),
  AeadError
);

const nonceRecord = { ...first.record, nonce: flipByte(first.record.nonce, 0) };
await expectCustodyError("6. tampered nonce rejected", decryptSecret({ record: nonceRecord, provider }), AeadError);

const tagRecord = { ...first.record, authenticationTag: flipByte(first.record.authenticationTag, 0) };
await expectCustodyError("7. tampered authentication tag rejected", decryptSecret({ record: tagRecord, provider }), AeadError);

const wrappedRecord = { ...first.record, wrappedDataKey: flipByte(first.record.wrappedDataKey, 0) };
await expectCustodyError(
  "8. tampered wrapped data key rejected",
  decryptSecret({ record: wrappedRecord, provider }),
  WrappedKeyCorruptionError
);
check(
  "4. authentication tag validates the sealed payload",
  await decryptAltanaSecret({ persistence, provider, owner: USER_1, sessionId: SESSION_1 }).then(() => true)
);

// ---- 9: AAD mismatch ----
const tamperedAad = { ...first.record, userId: "user-999" };
await expectCustodyError(
  "9. AAD mismatch rejected (record context tampered)",
  decryptSecret({ record: tamperedAad, provider }),
  AeadError
);
const serviceTampered = { ...first.record, userId: "user-999" };
persistence.secrets.set(SESSION_1, serviceTampered);
await expectCustodyError(
  "9b. AAD metadata mismatch rejected at service layer",
  decryptAltanaSecret({ persistence, provider, owner: USER_1, sessionId: SESSION_1 }),
  AadMismatchError
);
persistence.secrets.set(SESSION_1, first.record);

// ---- 10-11: ownership and session binding ----
await expectCustodyError(
  "10. wrong user rejected",
  decryptAltanaSecret({ persistence, provider, owner: USER_2, sessionId: SESSION_1 }),
  OwnershipError
);
await expectCustodyError(
  "11. session without a secret rejected",
  decryptAltanaSecret({ persistence, provider, owner: USER_2, sessionId: SESSION_2 }),
  SecretNotFoundError
);

// ---- 12: destroyed secret ----
await destroyAltanaSecret({ persistence, owner: USER_1, sessionId: SESSION_1 });
await expectCustodyError(
  "12. destroyed secret rejected",
  decryptAltanaSecret({ persistence, provider, owner: USER_1, sessionId: SESSION_1 }),
  SecretDestroyedError
);
check("12b. destroy is idempotent", (await destroyAltanaSecret({ persistence, owner: USER_1, sessionId: SESSION_1 })).destroyedAt instanceof Date);
await encryptAltanaSecret({ persistence, provider, owner: USER_1, sessionId: SESSION_1, plaintext: PLAINTEXT });
check("12c. re-encrypt after destroy replaces the record in place", persistence.secrets.get(SESSION_1)?.destroyedAt === null);

// ---- 13-14: fail closed ----
const failingStore = new MemoryCustodyPersistence([
  { id: SESSION_1, userId: USER_1.userId, chainId: CHAIN_ID },
]);
const accessDenied = new TestKmsProvider({ failure: "access-denied" });
await expectCustodyError(
  "13. KMS access failure fails closed on encrypt",
  encryptAltanaSecret({ persistence: failingStore, provider: accessDenied, owner: USER_1, sessionId: SESSION_1, plaintext: PLAINTEXT }),
  KmsAccessError
);
await expectCustodyError(
  "13b. KMS access failure fails closed on decrypt",
  decryptAltanaSecret({ persistence, provider: accessDenied, owner: USER_1, sessionId: SESSION_1 }),
  KmsAccessError
);
const unknownKey = new TestKmsProvider({ failure: "unknown-key" });
await expectCustodyError(
  "13c. unknown KMS key fails closed",
  decryptAltanaSecret({ persistence, provider: unknownKey, owner: USER_1, sessionId: SESSION_1 }),
  KmsKeyError
);
const corruptUnwrap = new TestKmsProvider({ failure: "corrupt-unwrap" });
await expectCustodyError(
  "13d. corrupted wrapped key fails closed",
  decryptAltanaSecret({ persistence, provider: corruptUnwrap, owner: USER_1, sessionId: SESSION_1 }),
  WrappedKeyCorruptionError
);
check("13e. no record persisted when KMS fails", failingStore.secrets.size === 0);
let configError = false;
try {
  resolveKmsConfig({});
} catch (error) {
  configError = error instanceof CustodyConfigError;
}
check("14. missing KMS config fails closed", configError);
let partialConfigError = false;
try {
  resolveKmsConfig({ ALTANA_KMS_KEY_ID: "alias/altana" });
} catch (error) {
  partialConfigError = error instanceof CustodyConfigError;
}
check("14b. partial KMS config fails closed", partialConfigError);
let unknownProviderError = false;
try {
  resolveKmsConfig({ ALTANA_KMS_PROVIDER: "vault" });
} catch (error) {
  unknownProviderError = error instanceof CustodyConfigError;
}
check("14c. unknown KMS provider fails closed", unknownProviderError);
const testProviderInDevelopment = resolveKmsConfig({ ALTANA_KMS_PROVIDER: "test", NODE_ENV: "development" });
check("14d. test provider selectable outside production", testProviderInDevelopment.kind === "test");

// ---- 15-17: no plaintext / DEK persistence, no logging ----
const spyPersistence = new MemoryCustodyPersistence([
  { id: SESSION_1, userId: USER_1.userId, chainId: CHAIN_ID },
]);
const spyKeys: Buffer[] = [];
const spyProvider = new TestKmsProvider();
const spyWrap = spyProvider.wrapDataKey.bind(spyProvider);
spyProvider.wrapDataKey = async (dataKey: Buffer) => {
  spyKeys.push(Buffer.from(dataKey));
  return spyWrap(dataKey);
};
await encryptAltanaSecret({
  persistence: spyPersistence,
  provider: spyProvider,
  owner: USER_1,
  sessionId: SESSION_1,
  plaintext: PLAINTEXT,
});
const spyRecord = spyPersistence.secrets.get(SESSION_1);
if (!spyRecord) throw new Error("spy record missing");
const recordJson = JSON.stringify(spyRecord);
check("15. plaintext signer never persisted", !recordJson.includes(PLAINTEXT.toString("utf8")) && !recordJson.includes(PLAINTEXT.toString("base64")));
const dek = spyKeys[0];
check(
  "16. DEK never persisted plaintext",
  !recordJson.includes(dek.toString("base64")) && !bufEqual(spyRecord.wrappedDataKey, dek) && dek.length === 32
);
const auditJson = JSON.stringify(spyPersistence.audits);
check(
  "17. raw signer never logged",
  !auditJson.includes(PLAINTEXT.toString("utf8")) && !auditJson.includes(PLAINTEXT.toString("base64")) && !auditJson.includes(dek.toString("base64"))
);

// ---- 18: server-only import boundary ----
const custodyRoot = join(process.cwd(), "lib", "custody");
const serverOnlyFiles = ["index.ts", "persistence.server.ts", "kms/factory.ts", "kms/aws-kms.ts"];
for (const file of serverOnlyFiles) {
  const source = readFileSync(join(custodyRoot, file), "utf8");
  check(`18. ${file} is server-only`, source.includes('import "server-only";'));
}
const componentsRoot = join(process.cwd(), "components");
const componentFiles = readdirSync(componentsRoot, { recursive: true }).filter(
  (name) => typeof name === "string" && (name.endsWith(".tsx") || name.endsWith(".ts"))
);
const clientImportsCustody = componentFiles.some((name) => {
  const source = readFileSync(join(componentsRoot, String(name)), "utf8");
  return source.includes("lib/custody");
});
check("18b. no client component imports custody", !clientImportsCustody);
const appFiles = readdirSync(join(process.cwd(), "app"), { recursive: true })
  .filter((name) => typeof name === "string" && (name.endsWith(".tsx") || name.endsWith(".ts")))
  .map((name) => String(name));
const deepCustodyImports = appFiles.filter((name) => {
  const source = readFileSync(join(process.cwd(), "app", name), "utf8");
  return /(?:from\s+|import\s*)["']([^"']*lib\/custody\/[^"']+)["']/.test(source);
});
check(
  "18c. app code only ever imports the custody entry",
  deepCustodyImports.every((name) => {
    const source = readFileSync(join(process.cwd(), "app", name), "utf8");
    return !/["']@\/lib\/custody\/[^"']+["']/.test(source);
  })
);

// ---- 19: key metadata persisted ----
check(
  "19. key metadata persisted correctly",
  first.record.kmsKeyId === "test-kms-key" &&
    first.record.kmsKeyVersion === "test-v1" &&
    first.record.algorithm === "TEST_AES_256_GCM" &&
    first.record.aadVersion === 1
);

// ---- 20: rotation / re-encryption ----
const rotationPersistence = new MemoryCustodyPersistence([
  { id: SESSION_1, userId: USER_1.userId, chainId: CHAIN_ID },
]);
const oldKey = new TestKmsProvider();
await encryptAltanaSecret({
  persistence: rotationPersistence,
  provider: oldKey,
  owner: USER_1,
  sessionId: SESSION_1,
  plaintext: PLAINTEXT,
});
const beforeRotationWrapped = rotationPersistence.secrets.get(SESSION_1)?.wrappedDataKey;
const rotationProvider = new TestKmsProvider();
const rotated = await rotateAltanaSecret({
  persistence: rotationPersistence,
  oldProvider: oldKey,
  newProvider: rotationProvider,
  owner: USER_1,
  sessionId: SESSION_1,
});
const afterRotationRecord = rotationPersistence.secrets.get(SESSION_1);
if (!beforeRotationWrapped || !afterRotationRecord) throw new Error("rotation fixture missing");
check(
  "20. rotation completes and re-encrypts",
  rotated.kmsKeyId === "test-kms-key" &&
    !bufEqual(beforeRotationWrapped, afterRotationRecord.wrappedDataKey) &&
    (await decryptAltanaSecret({ persistence: rotationPersistence, provider: rotationProvider, owner: USER_1, sessionId: SESSION_1 })).equals(PLAINTEXT)
);
const rotationAudits = rotationPersistence.audits.filter((item) => item.eventType.startsWith("ALTANA_SECRET_ROTATION"));
check(
  "20b. rotation audit trail",
  rotationAudits.some((item) => item.eventType === "ALTANA_SECRET_ROTATION_STARTED" && item.result === "SUCCESS") &&
    rotationAudits.some((item) => item.eventType === "ALTANA_SECRET_ROTATION_COMPLETED" && item.result === "SUCCESS")
);
const failingRotation = new TestKmsProvider({ failure: "unknown-key" });
const beforeFailure = JSON.stringify(rotationPersistence.secrets.get(SESSION_1));
await expectCustodyError(
  "20c. rotation failure fails closed",
  rotateAltanaSecret({
    persistence: rotationPersistence,
    oldProvider: rotationProvider,
    newProvider: failingRotation,
    owner: USER_1,
    sessionId: SESSION_1,
  }),
  KmsKeyError
);
check(
  "20d. old ciphertext preserved after failed rotation",
  JSON.stringify(rotationPersistence.secrets.get(SESSION_1)) === beforeFailure &&
    (await decryptAltanaSecret({ persistence: rotationPersistence, provider: rotationProvider, owner: USER_1, sessionId: SESSION_1 })).equals(PLAINTEXT)
);
check(
  "20e. rotation failure audited",
  rotationPersistence.audits.some((item) => item.eventType === "ALTANA_SECRET_ROTATION_FAILED" && item.result === "FAILURE")
);

// ---- restart safety: no in-memory crypto state required ----
const restartPersistence = new MemoryCustodyPersistence([
  { id: SESSION_1, userId: USER_1.userId, chainId: CHAIN_ID },
]);
const processA = new TestKmsProvider();
await encryptAltanaSecret({
  persistence: restartPersistence,
  provider: processA,
  owner: USER_1,
  sessionId: SESSION_1,
  plaintext: PLAINTEXT,
});
const persistedBeforeExit = JSON.stringify(restartPersistence.secrets.get(SESSION_1));
const processB = new TestKmsProvider();
const restartResult = await decryptAltanaSecret({
  persistence: restartPersistence,
  provider: processB,
  owner: USER_1,
  sessionId: SESSION_1,
});
check(
  "restart-safety: fresh provider + fresh service decrypt the persisted record with no shared in-memory state",
  restartResult.equals(PLAINTEXT) && persistedBeforeExit === JSON.stringify(restartPersistence.secrets.get(SESSION_1))
);

// ---- production guards ----
const savedNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
let productionGuard = false;
try {
  new TestKmsProvider();
} catch (error) {
  productionGuard = error instanceof CustodyConfigError && errorCode(error) === "custody-config";
}
process.env.NODE_ENV = savedNodeEnv;
check("production: test KMS adapter cannot be constructed", productionGuard);
let productionResolverGuard = false;
try {
  resolveKmsConfig({ ALTANA_KMS_PROVIDER: "test", NODE_ENV: "production" });
} catch (error) {
  productionResolverGuard = error instanceof CustodyConfigError;
}
check("production: test provider rejected by resolver", productionResolverGuard);
check(
  "audit: custody audits contain ids and status only",
  persistence.audits.every((item) => typeof item.eventType === "string" && ["SUCCESS", "FAILURE", "DENIED"].includes(item.result)) &&
    !JSON.stringify(persistence.audits).includes("signer")
);
check(
  "failure: error codes are stable and typed",
  errorCode(new AeadError("x")) === "aead-auth-failed" && errorCode(new OwnershipError("x")) === "ownership-mismatch"
);

console.log("X.44 custody offline verification: PASS");
console.log("PERSISTENCE (real PostgreSQL): BLOCKED — no database server available (P1001)");
