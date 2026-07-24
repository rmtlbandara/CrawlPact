import { useState } from "react";
import { Button } from "@crawlpact/ui";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <Button type="button" variant="secondary" isLoading={busy} onClick={handleClick}>
      Sign out
    </Button>
  );
}
