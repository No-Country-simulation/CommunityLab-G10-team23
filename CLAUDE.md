# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Community IA (Grupo 10, Equipo 23) converts community-interaction data (Discord, CSV, forms, GitHub) into structured analysis and, eventually, human-reviewed content assets (LinkedIn posts, newsletter highlights, FAQ suggestions). It is built as a **modular monolith**: a single FastAPI backend contains the pipeline phases as Python modules/routers, not separate microservices. Four conceptual "teams" (A–D) own successive phases of one pipeline:

- **Team A** — ingestion, validation, per-interaction LLM analysis (`app/ai`, `app/api/v1/ingestion.py`).
- **Team B** — classification, relevance scoring, routing (`app/intelligence`, `app/workflow/classification_graph.py`).
- **Team C** — content generation and human-in-the-loop (HITL) review (`app/content`, `app/api/v1/review.py`).
- **Team D** — final package assembly and OCI Object Storage persistence (`app/storage/service.py::publicar_lote`, exposed as admin-only `POST /api/v1/storage/publish`).

Only the ingestion→analysis→classification→generation chain is wired together end to end (via `app/workflow/pipeline.py`, exposed synchronously as `POST /api/v1/pipeline/process` and as background jobs via `POST /api/v1/pipeline/jobs` + `GET /api/v1/pipeline/jobs/{id}?desde=n`, which the frontend uses), and reviewed lots are published to OCI via `POST /api/v1/storage/publish {lote_id}`. RAG is not implemented. `frontend/` is an Astro app (server output, Node adapter) with one React island for the HITL review inbox, and BFF proxy endpoints under `src/pages/api/`. Frontend code is organized by feature: `src/features/<review|history|team|landing>/` hold each screen's components and React-free logic, `src/components/{ui,shared,layout}/` hold pieces reused across features, `src/lib/server/` is server-only (BFF, session, env) and `src/lib/client/` browser-only; styles are split under `src/styles/` with `tokens.css` as the only source of colors and `theme-dark.css` for dark mode. Imports use the `@/` alias. `src/middleware.ts` requires a session on every page and `/api/*` route (the backend token lives in the `cia_session` httpOnly cookie and the BFF forwards it as `Bearer`); simulated data is only used with `DEMO_MODE=true`. See `frontend/README.md`.

Read `docs/Architecture.md` and `docs/DataContract.md` before changing contracts or adding a phase — they describe the agreed module boundaries and the external-vs-internal contract split in more depth than this file.

## Commands

All commands run from `backend/`.

```bash
# Setup
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt

# Run the full test suite
python -m pytest -q

# Run a single test file / test
python -m pytest tests/workflow/test_pipeline.py -q
python -m pytest tests/workflow/test_pipeline.py::test_name -q

# Run the backend locally without Docker
uvicorn app.main:app --reload
```

Docker (from the repo root):

```bash
docker compose up --build             # production config: backend on :8000 + Astro frontend on :3000
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build   # local dev: mounted code + uvicorn --reload
docker compose up --build backend     # backend only
docker compose exec backend python -m pytest -q
curl http://localhost:8000/health
```

- API docs: `http://localhost:8000/docs` (Swagger) and `/redoc`.
- Tests never require real credentials: LLM calls (Gemini via `langchain-google-genai`) are mocked/injected in every test. `GEMINI_API_KEY` is read from `.env` at the repo root; without it, analysis/generation fall back to degraded/neutral results instead of raising.
- `GEMINI_MODEL` is optional (defaults to a Gemini flash model); the LLM client is built lazily so the app starts without a key.

## Architecture

### Request flow

`backend/app/main.py` builds the FastAPI app (`create_app()`), exposes `/` and `/health`, and mounts `app/api/v1/router.py::api_router` under `/api/v1`. `router.py` is the single place where each v1 router gets its prefix, tag and minimum role. Every route except `/health` and the public `/auth` endpoints (login, registro, restablecer) requires a session (see "Authentication" below):

