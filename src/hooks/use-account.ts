import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/stores/auth.store";
import { accountQuery } from "@/lib/account/account.queries";

/** Current user + their account summary (null when signed out). */
export function useAccount() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const q = useQuery(accountQuery(user?.id));
  return { user, ready, account: user ? q.data ?? null : null, loading: !!user && q.isLoading };
}
