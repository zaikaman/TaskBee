import { requireRole } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";
import { MarketplacePageClient } from "./marketplace-page-client";

export default async function MarketplacePage() {
  await requireRole(UserRole.WORKER);

  return <MarketplacePageClient />;
}
