"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <button className="logout-button" onClick={logout} disabled={pending}>
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
