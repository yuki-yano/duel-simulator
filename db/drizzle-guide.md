# Drizzle ORM Usage Guide

## Overview

This project uses Drizzle ORM for Cloudflare D1 database operations.

## Database Management Flow

### 1. Create D1 Database (wrangler required)

```bash
# One-time setup: Create D1 database on Cloudflare
pnpm db:create

# R2 bucket is also required
pnpm r2:create
```

### 2. Define Schema

Define schema in TypeScript at `src/server/db/schema.ts`

### 3. Migration Management

#### Method 1: Execute Existing SQL (Current Method)

```bash
# Local environment
pnpm db:migrate

# Production environment
pnpm db:migrate:remote
```

#### Method 2: Generate Migrations with Drizzle

```bash
# Generate SQL migrations from schema
pnpm db:generate

# Check generated migrations
# New SQL files will be created in db/migrations/

# Execute with wrangler (not automated yet)
pnpm exec wrangler d1 execute duel-simulator --local --file=./db/migrations/0000_xxx.sql
```

#### Method 3: Direct Apply with Drizzle Push (Development Only)

```bash
# Apply schema directly to D1 (no migration history)
pnpm db:push
```

### 4. Database Management Tools

```bash
# Manage database visually with Drizzle Studio
pnpm db:studio
```

## Why wrangler is Required

- **D1 is a Cloudflare Service**: D1 database creation, deletion, and execution must be done through Cloudflare's API
- **Drizzle's Role**:
  - TypeScript type-safe query builder
  - SQL migration generation
  - Schema management
- **wrangler's Role**:
  - D1 database creation/deletion
  - SQL execution
  - Cloudflare authentication/communication

## Recommended Workflow

1. **Development**: Edit `src/server/db/schema.ts`
2. **Generate Migration**: `pnpm db:generate`
3. **Review**: Check generated SQL
4. **Apply**: Execute migration with wrangler
5. **Production**: Automate migrations in CI/CD

## Future Improvements

- Automate migration execution scripts
- CI/CD migration management
- Implement rollback functionality
