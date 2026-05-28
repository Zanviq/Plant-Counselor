"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Silent client component — only job is to redirect logged-in users away
 * from the landing page to /home. Renders nothing to the DOM.
 */
export default function AuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/home");
    });
  }, [router]);
  return null;
}
