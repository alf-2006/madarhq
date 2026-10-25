# Madar — mobile company operations

## Approach
Build the requested system as a genuine Expo Router / React Native / TypeScript mobile application, with a responsive web preview, NativeWind-compatible styling, Express APIs, Drizzle and the supplied persistent managed MySQL database. The user's PostgreSQL/Next.js suggestions are adaptable to the actual tool environment. All screens use the same server records. No static metrics masquerade as real company data; a clearly labelled sample workspace can demonstrate the interface without access to company data or bypassing authentication.

Implement connected outcomes: (1) database, Google OAuth, five-role authorization and employee management; (2) assigned tasks, interactive table, comments, attachments, actual work sessions and manager review; (3) role-scoped dashboards, projects/departments, shared kanban/calendar/timeline views and notification center; (4) derived reports, import/export and polished mobile workflows. Broad advanced requirements remain tracked individually in TODO.md and unresolved features must be disclosed rather than claimed complete.

Google OAuth requires a Google web client ID, client secret and approved administrator email supplied through protected configuration. Real company workspace access remains closed until authentication and employee approval succeed. OAuth uses state binding and server-side exchange, verified Google identity, an expiring application session and disabled-account checks on every request. A separate read-only sample workspace is explicitly labelled, never an invented authenticated user. Database-level relational keys and server-level role/row scopes govern every mutation. Administrators manage all; managers their department/team; employees assigned records; viewers permitted reads only. Approval is never an employee action when required. Timestamps come from the server in UTC and display in company timezone; actual work is summed from separate sessions, not task age. Concurrent timer starts are serialized per employee.

Mobile Metro runs on 8081 and Express on 3000, using supplied runtime public API URLs. Native builds are prepared as source checkpoints and performed in the Dashboard, not inside the sandbox. Google configuration, email provider delivery, native device checks, and production backup operations require external setup. In-app invitations can create approved access records; optional delivery must not be presented as sent email absent an email service. Confidential attachments are accessed only through authorized API downloads; public project assets are not suitable for confidential company uploads.

## Project structure
- `app/`: Expo Router entry, responsive workspace screen and OAuth callback.
- `components/madar/`: app shell, shared Arabic components, dashboard, tasks/views/details, people, projects, reports and settings screens.
- `lib/madar/`: shared types, API client, labelled sample dataset and workspace state.
- `server/madar/`: Google OAuth/session middleware, permissions, validated CRUD APIs, reporting/time logic and seed/export helpers.
- `drizzle/`: users plus departments, employees, projects, tasks, assignments, subtasks, comments, attachments, time sessions, notifications, activities, preferences and settings; committed migrations.
- `tests/`: focused deterministic tests for authorization/workflow/timer calculations; no destructive production tests.
- `assets/`: native launcher/splash icon and bundled Arabic typography.

## Visual direction
Three considered tails: Swiss editorial operations, probability 0.06; warm architectural workspace, probability 0.04; technical monochrome ledger, probability 0.03. Selected: warm architectural workspace.

**Design Movement:** Contemporary editorial product design, borrowing precise wayfinding from architectural studio tools.
**Core Principles:** Arabic-first clarity; one-handed actions; visual restraint; honest and traceable information.
**Color Philosophy:** Warm ivory surfaces and deep forest ink convey calm control; emerald identifies progress and the primary action, amber signals attention, soft red communicates delays without alarm overload.
**Layout Paradigm:** Right-side compact desktop rail with a spacious asymmetric workspace; portrait mobile header, stacked editorial panels and a five-destination bottom dock, with secondary destinations under More.
**Signature Elements:** Open orbital logo, forest welcome panel with subtle orbit outlines, tiny spaced section labels and muted color-coded status pills.
**Interaction Philosophy:** Tap a card to inspect; contextual actions are nearby; creation uses a focused sheet; filters and views retain context; errors never silently discard input.
**Animation:** 160–220ms fade/slide for sheets and navigation, short button press feedback, no continuous decorative animation, reduced motion honored where feasible.
**Typography System:** Bundled Cairo Arabic family for clean Arabic body and semibold headings, system sans for compact Latin numbers; 28–32px primary titles, 18–20px section titles, 13–15px body and 11–12px metadata.
**Brand Essence:** مدار keeps a company's people, tasks and actual work in one clear orbit. Calm, precise, capable.
**Brand Voice:** Brief operational Arabic, not machine-translated slogans. Examples: “كل التفاصيل، في مدار واحد.” and “أرسل للمراجعة”.
**Wordmark & Logo:** Arabic مدار wordmark with an open orbital ring and a square progress marker, repeated as the launcher icon without baked rounded corners.
**Signature Brand Color:** Deep emerald #176B52.
