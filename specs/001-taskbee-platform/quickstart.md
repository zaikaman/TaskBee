# Setup & Quickstart

## Prerequisites
- Node.js (v18.17+)
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