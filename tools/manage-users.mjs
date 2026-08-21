#!/usr/bin/env node
/**
 * manage-users.mjs — local-auth account management (Clerk removed 2026-08-21).
 *
 * There is deliberately NO registration endpoint: this CLI is the only way
 * accounts are created or passwords changed (run it via Claude on request).
 *
 * Usage:
 *   node tools/manage-users.mjs list
 *   node tools/manage-users.mjs add <username> --email <email> [--name <display>] [--tier <tier>] [--password <pw>]
 *   node tools/manage-users.mjs set-password <username> [--password <pw>]
 *
 * Password comes from --password or the PASSWORD env var (env avoids shell
 * history). `add` attaches to an existing row when the email already exists
 * (preserving that user's data) instead of creating a duplicate.
 */
import 'dotenv/config';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7: explicit driver adapter (same construction as src/db/prisma.ts).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Same parameters/encoding as src/lib/passwords.ts (scrypt$N$r$p$salt$hash).
const SCRYPT_N = 32768, SCRYPT_R = 8, SCRYPT_P = 1, KEY_LENGTH = 64;
function scrypt(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 256 * SCRYPT_N * SCRYPT_R,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[i + 1];
      i++;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function requirePassword(flags) {
  const pw = flags.password ?? process.env.PASSWORD;
  if (!pw) {
    console.error('No password given: pass --password <pw> or set the PASSWORD env var.');
    process.exit(1);
  }
  if (pw.length < 4) {
    console.error('Password must be at least 4 characters.');
    process.exit(1);
  }
  return pw;
}

const [, , command, ...rest] = process.argv;
const { positional, flags } = parseArgs(rest);

try {
  if (command === 'list') {
    const users = await prisma.user.findMany({
      select: { username: true, email: true, displayName: true, tier: true, passwordHash: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const u of users) {
      const login = u.username ? `username=${u.username}` : 'no-local-login';
      const pw = u.passwordHash ? 'password-set' : 'no-password';
      console.log(`${u.email}  ${login}  ${pw}  tier=${u.tier}  name=${u.displayName ?? '-'}`);
    }
  } else if (command === 'add') {
    const username = positional[0]?.trim().toLowerCase();
    const email = flags.email;
    if (!username || !email) {
      console.error('Usage: add <username> --email <email> [--name <display>] [--tier <tier>] [--password <pw>]');
      process.exit(1);
    }
    const passwordHash = await hashPassword(requirePassword(flags));
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) {
      console.error(`Username "${username}" is already taken (${taken.email}).`);
      process.exit(1);
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.username) {
        console.error(`${email} already has local login "${existing.username}" — use set-password instead.`);
        process.exit(1);
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          username, passwordHash,
          displayName: flags.name ?? existing.displayName,
          ...(flags.tier ? { tier: flags.tier } : {}),
        },
      });
      console.log(`Attached local login "${username}" to existing user ${email} (data preserved).`);
    } else {
      await prisma.user.create({
        data: {
          username, passwordHash, email,
          authProviderId: `local:${username}`,
          displayName: flags.name ?? null,
          ...(flags.tier ? { tier: flags.tier } : {}),
        },
      });
      console.log(`Created user "${username}" <${email}>.`);
    }
  } else if (command === 'set-password') {
    const username = positional[0]?.trim().toLowerCase();
    if (!username) {
      console.error('Usage: set-password <username> [--password <pw>]');
      process.exit(1);
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`No user with username "${username}".`);
      process.exit(1);
    }
    const passwordHash = await hashPassword(requirePassword(flags));
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log(`Password updated for "${username}".`);
  } else {
    console.error('Commands: list | add <username> --email <email> | set-password <username>');
    process.exit(1);
  }
} finally {
  await prisma.$disconnect();
}
