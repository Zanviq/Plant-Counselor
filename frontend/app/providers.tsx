"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { attachThemeListener, useThemeStore } from "@/lib/store/themeStore";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
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
