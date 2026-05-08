import { useEffect, useState } from "react";
import { isEnrolled } from "./biometry";

export type AuthStatus = "loading" | "needs-enrollment" | "locked" | "unlocked";

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    setStatus(isEnrolled() ? "locked" : "needs-enrollment");
  }, []);

  return {
    status,
    setStatus,
    unlock: () => setStatus("unlocked"),
    lock: () => setStatus(isEnrolled() ? "locked" : "needs-enrollment"),
    onEnrolled: () => setStatus("unlocked"),
    onReset: () => setStatus("needs-enrollment"),
  };
}
