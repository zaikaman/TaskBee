# Setup & Quickstart

## Prerequisites
- Node.js (v20.9+; use the current LTS or newer when installing latest Next.js)
- npm or pnpm
- Supabase CLI
- Docker (optional, if running local supabase without CLI)

## Getting Started

1. **Clone & Install**
   ```bash
   git clone <repo-url>
   cd taskbee
   npm install
   ```

   Setup tasks should install application libraries with their npm `latest` dist-tags, then commit the generated lockfile for reproducible builds.

2. **Environment Variables**
   Copy `.env.example` to `.env.local` and populate:
   ```txt
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   DATABASE_URL=
   DIRECT_URL=
   ```

3. **Supabase & Prisma Setup**
   ```bash
   supabase start
   # Apply migrations
   npx prisma generate
   npx prisma db push
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Server will be available at `http://localhost:3000`.

## Testing
- Unit tests: `npm run test`
- E2E tests: `npx playwright test`

## Architecture Rules
- DO NOT access `prisma` directly from frontend components. Map requests via Server Actions or Route Handlers in `lib/services`.
- Validate all inputs via `zod` before injecting into the database.
- Use `lib/utils` for UI utilities (e.g., `cn()`).
