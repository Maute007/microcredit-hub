import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setOnUnauthorized } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Cancela queries e faz logout quando a sessão expira (401).
 * Evita requests desnecessários após expiração.
 */
export function ApiAuthBridge() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    setOnUnauthorized(() => {
      queryClient.cancelQueries();
      void logoutRef.current();
    });
    return () => setOnUnauthorized(null);
  }, [queryClient]);

  return null;
}
