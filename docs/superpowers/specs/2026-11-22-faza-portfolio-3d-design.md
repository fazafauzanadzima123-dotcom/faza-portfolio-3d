# Design Spec: Faza Fauzan Adzima Full-Stack 3D Portfolio (`faza-portfolio-3d`)

Date: 2026-11-22
Status: Approved by user via `/grill-me` and architecture review

## 1. Intent & Goals
Build a professional, full-stack portfolio website for **Faza Fauzan Adzima** (student, web developer, and cybersecurity practitioner) in Indonesian, themed in bold red and black ("berani") with a real-time 3D dragon background, hosted on GitHub and Vercel with Supabase persistence.

### Non-Goals & Anti-Goals
- No fabricated metrics, fake testimonials, invented certifications, or synthetic profile avatars.
- No Unicode em dashes (U+2014), AI marketing clichés, or cookie-cutter SaaS template sections.
- No SSRF vulnerabilities or leaked secret keys in client bundles or API endpoints.

## 2. Architecture (Approach A: Single Polyglot Vercel Project)
- **Frontend (`public/`)**: Static HTML5, modern CSS3, and Vanilla ES Modules (`public/js/app.js`, `public/js/dragon3d.js` using Three.js ESM from jsDelivr CDN).
- **JavaScript Backend (`api/*.js`, Node.js 24 Fluid Compute)**:
  - `GET /api/health`: Runtime and Supabase configuration readiness check.
  - `GET /api/portfolio`: Fetches published projects, achievements, and recent sanitized security scan records from Supabase PostgreSQL.
  - `POST /api/contact`: Validates contact form payload, checks honeypot and rate-limit, hashes source IP with SHA-256, and invokes Supabase `submit_contact_message` RPC.
- **Python Backend (`api/*.py`, Python 3.12 Runtime)**:
  - `GET /api/security_check`: Returns recent sanitized scan history from Supabase.
  - `POST /api/security_check`: Validates HTTPS target domain, blocks private/loopback/link-local/metadata IP ranges (anti-SSRF across DNS + redirects), inspects 6 core HTTP security headers (`Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` / CSP `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`), scores 0-100 (Grades A-F), writes sanitized summary to Supabase `record_security_scan` RPC, and returns detailed Indonesian guidance.
  - `GET /api/export_cv?format=md|json`: Generates clean Indonesian CV export backed by Supabase live data.
- **Database (`supabase/schema.sql`)**:
  - `projects`, `achievements`, `contact_messages`, `security_scans`.
  - Strict RLS enabled on every table: public read on `projects`, `achievements`, and `security_scans`; zero public read/write on `contact_messages`; validated writes exclusively via `SECURITY DEFINER` RPC functions (`submit_contact_message`, `record_security_scan`).

## 3. Verification & Quality Gates
- **TDD**: Automated unit and handler suites (`node --test tests/js/api.test.js` and `python -m unittest discover -s tests/py -v`) written before implementation (RED -> GREEN -> REFACTOR).
- **Antislop & AI Writing**: `DURING` mode enforced across all 6 antislop modules, `contrast-check.py`, `avoid-ai-writing/detector/patterns.js`, and mandatory Delivery Gate Blocks 1-4.
- **Browser & Live Production Verification**: Local server tested across desktop (`1440x900`), tablet (`768x1024`), and mobile (`390x844`) viewports, followed by live production verification on Vercel + Supabase.
