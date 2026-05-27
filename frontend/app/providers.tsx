"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { attachThemeListener, useThemeStore } from "@/lib/store/themeStore";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 2 minutes: plant/bud data doesn't change on its own within this window.
        // Individual queries can override this with a smaller staleTime.
        staleTime: 2 * 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
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
