"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function signInWith(provider: string, callbackUrl: string, formData?: FormData) {
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  if (provider === "resend") {
    await signIn("resend", { email: String(formData?.get("email") ?? ""), redirectTo });
  } else {
    await signIn(provider, { redirectTo });
  }
}

export async function signInWithOwnerCode(callbackUrl: string, formData: FormData) {
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  try {
    await signIn("owner-code", { code: String(formData.get("code") ?? ""), redirectTo });
  } catch (error) {
    // A wrong code comes back as an AuthError; anything else (including the success redirect) rethrows.
    if (error instanceof AuthError) redirect(`/sign-in?error=CodeRejected&callbackUrl=${encodeURIComponent(redirectTo)}`);
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}
