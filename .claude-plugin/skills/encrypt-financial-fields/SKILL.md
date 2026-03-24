---
name: Encrypt Financial Fields
description: >-
  This skill should be used when the user asks to "encrypt financial data",
  "add encryption", "encrypt at rest", "protect sensitive fields",
  "implement field-level encryption", "encrypt portfolio balance",
  "encrypt PIA", "key management", "key rotation", "AES encryption",
  or mentions encrypting sensitive financial fields in the database.
version: 1.0.0
---

# Encrypt Financial Fields

Add application-layer encryption (AES-256-GCM) to sensitive financial fields before they reach the database. Covers implementation, key management, and key rotation.

## When to Use

- Implementing field-level encryption for the first time
- Adding new sensitive fields to the schema
- Setting up key management or rotation
- Before compliance review requiring encryption at rest

## Fields Requiring Encryption

From `packages/api/prisma/schema.prisma`:

| Model | Field | Type | Sensitivity |
|-------|-------|------|------------|
| `UserFinancialSettings` | `portfolioBalance` | Decimal | HIGH — net worth indicator |
| `HouseholdMember` | `ssPia` | Decimal | HIGH — SS benefit amount |
| `HouseholdProfile` | `targetAnnualIncome` | Decimal | MEDIUM — income target |

## Implementation Guide

### 1. Encryption Utility

Create `packages/api/src/lib/encryption.js`:

```
encrypt(plaintext, key) → { ciphertext, iv, tag }
decrypt(ciphertext, iv, tag, key) → plaintext
```

Requirements:
- Algorithm: AES-256-GCM (authenticated encryption)
- IV: 12 bytes, cryptographically random per encryption
- Auth tag: 16 bytes (128-bit)
- Key: 32 bytes from `ENCRYPTION_MASTER_KEY` env var
- Store as: base64-encoded JSON string in the Decimal/String column
- Use Node.js built-in `crypto` module (no external dependencies)

### 2. Prisma Middleware or Extension

Intercept reads/writes to automatically encrypt/decrypt:

**Option A: Prisma Client Extension** (recommended for Prisma 6):
```
$extends with query middleware on:
- UserFinancialSettings.create/update → encrypt before write
- UserFinancialSettings.findUnique/findMany → decrypt after read
- HouseholdMember.create/update → encrypt ssPia
- HouseholdMember.findUnique/findMany → decrypt ssPia
```

**Option B: Route-level encryption**:
- Encrypt in route handler before `prisma.create/update`
- Decrypt in route handler after `prisma.find*`
- More explicit but more code duplication

### 3. Schema Changes

Change encrypted field types from `Decimal` to `String` in Prisma schema (ciphertext is a string):
```
portfolioBalance  String   @default("")  // encrypted Decimal
ssPia             String?               // encrypted Decimal, nullable
```

Create a Prisma migration for this type change.

### 4. Key Management

- `ENCRYPTION_MASTER_KEY`: 64-character hex string (32 bytes)
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Store in: environment variable, never in code or config files
- Production: use a secrets manager (AWS Secrets Manager, Vault, etc.)

### 5. Key Rotation

Implement a rotation script:
1. Read all encrypted records with old key
2. Decrypt with old key
3. Re-encrypt with new key
4. Update records in a transaction
5. Verify all records decrypt correctly with new key
6. Swap key in secrets manager

### 6. Error Handling

- If `ENCRYPTION_MASTER_KEY` is missing: refuse to start the server
- If decryption fails (wrong key, corrupt data): log error, return null (don't crash)
- Never log plaintext financial values
- Never include financial values in error responses

## Testing

```
packages/api/src/lib/__tests__/encryption.test.js
```

Test cases:
- Round-trip: encrypt then decrypt returns original value
- Different IVs for same plaintext (no deterministic encryption)
- Wrong key fails to decrypt (returns error, not garbage)
- Null/empty input handled gracefully
- Large numbers ($10M+) encrypt and decrypt correctly
- Decimal precision preserved after round-trip

## Key Files

- `packages/api/src/lib/encryption.js` — Encryption utilities (to create)
- `packages/api/prisma/schema.prisma` — Field type changes
- `packages/api/src/server.js` — Key loading on startup
- `.env.example` — Add ENCRYPTION_MASTER_KEY placeholder
