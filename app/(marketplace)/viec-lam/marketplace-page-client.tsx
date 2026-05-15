"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MarketplacePageClient() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/marketplace");
  }, [router]);

  return null;
}
