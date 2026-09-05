export class CustodyError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CustodyError";
    this.code = code;
  }
}

export class CustodyConfigError extends CustodyError {
  constructor(message: string) {
    super(message, "custody-config");
    this.name = "CustodyConfigError";
  }
}

export class KmsAccessError extends CustodyError {
  constructor(message: string) {
    super(message, "kms-access-denied");
    this.name = "KmsAccessError";
  }
}

export class KmsKeyError extends CustodyError {
  constructor(message: string) {
    super(message, "kms-key-unavailable");
    this.name = "KmsKeyError";
  }
}

export class KmsFailureError extends CustodyError {
  constructor(message: string) {
    super(message, "kms-failure");
    this.name = "KmsFailureError";
  }
}

export class WrappedKeyCorruptionError extends CustodyError {
  constructor(message: string) {
    super(message, "wrapped-key-corrupt");
    this.name = "WrappedKeyCorruptionError";
  }
}

export class AeadError extends CustodyError {
  constructor(message: string) {
    super(message, "aead-auth-failed");
    this.name = "AeadError";
  }
}

export class AadMismatchError extends CustodyError {
  constructor(message: string) {
    super(message, "aad-mismatch");
    this.name = "AadMismatchError";
  }
}

export class OwnershipError extends CustodyError {
  constructor(message: string) {
    super(message, "ownership-mismatch");
    this.name = "OwnershipError";
  }
}

export class SecretDestroyedError extends CustodyError {
  constructor(message: string) {
    super(message, "secret-destroyed");
    this.name = "SecretDestroyedError";
  }
}

export class SecretNotFoundError extends CustodyError {
  constructor(message: string) {
    super(message, "secret-not-found");
    this.name = "SecretNotFoundError";
  }
}

export class SessionNotFoundError extends CustodyError {
  constructor(message: string) {
    super(message, "session-not-found");
    this.name = "SessionNotFoundError";
  }
}

export class SecretAlreadyExistsError extends CustodyError {
  constructor(message: string) {
    super(message, "secret-already-exists");
    this.name = "SecretAlreadyExistsError";
  }
}

export class RecordMalformedError extends CustodyError {
  constructor(message: string) {
    super(message, "record-malformed");
    this.name = "RecordMalformedError";
  }
}

export function errorCode(error: unknown): string {
  return error instanceof CustodyError ? error.code : "unknown";
}
