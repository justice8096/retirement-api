-- Local auth (Clerk removal): login name + scrypt password hash on users.
-- Both nullable so existing rows keep working until credentials are set
-- via tools/manage-users.mjs.
ALTER TABLE "users" ADD COLUMN "username" TEXT;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
