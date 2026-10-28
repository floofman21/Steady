import { describe, expect, it } from "vitest";
import { emailDomainAllowed } from "@/lib/auth-rules";

describe("emailDomainAllowed", () => {
  it("allows listed domains, case-insensitively", () => {
    expect(emailDomainAllowed("ana@Arkone.com", "arkone.com, arkone.io")).toBe(true);
    expect(emailDomainAllowed("ana@arkone.io", "arkone.com,arkone.io")).toBe(true);
  });
  it("rejects other domains and look-alikes", () => {
    expect(emailDomainAllowed("ana@gmail.com", "arkone.com")).toBe(false);
    expect(emailDomainAllowed("ana@evil-arkone.com", "arkone.com")).toBe(false);
    expect(emailDomainAllowed("ana@arkone.com.evil.io", "arkone.com")).toBe(false);
  });
  it("accepts entries written with a leading @", () => {
    expect(emailDomainAllowed("ana@arkone.com", "@arkone.com")).toBe(true);
  });
  it("allows any domain when the list is empty", () => {
    expect(emailDomainAllowed("ana@gmail.com", "")).toBe(true);
  });
});
