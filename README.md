# Duel Simulator

Yu-Gi-Oh! Card Simulator

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **State Management**: Jotai + jotai-history
- **Backend**: Hono + Cloudflare Workers
- **Database**: Cloudflare D1
- **Storage**: Cloudflare R2

## Local Development Setup

### Prerequisites

- Node.js v22+
- pnpm v10+
- Cloudflare account

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Cloudflare Environment Setup

#### Create D1 Database

```bash
# Create D1 database
wrangler d1 create duel-simulator

# Update the database ID in wrangler.toml
# Update the line: database_id = "YOUR_DATABASE_ID"

# Apply schema
wrangler d1 execute duel-simulator --local --file=./db/schema.sql
```

#### Create R2 Bucket

```bash
# Create R2 bucket
wrangler r2 bucket create duel-simulator-images
```

### 3. Environment Variables

Create `.env.local` file:

```bash
# Add environment variables as needed
```

### 4. Start Development Servers

Run in two separate terminals:

```bash
# Terminal 1: Frontend development server
pnpm dev:client

# Terminal 2: Backend development server
pnpm dev:server
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8787

## Build and Deploy

### Build

```bash
# Build frontend
pnpm build:client

# Build all (currently frontend only)
pnpm build
```

### Deploy to Cloudflare

```bash
# Deploy backend
pnpm deploy:server

# Frontend should be deployed separately via Cloudflare Pages
```

## Project Structure

```
duel-simulator/
├── src/
│   ├── client/     # React application
│   └── server/     # Hono + Cloudflare Workers
├── db/
│   ├── schema.sql  # D1 database schema
│   └── migrations/ # Migration files
├── public/         # Static files
├── dist/           # Build output
├── wrangler.toml   # Cloudflare Workers config
└── vite.config.ts  # Vite config
```
