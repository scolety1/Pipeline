# Pipeline

A job-search workflow prototype with application tracking, contacts, statistics, and email-draft generation. The source combines static HTML/JavaScript with Firebase authentication/Firestore and a server-side generation function.

## Start reading

- [Dashboard](js/dashboard.js), [contacts](js/contacts.js), and [statistics](js/stats.js).
- [Draft UI](js/email-generator.js) and [Cloud Function](functions/index.js): input bounds, allowed values, authentication, and rate-limit logic.
- [Function dependencies](functions/package.json) target Node.js 22.

## Current setup boundary

This repository is not a self-contained synthetic demo. The browser configuration and function endpoint need an intentionally configured Firebase project, authentication, database rules, and server-side credentials. Serving the HTML alone does not reproduce protected workflows.

The uploaded `firestone.rules` file is not wired into `firebase.json`, which currently configures only Functions. Authentication, authorization rules, draft generation, and deployed behavior need an isolated end-to-end review before client use. No production services or personal application records were accessed for this documentation update.

## Local authorization regression suite

Use Node.js 24 and Java 21 with `npm ci` followed by `npm test`. The explicit `firebase.emulator.json` configuration runs only Firestore, bound to loopback, under `demo-pipeline-rules`; it does not start Functions or call the email-generation provider. The tests refuse a non-loopback database endpoint. The Firebase CLI may download its emulator on first use. If your home cache is unavailable, set the supported `FIREBASE_EMULATORS_PATH` environment variable to a writable local directory.

The contacts page reads and writes `users/{uid}/contacts`. The local rules candidate now grants that exact collection the same owner-only access as applications. Unknown collections, nested contact subcollections, and server-owned email rate-limit records remain denied to clients. These rules still do not validate document field schemas.

This is a local rules repair and synthetic verification, not a live rollout. The production `firebase.json` is intentionally unchanged. Before any real deployment, review the deployed project's current rules and other data paths, preserve existing policies, and obtain deployment approval. Do not start the normal browser app for this test: its Firebase configuration is separate and can refer to live services.

Spencer Colety's project; recent work is AI-assisted. No unaided line-authorship claim is made. This README describes implemented source paths, not a production-readiness certification. Do not run deployment scripts against an existing project just to preview the UI.

