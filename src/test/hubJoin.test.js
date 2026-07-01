import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Inline the schemas under test so we don't need the full API layer (Prisma, etc.)
const joinHubSchema = z.object({
  inviteCode: z.string().length(8),
});

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

describe('joinHubSchema', () => {
  it('accepts an 8-character invite code', () => {
    expect(joinHubSchema.safeParse({ inviteCode: 'ABCD1234' }).success).toBe(true);
  });

  it('rejects a code shorter than 8 chars', () => {
    expect(joinHubSchema.safeParse({ inviteCode: 'SHORT' }).success).toBe(false);
  });

  it('rejects a code longer than 8 chars', () => {
    expect(joinHubSchema.safeParse({ inviteCode: 'TOOLONGCODE' }).success).toBe(false);
  });

  it('rejects missing inviteCode', () => {
    expect(joinHubSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-string inviteCode', () => {
    expect(joinHubSchema.safeParse({ inviteCode: 12345678 }).success).toBe(false);
  });
});

describe('authSchema (login / register)', () => {
  const valid = { email: 'user@example.com', password: 'securepass' };

  it('accepts valid credentials', () => {
    expect(authSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(authSchema.safeParse({ ...valid, email: 'notanemail' }).success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    expect(authSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('rejects password longer than 128 chars', () => {
    const long = 'a'.repeat(129);
    expect(authSchema.safeParse({ ...valid, password: long }).success).toBe(false);
  });

  it('accepts password at exactly 8 chars', () => {
    expect(authSchema.safeParse({ ...valid, password: 'exactly8' }).success).toBe(true);
  });

  it('accepts password at exactly 128 chars', () => {
    const edge = 'a'.repeat(128);
    expect(authSchema.safeParse({ ...valid, password: edge }).success).toBe(true);
  });

  it('rejects missing email', () => {
    expect(authSchema.safeParse({ password: 'securepass' }).success).toBe(false);
  });

  it('rejects missing password', () => {
    expect(authSchema.safeParse({ email: 'user@example.com' }).success).toBe(false);
  });
});
