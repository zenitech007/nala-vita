# Private chat and video

Apply the F19 migration after Batch 2 F05 and F18. Reconcile the legacy schema
and rehearse on a disposable Supabase project. Keep `nala_private` out of the
Data API exposed schemas. Disable public channels in Realtime settings.
The hosted catalog showed RLS enabled on the managed `realtime.messages`
table and zero policies. The migration and real channel joins are unverified.

Each chat inbox belongs to the signed-in database user. The server broadcasts
only an invalidation with participant IDs after a message or read receipt is
saved. The browser reloads the authorized thread. Each video inbox also checks
the appointment, both participants, activation, verification and call status.
Only the server publishes application broadcasts. The signaling endpoint
checks membership on each send and supplies the sender. Receiving clients
check the peer, recipient, appointment, signal shape and event age.

Realtime join authorization can be cached by the service. Test revocation
and reconnects with synthetic identities, including an unrelated account and
both join orders. Verify that previously connected clients cannot fetch
thread content or send signals after losing access. Test media separately.

Set `TURN_URLS` to comma-separated `turn:` or `turns:` URLs and set
`TURN_USERNAME` and `TURN_CREDENTIAL` through the server secret store.
Prefer short-lived relay credentials. The membership endpoint sends relay
configuration only to authorized call participants with no-store responses.
The existing STUN configuration remains available when TURN is omitted.
Verify relay-only connectivity across two networks before launch.

[Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