| Prefix | Router module | Purpose |
| --- | --- | --- |
| `/api/v1/auth` | `app/api/v1/auth.py` | Login, logout, `me`, registration with an invitation token, password reset with a recovery token. |
| `/api/v1/usuarios` | `app/api/v1/usuarios.py` | Admin only: list users, change role/active flag, create/revoke invitations, create recovery links. |
| `/api/v1/ingest` | `app/api/v1/ingestion.py` | Team A only: validate a batch, run LLM analysis per interaction, return analysis (no classification/generation). |
| `/api/v1/pipeline` | `app/api/v1/pipeline.py` → `app/workflow/pipeline.py::process_batch` | Full orchestration: Team A analysis → Team B classification graph → Team C generation, per interaction. |
| `/api/v1/review` | `app/api/v1/review.py` | HITL: list/patch generated asset candidates (`estado_aprobacion`, `contenido`) stored by Team C. |

`iter_batch` is the one place that wires A→B→C together; it yields one `ResultadoPipelineItem` per interaction as soon as it finishes, and `process_batch` just collects it. `iter_batch` persists nothing. `app/workflow/jobs.py` runs it in a background thread (one batch at a time behind a lock; assumes a single Uvicorn worker) and stores each lot and each finished item in `app.db` through `app/workflow/repository.py`, so lots survive restarts. On startup, `main.py`'s lifespan marks lots left `en_cola`/`en_proceso` as `fallido`, and their analysed items are kept. For each interaction `iter_batch` builds an `InteraccionInterna` and calls `analyze_interaction`, which falls back to a neutral `AnalisisInterno` + `degradado=True` on failure. It then invokes the Team B LangGraph classification graph and, if the item is routed to content generation, calls `generate_assets`. Failures at any stage are captured per-item in an `error` string and do **not** abort the rest of the batch; isolate-failures-per-item is the pattern to preserve when touching this function.

### Authentication (`app/auth/`, contracts in `app/contracts/auth.py`)

- Users, sessions and invitations live in SQLite (`backend/data/auth.db`, path overridable with `AUTH_DB_PATH`); `app/auth/db.py` opens one connection per operation.
- Sessions are opaque random tokens sent as `Authorization: Bearer`; only their SHA-256 is stored. They expire after 12 h idle (sliding) and 7 days max. Logout, deactivation, role change and password reset delete the user's sessions.
- Passwords use argon2id with OWASP-minimum parameters (sized for the 1 GB OCI VMs). Login failures are rate-limited per email in process memory (5 per 15 min, same single-worker assumption as jobs); per-IP limiting belongs to the BFF.
- Roles are hierarchical `admin > revisor > lector`; protect routes with `requiere_lector` / `requiere_revisor` / `requiere_admin` from `app/auth/dependencies.py`. Ingest, pipeline and review need `revisor`; publishing to OCI needs `admin`; reading storage needs `lector`.
- Authorship (`Autoria{usuario_id, nombre, en}`) always comes from the session via the `autor_actual` dependency — never from a request body.
- Registration is invitation-only (no open sign-up). The first admin is created with `python -m app.auth.crear_admin --email … --nombre …`; there are no default credentials.
- `tests/conftest.py` points `AUTH_DB_PATH` at a temp file and overrides `usuario_actual` with a fake admin for all tests; `tests/auth/conftest.py` disables that override to test the real flow.

### Team B classification graph (`app/workflow/classification_graph.py`)

A LangGraph `StateGraph` with nodes `classify → (retry | fallback | score) → route`:
- `classify`: asks the LLM classifier (`app/intelligence/llm_classifier.py`) for a `PropuestaClasificacion` (category + confidence + justification). Retries once (`MAX_LLM_ATTEMPTS = 2`) on exception before falling back.
- `fallback`: deterministic keyword/intent-based classification (`app/intelligence/classifier.py::classify_analysis`) when the LLM is unavailable.
- `score`: re-runs the deterministic classifier if LLM confidence is below `CONFIDENCE_THRESHOLD = 0.75`, then computes `relevance_score` (0–100) via `app/intelligence/scorer.py`.
- `route`: maps the final `AssetCategory` to a route string (`equipo_c.generar_activos`, `equipo_c.revision_prioritaria`, or `flujo.descartar`) and builds the `ResultadoAnalisisInterno`.

`AssetCategory` (in `app/contracts/enums.py`) is the shared taxonomy: `SUCCESS_STORY`, `FAQ`, `EDUCATIONAL_CONTENT`, `SOCIAL_POST`, `COMMUNITY_HIGHLIGHT`, `SUPPORT_ALERT`, `IGNORE`. Only interactions routed to `equipo_c.generar_activos` reach content generation.

### Contracts (`app/contracts/`)

