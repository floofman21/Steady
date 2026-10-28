"use server";

import { signIn, signOut } from "@/auth";

export async function signInWith(provider: string, callbackUrl: string, formData?: FormData) {
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  if (provider === "resend") {
    await signIn("resend", { email: String(formData?.get("email") ?? ""), redirectTo });
  } else {
    await signIn(provider, { redirectTo });
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}
