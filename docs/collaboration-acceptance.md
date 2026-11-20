# Collaboration acceptance — 21 November 2026

## Problem statement

Four or more people edit shared code, continue offline, and merge on reconnect. Yjs CRDT updates preserve concurrent inserts; explicit user deletion is still deletion. Per-user undo is scoped to local origins. Presence and CodeMirror relative cursors are shared separately from document content.

## Automated evidence

- Lint, TypeScript and 78 unit/property tests: access-policy persistence/authorization, four-replica convergence and duplicated/reordered delivery, per-user undo, delete/edit conflict policy, folder mirroring, recovery safety, and UI settings.
- `scripts/collaboration-integration.mjs`: four actual Hocuspocus WebSocket clients; presence; overlapping concurrent text; own undo/redo; two disconnected replicas editing alongside connected peers; a 250 KB document; forged viewer writes; revocation; fresh-client document and access recovery after a host-process restart.
- Integration partitions are configurable through HYDRAS_PARTITION_MS; the release validation includes a 60-second partition.

## Browser evidence

Two isolated Chrome sessions exercised Host, password request, host approval, member presence and live cursor display, a friend's live edit, downgrade to read-only, checkpoint creation and recovery copies. A browser with networking disabled edited text, waited for local saving, reloaded from the offline app cache, and retained its text. After reconnection, the second browser received that text. Network errors during the deliberate outage are expected.

## Implementation coverage

- Host/Join: bundled local server, LAN address selection, invites carrying server address; passwords are shared separately.
- Diagnostics: HTTP reachability and actionable possible causes, without pretending a browser can identify a firewall or router setting conclusively.
- Access: salted password hashes, opaque member tokens stored hashed on the server, pending/editor/viewer/rejected states, server write enforcement and active revocation.
- Recovery: ten local checkpoints and portable JSON backups; recovered copies include Trash and preserve current files.
- Status: local committed-checkpoint status separated from server-delivery status.
- Onboarding: folder ownership and initial import behavior explained; attach retains the current protected room.
- Distribution: portable runtime plus NSIS/MSI desktop installers; manual update link and data-preservation instructions.

## Limits

This is not proof against every network failure, storage failure or edit intention. Four physical laptops and a clean Windows installation still need device acceptance testing. The network integration runs locally; the two-laptop LAN acceptance of the earlier package was performed by the project owner. Native installer build success is distinct from fresh-machine installation testing. Installers are unsigned; WebView2 must be present for fully offline installation. Automatic signed updating and host failover are not included. Keep backups and use project copies for initial testing.