`app/contracts/models.py` and `enums.py` are the canonical, shared Pydantic models/enums — every team imports from here rather than redefining types locally. `app/schemas/external.py` and `app/schemas/internal.py` re-export subsets of these models to describe, respectively, the **official external contract** (what API clients send/receive) and **internal contracts** (extra metadata/fields used for cross-phase traceability, e.g. ids, timestamps, scores, routing).

Keep this external/internal distinction intact: the external request/response models (`SolicitudProcesamiento`, `RespuestaProcesamiento`, `ActivosDistribucion`, with only `post_linkedin` / `destaque_newsletter_semanal` / `sugerencia_contenido_faq` as official asset keys) must stay decoupled from internal-only fields (`InteraccionInterna.id`/`timestamp`, `OportunidadInterna`, `EnrutamientoInterno`, `ActivoCandidato.candidato_id`). The source field `tipo` on an interaction is free text from the origin channel and must never be treated as a trusted classification — sentiment/topics/entities/intent/category are always derived from `texto`.

`armar_respuesta_externa` (Team B→D handoff) picks, per official asset type, the highest-`relevance_score` **approved** (`EstadoAprobacion.aprobado`) candidate; unapproved candidates are excluded, and a type with no approved candidate is omitted from serialization rather than null-filled.

### Content generation and HITL review (`app/content/`)

- `generator.py::generate_assets`: for interactions routed to `equipo_c.generar_activos`, picks which official asset formats to produce based on `AssetCategory` (see `_formats_for`), asks the Gemini LLM for structured `GeneratedContent`, and falls back to template-based content (`_fallback_content`) if the LLM call fails or no key is configured. Every candidate starts as `EstadoAprobacion.pendiente`.
- `repository.py`: candidates and their review history in SQLite (`app.db`).
  - `update_asset` stamps `revisado_por` and bumps `version`, and appends an `EventoRevision` (`GET /review/assets/{id}/historial`).
  - It raises `ConflictoVersion` when the client's `version` is stale and `LotePublicadoError` once the lot is published. Both map to 409.

### Team review and publishing (`app/persistence/db.py`, `app/workflow/repository.py`, `app/storage/service.py`)

- Lots belong to the team, not to the uploader: any `revisor` can open any unpublished lot (`GET /pipeline/jobs?sin_publicar=true`) and approve or reject its candidates.
- Changes are allowed only until the lot is published.
- Admins can delete an unpublished, finished lot with `DELETE /pipeline/jobs/{id}`, which cascades to its items, candidates and review events. Lots that are processing or published return 409.
- `app.db` (`APP_DB_PATH`, default `backend/data/app.db`) is separate from `auth.db`. It uses WAL mode with tables `lotes`, `items_lote`, `candidatos` and `eventos_revision`.
- Authorship is stored as `usuario_id` plus a name snapshot, with no FK to users.
- Schema changes go in as a new entry in `_MIGRACIONES` (tracked by `PRAGMA user_version`). Never edit an applied migration.
- `publicar_lote(lote_id, autor)` reads approvals from the DB, never from the client, and refuses lots still processing or already published (409).
  - It uploads the package with an internal `auditoria` block (procesado_por, publicado_por, revisores) and closes the lot.
  - The external `RespuestaProcesamiento` is unchanged.

### Adding a new route

Follow the existing pattern (per `README.md`):
1. Add/reuse a Pydantic model in `app/contracts/` (expose it via `app/schemas/` only if it needs a different external/internal shape).
2. Create an `APIRouter` in a new module under `app/api/v1/`, with `response_model` set.
3. Register it in `app/api/v1/router.py` with `api_router.include_router(...)`, giving its `prefix`, `tags` and role dependency there (not in `app/main.py`).
4. Add tests under `backend/tests/api/` using `fastapi.testclient.TestClient`, mocking any external provider (Gemini, OCI) so the suite stays deterministic — cover success, validation errors (422), and simulated dependency failures.

## Known gaps (don't assume these are done)

- The ingestion endpoint (`/api/v1/ingest/process`) does **not** run classification or generation — only `/api/v1/pipeline/process` and `/api/v1/pipeline/jobs` do.
- No RAG yet; it is planned per `docs/CommunityLab - Plan de equipos.md` but not implemented. OCI falls back to a local mock bucket (`backend/data/oci_mock`) when no OCI credentials are configured.
- `.env` must never contain real secrets in commits; `GEMINI_API_KEY` is read from the environment only.
