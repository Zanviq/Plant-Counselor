"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/api/auth";

/**
 * Silent client component — only job is to redirect logged-in users away
 * from the landing page to /home. Renders nothing to the DOM.
 */
export default function AuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    getCurrentUser().then((res) => {
      if (res.ok) router.replace("/home");
    });
  }, [router]);
  return null;
}
