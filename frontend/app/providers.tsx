"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { attachThemeListener, useThemeStore } from "@/lib/store/themeStore";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 30s staleTime: mutations invalidate immediately, but background-idle
        // data is considered fresh for 30s to avoid redundant fetches on mount.
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 1,
        // Refetch when user returns to window — ensures cross-page consistency
        // when admin modifies data or AI skills run on another tab.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(makeQueryClient);
  const apply = useThemeStore((s) => s.apply);

  useEffect(() => {
    apply();
    return attachThemeListener();
  }, [apply]);

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
