# Password recovery setup

The existing login and Settings links both lead to /forgot-password. The request endpoint always returns the same 202 message for accepted email input, unknown addresses and provider rejection. A trusted-proxy IP limit runs before any email request. The update endpoint has a separate IP limit and same-origin check.

Configure NEXT_PUBLIC_APP_URL to the actual trusted HTTPS origin, and add that origin's /auth/recovery URL to the connected Supabase project's redirect allowlist. Keep OTP_HASH_SECRET at least 32 random characters. Recovery proofs are HMAC signed, identity bound, HttpOnly, SameSite=Lax and expire after ten minutes. They are deleted after successful password update. Supabase sessions are signed out globally on success.

Configure the Supabase recovery email template to link to:
{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery

The callback also supports PKCE code exchange with type=recovery. Token hashes support opening the email in a different browser. The callback verifies identity and only redirects to /update-password. The incoming next parameter is ignored.

Custom SMTP, redirect allowlist settings, email template changes, delivery, expired/used links and multi-device recovery require live verification in an approved disposable environment. No hosted settings were changed and no real recovery email was sent during implementation.
