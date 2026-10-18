"use client";

import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AuthCard, authLink, FormError, FormNotice } from "@/components/auth/auth-card";
import { CodeInput } from "@/components/auth/code-input";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";

/** Seconds before another code may be asked for. The server's own limit is the real one; this stops a double-tap. */
const RESEND_AFTER = 30;

function GoogleGlyph() {
  // The provider's own mark, in one colour (currentColor): a multi-coloured logo is a colour outside the tokens.
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.72 14.53 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"
      />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49l-.01-1.72c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9l-.01 2.81c0 .27.18.6.69.49A10.13 10.13 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

/**
 * Sign in or create an account: one flow. An email address gets a six-digit
 * code; the code signs in, and the first time it also creates the account.
 * The page never says whether an address already has one.
 */
export function LoginForm({
  next,
  email: initialEmail,
  providerError,
  providers,
}: {
  /** Already validated on the server as a path on this site. */
  next: string;
  email: string;
  providerError: string | null;
  providers: { google: boolean; github: boolean };
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(providerError);
  const [busy, setBusy] = useState<"send" | "verify" | "google" | "github" | null>(null);
  const [wait, setWait] = useState(0);
  const heading = useRef<HTMLDivElement>(null);

  // The resend countdown. One interval while it runs, none after.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  // Moving between steps replaces the form; focus would otherwise be left on a control that no longer exists.
  useEffect(() => {
    heading.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [step]);

  async function sendCode(address: string) {
    setBusy("send");
    setError(null);
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
    setBusy(null);
    if (failure) {
      setError(authErrorMessage(failure, "The code could not be sent. Please try again."));
      return false;
    }
    setWait(RESEND_AFTER);
    return true;
  }

  async function onEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    setEmail(address);
    if (await sendCode(address)) {
      setCode("");
      setStep("code");
    }
  }

  async function verify(value: string) {
    if (value.length !== 6 || busy === "verify") return;
    setBusy("verify");
    setError(null);
    const { error: failure } = await authClient.signIn.emailOtp({ email, otp: value });
    if (failure) {
      setBusy(null);
      setCode("");
      setError(authErrorMessage(failure, "That code did not work. Ask for a new one."));
      return;
    }
    // A full navigation, not a client transition: the server must render the
    // destination with the new session cookie.
    window.location.assign(next);
  }

  async function social(provider: "google" | "github") {
    setBusy(provider);
    setError(null);
    const { error: failure } = await authClient.signIn.social({
      provider,
      callbackURL: next,
      errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
    });
    // On success the browser has already left for the provider.
    if (failure) {
      setBusy(null);
      setError(authErrorMessage(failure, "That sign-in could not start. Use the email code instead."));
    }
  }

  if (step === "code") {
    return (
      <div ref={heading} className="w-full max-w-[26rem]">
        <AuthCard
          kicker="Step 2 of 2"
          title="Check your inbox"
          description={
            <>
              We sent a six-digit code to <span className="font-semibold not-italic text-text-primary">{email}</span>. It works for ten minutes.
            </>
          }
          footer={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 font-medium text-text-primary underline underline-offset-4"
              onClick={() => {
                setStep("email");
                setError(null);
                setCode("");
              }}
            >
              <ArrowLeft className="size-4" aria-hidden /> Use a different email
            </button>
          }
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
            className="space-y-5"
          >
            <CodeInput label="Sign-in code" value={code} onChange={setCode} onComplete={(value) => void verify(value)} invalid={Boolean(error)} describedBy="code-error" autoFocus disabled={busy === "verify"} />
            <div id="code-error">
              <FormError message={error} />
            </div>
            <Button type="submit" size="lg" className="w-full" loading={busy === "verify"} disabled={code.length !== 6}>
              Sign in
            </Button>
          </form>
          <p className="text-sm text-text-secondary" aria-live="polite">
            {wait > 0 ? (
              <>Didn&rsquo;t get it? You can ask for another in {wait}s. Check your spam folder too.</>
            ) : (
              <>
                Didn&rsquo;t get it?{" "}
                <button type="button" className={authLink} disabled={busy === "send"} onClick={() => void sendCode(email)}>
                  Send a new code
                </button>
              </>
            )}
          </p>
        </AuthCard>
      </div>
    );
  }

  const anyProvider = providers.google || providers.github;
  return (
    <div ref={heading} className="w-full max-w-[26rem]">
      <AuthCard
        kicker="Sign in or join"
        title="Your desk awaits"
        description="One email, one code. New readers get an account the same way."
        footer={
          <>
            By continuing you agree to the{" "}
            <Link href="/terms" className={authLink}>
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className={authLink}>
              privacy notice
            </Link>
            . We never ask for a password.
          </>
        }
      >
        {providerError && error === providerError ? <FormNotice>{providerError}</FormNotice> : null}
        <form onSubmit={onEmail} className="space-y-4" noValidate>
          <TextField
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
            placeholder="you@example.com"
          />
          {error !== providerError ? <FormError message={error} /> : null}
          <Button type="submit" size="lg" className="w-full justify-between" loading={busy === "send"}>
            <span className="inline-flex items-center gap-2">
              <Mail className="size-4" aria-hidden /> Email me a code
            </span>
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </form>
        {anyProvider ? (
          <>
            <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.12em] text-text-tertiary uppercase" aria-hidden>
              <span className="h-px flex-1 bg-border-strong" />
              or
              <span className="h-px flex-1 bg-border-strong" />
            </div>
            <div className="grid gap-2.5">
              {providers.google ? (
                <Button variant="secondary" size="lg" className="w-full" loading={busy === "google"} onClick={() => void social("google")}>
                  <GoogleGlyph /> Continue with Google
                </Button>
              ) : null}
              {providers.github ? (
                <Button variant="secondary" size="lg" className="w-full" loading={busy === "github"} onClick={() => void social("github")}>
                  <GitHubGlyph /> Continue with GitHub
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </AuthCard>
    </div>
  );
}
