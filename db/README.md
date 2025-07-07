# Database Schema and Migrations

This directory contains Cloudflare D1 database schema and migration files.

## Directory Structure

```
db/
├── README.md          # This file
├── schema.sql         # Initial schema definition
└── migrations/        # Migration files
    └── *.sql         # Individual migrations
```

## Usage

### Apply Initial Schema

```bash
# Local environment
pnpm db:migrate

# Production environment
pnpm db:migrate:remote
```

### Creating Migrations

To create a new migration file:

1. Create a new SQL file in the `migrations/` directory
2. Use numbered format like `001_description.sql`
3. Make migrations idempotent (use `IF NOT EXISTS` etc.)

### Running Migrations

Execute individual migration files:

```bash
# Local
pnpm exec wrangler d1 execute duel-simulator --local --file=./db/migrations/001_add_feature.sql

# Production
pnpm exec wrangler d1 execute duel-simulator --remote --file=./db/migrations/001_add_feature.sql
```

## Schema Definition

Current schema:

- `deck_images` - Deck image metadata
- `saved_states` - Game save states

See `schema.sql` for details.
