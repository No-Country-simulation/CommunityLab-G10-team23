# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

CommunityLab (Grupo 10, Equipo 23) converts community-interaction data (Discord, CSV, forms, GitHub) into structured analysis and, eventually, human-reviewed content assets (LinkedIn posts, newsletter highlights, FAQ suggestions). It is built as a **modular monolith**: a single FastAPI backend contains the pipeline phases as Python modules/routers, not separate microservices. Four conceptual "teams" (A–D) own successive phases of one pipeline:

- **Team A** — ingestion, validation, per-interaction LLM analysis (`app/ai`, `app/api/v1/ingestion.py`).
- **Team B** — classification, relevance scoring, routing (`app/intelligence`, `app/workflow/classification_graph.py`).
- **Team C** — content generation and human-in-the-loop (HITL) review (`app/content`, `app/api/v1/review.py`).
- **Team D** — final package assembly and OCI Object Storage persistence (planned; `armar_respuesta_externa` in `app/contracts/models.py` is the only piece implemented so far).

Only the ingestion→analysis→classification→generation chain is wired together end to end (via `app/workflow/pipeline.py` and `POST /api/v1/pipeline/process`). OCI storage, the Streamlit dashboard, and RAG are not implemented — `frontend/app.py` is a placeholder that prints a message and exits.

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
docker compose up --build backend     # start backend on :8000 (frontend is a no-op placeholder)
docker compose exec backend python -m pytest -q
curl http://localhost:8000/health
```

- API docs: `http://localhost:8000/docs` (Swagger) and `/redoc`.
- Tests never require real credentials: LLM calls (Gemini via `langchain-google-genai`) are mocked/injected in every test. `GEMINI_API_KEY` is read from `.env` at the repo root; without it, analysis/generation fall back to degraded/neutral results instead of raising.
- `GEMINI_MODEL` is optional (defaults to a Gemini flash model); the LLM client is built lazily so the app starts without a key.

## Architecture

### Request flow

`backend/app/main.py` builds the FastAPI app and registers three routers:

| Prefix | Router module | Purpose |
| --- | --- | --- |
| `/api/v1/ingest` | `app/api/v1/ingestion.py` | Team A only: validate a batch, run LLM analysis per interaction, return analysis (no classification/generation). |
| `/api/v1/pipeline` | `app/api/v1/pipeline.py` → `app/workflow/pipeline.py::process_batch` | Full orchestration: Team A analysis → Team B classification graph → Team C generation, per interaction. |
| `/api/v1/review` | `app/api/v1/review.py` | HITL: list/patch generated asset candidates (`estado_aprobacion`, `contenido`) stored by Team C. |

`process_batch` is the one place that wires A→B→C together. For each interaction it: builds an `InteraccionInterna`, calls `analyze_interaction` (falls back to a neutral `AnalisisInterno` + `degradado=True` on failure), invokes the Team B LangGraph classification graph, and — if routed to content generation — calls `generate_assets` and persists candidates via `upsert_generation_result`. Failures at any stage are captured per-item in an `error` string and do **not** abort the rest of the batch; isolate-failures-per-item is the pattern to preserve when touching this function.

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
- `repository.py`: a simple JSON-file store (`backend/data/activos_candidatos.json`) standing in for real persistence — writes via a temp-file + `os.replace` for atomicity. `upsert_generation_result` is keyed by `candidato_id`; `update_asset` is used by the review endpoint to set approval status and optionally edit content before approval.

This JSON file store is a stopgap for Team D's planned OCI persistence — don't assume it's durable/production storage when reasoning about data loss or concurrency.

### Adding a new route

Follow the existing pattern (per `README.md`):
1. Add/reuse a Pydantic model in `app/contracts/` (expose it via `app/schemas/` only if it needs a different external/internal shape).
2. Create an `APIRouter` in a new module under `app/api/v1/`, with `response_model` set.
3. Import and `app.include_router(...)` it in `app/main.py` with an explicit `prefix`.
4. Add tests under `backend/tests/api/` using `fastapi.testclient.TestClient`, mocking any external provider (Gemini, OCI) so the suite stays deterministic — cover success, validation errors (422), and simulated dependency failures.

## Known gaps (don't assume these are done)

- The ingestion endpoint (`/api/v1/ingest/process`) does **not** run classification or generation — only `/api/v1/pipeline/process` does.
- No OCI persistence, no Streamlit dashboard, no RAG — these are planned per `docs/CommunityLab - Plan de equipos.md` but not implemented.
- `.env` must never contain real secrets in commits; `GEMINI_API_KEY` is read from the environment only.
