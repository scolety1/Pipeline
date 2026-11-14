# Pipeline

A job-search workflow prototype with application tracking, contacts, statistics, and email-draft generation. The source combines static HTML/JavaScript with Firebase authentication/Firestore and a server-side generation function.

## Start reading

- [Dashboard](js/dashboard.js), [contacts](js/contacts.js), and [statistics](js/stats.js).
- [Draft UI](js/email-generator.js) and [Cloud Function](functions/index.js): input bounds, allowed values, authentication, and rate-limit logic.
- [Function dependencies](functions/package.json) target Node.js 22.

## Current setup boundary

This repository is not a self-contained synthetic demo. The browser configuration and function endpoint need an intentionally configured Firebase project, authentication, database rules, and server-side credentials. Serving the HTML alone does not reproduce protected workflows.

The uploaded `firestone.rules` file is not wired into `firebase.json`, which currently configures only Functions. Authentication, authorization rules, draft generation, and deployed behavior need an isolated end-to-end review before client use. No production services or personal application records were accessed for this documentation update.

Spencer Colety's project; recent work is AI-assisted. No unaided line-authorship claim is made. This README describes implemented source paths, not a production-readiness certification. Do not run deployment scripts against an existing project just to preview the UI.
