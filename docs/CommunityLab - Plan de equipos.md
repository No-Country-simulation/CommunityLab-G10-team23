# CommunityLab — Plan de equipos (Grupo 10)

## Resumen ejecutivo

CommunityLab es un MVP de motor de inteligencia comunitaria: toma interacciones dispersas en Discord, formularios, CSV o GitHub, las analiza con un LLM y las convierte en activos de marketing (posts, newsletters, FAQs) con revisión humana antes de publicarse, persistiendo todo en OCI Object Storage.

Este documento junta dos análisis que ya se hicieron del proyecto: uno más ajustado al enunciado oficial, y una versión más extensa con diagramas C4, contratos de datos y un desglose semana a semana. No coinciden en todo. Donde difieren, se señala en la sección "Análisis crítico", con cuál queda y por qué. Esta es la versión de referencia para los 4 equipos: si algo cambia después, se edita aquí, no en una copia aparte.

## Arquitectura y decisiones de diseño

**Decisión: monolito modular, no microservicios.** Un backend (FastAPI) con módulos internos por fase, un frontend (Streamlit) para HITL y dashboard, y OCI Object Storage como persistencia externa. Con 4 equipos de 2 personas y 5 semanas, separar cada fase en un microservicio agrega coordinación de despliegue que nadie necesita: la separación de responsabilidades se logra con módulos de Python bien delimitados, no con contenedores independientes.

### Componentes

| Componente               | Contiene                                                         | Tecnología               |
| ------------------------ | ---------------------------------------------------------------- | ------------------------ |
| `backend/ingestion`      | Adaptadores de fuente, validación, normalización                 | FastAPI, Pydantic        |
| `backend/ai`             | Cliente LLM, prompts, análisis                                   | LangChain                |
| `backend/intelligence`   | Clasificador, relevance scorer                                   | Python + reglas          |
| `backend/workflow`       | Router, estado del flujo                                         | LangGraph                |
| `backend/content`        | Generadores por canal (LinkedIn, newsletter, FAQ, success story) | LangChain                |
| `backend/storage`        | Cliente de OCI Object Storage                                    | OCI SDK                  |
| `backend/rag` (opcional) | Retriever, embeddings, generador                                 | Chroma/FAISS + LangChain |
| `frontend`               | Dashboard + panel HITL                                           | Streamlit                |

### Docker

Dos contenedores reales, uno opcional:

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
  frontend:
    build: ./frontend
    ports: ["8501:8501"]
    environment:
      BACKEND_URL: http://backend:8000
    depends_on: [backend]
  # vector-db: solo si se construye el RAG diferencial
```

No hay `ingestion-container`, `llm-container`, `router-container` ni `content-container` por separado: son módulos de `backend`, no servicios.

## Contrato de datos

Este contrato tiene dos capas, y hay que distinguirlas para no confundir a los 4 equipos:

- **Contrato externo (oficial):** el que expone el endpoint `/process` hacia afuera, exactamente como lo define el documento del hackathon. Es el que se demuestra y se evalúa.
- **Contrato interno (entre equipos):** lo que se pasan Equipo A → B → C → D. No lo ve nadie fuera del sistema, así que puede llevar más campos (`id`, `timestamp`, `categoria`, `relevance_score`, `ruta`) que el formato externo no pide, porque el pipeline sí los necesita para funcionar. Equipo D traduce el resultado interno al formato externo antes de responder.

Sin esta separación, seguir el formato oficial al pie de la letra bloquea la trazabilidad interna (sin ids no se puede saber qué interacción generó qué activo). Con la separación, se cumple el formato pedido de cara afuera sin perder esa trazabilidad de cara adentro.

### Entrada — contrato externo (oficial, lo que recibe Equipo A)

```json
{
  "origen_comunidad": "Discord_Grupo_ONE_G10",
  "periodo_referencia": "Semana_04",
  "interacciones": [
    {
      "autor": "Mariana Souza",
      "canal": "#logros-y-empleos",
      "tipo": "testimonio",
      "texto": "Comunidad, quedé seleccionada para el puesto de Desarrolladora Junior de IA! El proyecto del curso de LangChain y OCI que construí en mi portfolio marcó toda la diferencia en la entrevista técnica. Muy agradecida con la comunidad por todo el apoyo!"
    },
    {
      "autor": "Lucas Albuquerque",
      "canal": "#dudas-langgraph",
      "tipo": "pregunta_tecnica",
      "texto": "Tengo dudas sobre cómo estructurar los nodos condicionales en LangGraph cuando la respuesta del LLM necesita reintento. ¿Alguien tiene un ejemplo práctico de router?"
    }
  ]
}
```

`autor` es un string simple, tal como lo define el documento oficial (no un objeto `{id, nombre}`). Si se necesita anonimizar, se hace antes de este punto o Equipo A sustituye el string por un identificador antes de pasarlo al resto del pipeline; el contrato externo no cambia.

`tipo` es un campo de texto libre que probablemente refleja cómo el canal o la fuente etiquetó el mensaje, no una clasificación validada: puede faltar, estar mal puesto, o usar un vocabulario distinto según la fuente (Discord, CSV, GitHub). Equipo A lo propaga sin cambios y lo pasa como contexto al prompt de análisis, pero sigue derivando `sentimiento`, `temas`, `entidades` e `intencion` de forma independiente a partir de `texto`, sin asumir que `tipo` ya resolvió nada. Equipo B tampoco mapea `tipo` directo a `categoria`: sus reglas de clasificación (Fase 3) parten de las salidas del análisis de Equipo A, porque un "testimonio" puede resultar una queja disfrazada de agradecimiento, y una "pregunta_tecnica" recurrente puede merecer EDUCATIONAL_CONTENT en vez de un FAQ puntual.

### Salida — contrato externo (oficial, lo que arma Equipo D)

```json
{
  "status": "exito",
  "resumen_comunidad": {
    "total_interacciones_procesadas": 2,
    "sentimiento_predominante": "Altamente Positivo",
    "temas_principales": ["Contratación / Logros", "LangGraph / Nodos Condicionales"]
  },
  "activos_distribucion_generados": {
    "post_linkedin": {
      "titulo": "De la Comunidad al Mercado: El impacto de los proyectos prácticos de IA",
      "copy": "Nada nos da más orgullo que ver a nuestros talentos conquistando el mercado de tecnología! 🚀\n\nNuestra estudiante Mariana Souza acaba de ser contratada como Desarrolladora Junior de IA tras destacar sus proyectos prácticos desarrollados con LangChain y Oracle Cloud Infrastructure.\n\nHistorias como la de Mariana demuestran que construir soluciones reales es el mejor camino para impulsar la carrera tech. Felicitaciones, Mariana! 👏\n#TalentosTech #InteligenciaArtificial #OracleCloud #CarreraDev",
      "canal_recomendado": "LinkedIn Oficial",
      "potencial_engagement": "Alto"
    },
    "destaque_newsletter_semanal": {
      "seccion": "Logro de la Semana",
      "titular": "Estudiante consigue empleo dev con portfolio de IA en Oracle Cloud",
      "resumen": "Mariana Souza obtuvo su primera oportunidad como Dev Jr de IA destacando proyectos desarrollados durante la formación."
    },
    "sugerencia_contenido_faq": {
      "tema": "Tip Rápido: Cómo crear nodos de reintento en LangGraph",
      "origen": "Duda frecuente planteada por Lucas Albuquerque en el canal de soporte",
      "status": "derivado_a_mentoria"
    }
  },
  "almacenamiento_oci": {
    "bucket": "communitylab-activos-marketing",
    "ruta_objeto": "activos/2026-semana-04/paquete-distribucion.json",
    "status": "guardado_con_exito"
  }
}
```

Las tres claves de `activos_distribucion_generados` son fijas (una única `post_linkedin`, una única `destaque_newsletter_semanal`, una única `sugerencia_contenido_faq`), tal como las define el documento oficial. Esto es una limitación real: si el batch contiene 2 historias de éxito, solo una se convierte en `post_linkedin`. **Regla de desempate (decisión de este documento, el enunciado no la especifica):** para cada clave, Equipo D elige el resultado interno con mayor `relevance_score` dentro de la categoría correspondiente; si ninguna interacción cae en esa categoría, la clave se omite del JSON de salida (no se envía como `null`).

### Estados del ciclo de vida (contrato interno)

```
RECIBIDO → VALIDADO → ANALIZADO → CLASIFICADO → PUNTUADO → ENRUTADO → GENERADO → PENDIENTE_REVISION → (EDITADO) → APROBADO / RECHAZADO → ALMACENADO
                                                                                                                                              ↳ FALLIDO (en cualquier punto)
```

### Modelos Pydantic (contrato externo + contrato interno)

```python
from enum import Enum
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

# ============================================================
# CONTRATO EXTERNO — exactamente como lo define el documento oficial.
# Esto es lo que expone el endpoint /process hacia afuera.
# ============================================================

class InteraccionEntrada(BaseModel):
    autor: str
    canal: str
    tipo: str  # texto libre y no confiable, puede variar segun fuente/canal: se pasa como contexto al LLM de analisis, nunca se usa para mapear "categoria" directamente
    texto: str

class SolicitudProcesamiento(BaseModel):
    origen_comunidad: str
    periodo_referencia: str
    interacciones: List[InteraccionEntrada] = Field(max_length=500)


class ResumenComunidad(BaseModel):
    total_interacciones_procesadas: int
    sentimiento_predominante: str
    temas_principales: List[str]

class PostLinkedIn(BaseModel):
    titulo: str
    copy: str
    canal_recomendado: str = "LinkedIn Oficial"
    potencial_engagement: str

class DestaqueNewsletter(BaseModel):
    seccion: str
    titular: str
    resumen: str

class SugerenciaFAQ(BaseModel):
    tema: str
    origen: str
    status: str = "derivado_a_mentoria"

class ActivosDistribucion(BaseModel):
    post_linkedin: Optional[PostLinkedIn] = None
    destaque_newsletter_semanal: Optional[DestaqueNewsletter] = None
    sugerencia_contenido_faq: Optional[SugerenciaFAQ] = None

class AlmacenamientoOCI(BaseModel):
    bucket: str
    ruta_objeto: str
    status: str

class RespuestaProcesamiento(BaseModel):
    status: str
    resumen_comunidad: ResumenComunidad
    activos_distribucion_generados: ActivosDistribucion
    almacenamiento_oci: AlmacenamientoOCI


# ============================================================
# CONTRATO INTERNO — entre Equipo A → B → C → D.
# No se expone hacia afuera; existe para que el pipeline tenga
# trazabilidad (id, timestamp, categoría, score, ruta) que el
# formato oficial no pide pero el sistema sí necesita.
# ============================================================

class InteraccionInterna(BaseModel):
    id: str  # generado por Equipo A, nunca lo manda el cliente
    autor: str
    canal: str
    tipo: str
    texto: str
    timestamp: datetime  # generado por Equipo A si la fuente no trae uno

class AnalisisInterno(BaseModel):
    sentimiento: str
    sentimiento_score: float  # -1.0 a 1.0
    temas: List[str]
    entidades: List[str]
    resumen: str
    intencion: str  # derivada del texto por el LLM; no depende de "tipo" (puede faltar o venir mal etiquetado desde la fuente)

class AssetCategory(str, Enum):
    success_story = "SUCCESS_STORY"
    faq = "FAQ"
    educational_content = "EDUCATIONAL_CONTENT"
    social_post = "SOCIAL_POST"
    community_highlight = "COMMUNITY_HIGHLIGHT"
    support_alert = "SUPPORT_ALERT"
    ignore = "IGNORE"

class OportunidadInterna(BaseModel):
    categoria: AssetCategory
    relevance_score: float  # 0 a 100

class EnrutamientoInterno(BaseModel):
    ruta: str
    motivo: str

class ResultadoAnalisisInterno(BaseModel):
    interaccion_id: str
    analisis: AnalisisInterno
    oportunidad: OportunidadInterna
    enrutamiento: EnrutamientoInterno


class TipoActivoOficial(str, Enum):
    post_linkedin = "post_linkedin"
    destaque_newsletter_semanal = "destaque_newsletter_semanal"
    sugerencia_contenido_faq = "sugerencia_contenido_faq"

class EstadoAprobacion(str, Enum):
    pendiente = "pendiente"
    aprobado = "aprobado"
    rechazado = "rechazado"

class ActivoCandidato(BaseModel):
    tipo_activo: TipoActivoOficial  # debe coincidir con una clave del contrato externo
    contenido: dict
    estado_aprobacion: EstadoAprobacion = EstadoAprobacion.pendiente

class ResultadoGeneracionInterno(BaseModel):
    interaccion_id: str
    activos_candidatos: List[ActivoCandidato]


def armar_respuesta_externa(
    resultados_analisis: List[ResultadoAnalisisInterno],
    resultados_generacion: List[ResultadoGeneracionInterno],
) -> ActivosDistribucion:
    """Equipo D: por cada clave oficial, elige el candidato aprobado
    con mayor relevance_score. Si no hay ninguno, la clave queda en
    None (se omite del JSON de salida)."""
    scores = {r.interaccion_id: r.oportunidad.relevance_score for r in resultados_analisis}
    candidatos_por_tipo: dict[str, list[tuple[float, ActivoCandidato]]] = {}
    for resultado in resultados_generacion:
        score = scores.get(resultado.interaccion_id, 0)
        for candidato in resultado.activos_candidatos:
            if candidato.estado_aprobacion != EstadoAprobacion.aprobado:
                continue
            candidatos_por_tipo.setdefault(candidato.tipo_activo.value, []).append((score, candidato))

    def ganador(tipo: str):
        opciones = candidatos_por_tipo.get(tipo, [])
        return max(opciones, key=lambda par: par[0])[1].contenido if opciones else None

    return ActivosDistribucion(
        post_linkedin=ganador("post_linkedin"),
        destaque_newsletter_semanal=ganador("destaque_newsletter_semanal"),
        sugerencia_contenido_faq=ganador("sugerencia_contenido_faq"),
    )
```

### Ejemplo paso a paso: dos interacciones a través del pipeline

Este ejemplo sigue las dos interacciones del bloque de entrada oficial (Mariana y Lucas) a través de las cuatro etapas del pipeline. Los campos marcados como internos NO viajan hacia el cliente externo; existen solo entre equipos y se descartan (o se colapsan) al armar la respuesta final.

**Etapa 0 — Lo que recibe Equipo A (contrato externo, oficial):**

```json
{
  "origen_comunidad": "Discord_Grupo_ONE_G10",
  "periodo_referencia": "Semana_04",
  "interacciones": [
    {
      "autor": "Mariana Souza",
      "canal": "#logros-y-empleos",
      "tipo": "testimonio",
      "texto": "Comunidad, quedé seleccionada para el puesto de Desarrolladora Junior de IA! El proyecto del curso de LangChain y OCI que construí en mi portfolio marcó toda la diferencia en la entrevista técnica. Muy agradecida con la comunidad por todo el apoyo!"
    },
    {
      "autor": "Lucas Albuquerque",
      "canal": "#dudas-langgraph",
      "tipo": "pregunta_tecnica",
      "texto": "Tengo dudas sobre cómo estructurar los nodos condicionales en LangGraph cuando la respuesta del LLM necesita reintento. ¿Alguien tiene un ejemplo práctico de router?"
    }
  ]
}
```

**Etapa 1 — Salida de Equipo A → Equipo B (contrato interno; se agregan ****`id`**** y ****`timestamp`****, que el cliente nunca envía):**

```json
[
  {
    "id": "int_9f2a",
    "autor": "Mariana Souza",
    "canal": "#logros-y-empleos",
    "tipo": "testimonio",
    "texto": "Comunidad, quedé seleccionada para el puesto de Desarrolladora Junior de IA! El proyecto del curso de LangChain y OCI que construí en mi portfolio marcó toda la diferencia en la entrevista técnica. Muy agradecida con la comunidad por todo el apoyo!",
    "timestamp": "2026-10-19T14:02:00Z"
  },
  {
    "id": "int_7b31",
    "autor": "Lucas Albuquerque",
    "canal": "#dudas-langgraph",
    "tipo": "pregunta_tecnica",
    "texto": "Tengo dudas sobre cómo estructurar los nodos condicionales en LangGraph cuando la respuesta del LLM necesita reintento. ¿Alguien tiene un ejemplo práctico de router?",
    "timestamp": "2026-10-19T14:05:00Z"
  }
]
```

**Etapa 2 — Salida de Equipo B → Equipo C (contrato interno; análisis + oportunidad + enrutamiento):**

```json
[
  {
    "interaccion_id": "int_9f2a",
    "analisis": {
      "sentimiento": "positivo",
      "sentimiento_score": 0.92,
      "temas": ["contratación", "LangChain", "OCI", "portfolio"],
      "entidades": ["LangChain", "OCI"],
      "resumen": "Egresada consigue empleo como Dev Jr. de IA gracias a un proyecto de portfolio con LangChain y OCI.",
      "intencion": "compartir_logro"
    },
    "oportunidad": { "categoria": "SUCCESS_STORY", "relevance_score": 91.0 },
    "enrutamiento": { "ruta": "equipo_c.generar_activos", "motivo": "Historia de éxito con alto potencial de marketing" }
  },
  {
    "interaccion_id": "int_7b31",
    "analisis": {
      "sentimiento": "neutral",
      "sentimiento_score": 0.05,
      "temas": ["LangGraph", "nodos condicionales", "reintentos"],
      "entidades": ["LangGraph"],
      "resumen": "Pregunta técnica sobre routers y reintentos en LangGraph.",
      "intencion": "solicitar_ayuda"
    },
    "oportunidad": { "categoria": "FAQ", "relevance_score": 68.0 },
    "enrutamiento": { "ruta": "equipo_c.generar_activos", "motivo": "Duda recurrente, útil como contenido educativo" }
  }
]
```

**Etapa 3 — Salida de Equipo C → Equipo D (contrato interno; candidatos por interacción, cada uno con ****`tipo_activo`**** oficial y estado de aprobación tras HITL):**

```json
[
  {
    "interaccion_id": "int_9f2a",
    "activos_candidatos": [
      {
        "tipo_activo": "post_linkedin",
        "contenido": {
          "titulo": "De la Comunidad al Mercado: El impacto de los proyectos prácticos de IA",
          "copy": "Nada nos da más orgullo que ver a nuestros talentos conquistando el mercado de tecnología! 🚀\n\nNuestra estudiante Mariana Souza acaba de ser contratada como Desarrolladora Junior de IA tras destacar sus proyectos prácticos desarrollados con LangChain y Oracle Cloud Infrastructure.\n\nHistorias como la de Mariana demuestran que construir soluciones reales es el mejor camino para impulsar la carrera tech. Felicitaciones, Mariana! 👏\n#TalentosTech #InteligenciaArtificial #OracleCloud #CarreraDev",
          "canal_recomendado": "LinkedIn Oficial",
          "potencial_engagement": "Alto"
        },
        "estado_aprobacion": "aprobado"
      },
      {
        "tipo_activo": "destaque_newsletter_semanal",
        "contenido": {
          "seccion": "Logro de la Semana",
          "titular": "Estudiante consigue empleo dev con portfolio de IA en Oracle Cloud",
          "resumen": "Mariana Souza obtuvo su primera oportunidad como Dev Jr. de IA destacando proyectos desarrollados durante la formación."
        },
        "estado_aprobacion": "aprobado"
      }
    ]
  },
  {
    "interaccion_id": "int_7b31",
    "activos_candidatos": [
      {
        "tipo_activo": "sugerencia_contenido_faq",
        "contenido": {
          "tema": "Tip Rápido: Cómo crear nodos de reintento en LangGraph",
          "origen": "Duda frecuente planteada por Lucas Albuquerque en el canal de soporte",
          "status": "derivado_a_mentoria"
        },
        "estado_aprobacion": "aprobado"
      }
    ]
  }
]
```

**Etapa 4 — Salida de Equipo D (contrato externo, oficial; agregación final por clave, un paquete por periodo):**

Como `post_linkedin` y `destaque_newsletter_semanal` compitieron por Mariana en teoría, pero cada `tipo_activo` solo tuvo un candidato aprobado por clave en este ejemplo, no hubo empate real: cada clave se llena con su único candidato. Si Lucas también hubiera generado un candidato a `post_linkedin`, Equipo D habría comparado los `relevance_score` (91.0 de Mariana vs. el de Lucas) y se habría quedado con el de mayor score.

```json
{
  "status": "exito",
  "resumen_comunidad": {
    "total_interacciones_procesadas": 2,
    "sentimiento_predominante": "Altamente Positivo",
    "temas_principales": ["Contratación / Logros", "LangGraph / Nodos Condicionales"]
  },
  "activos_distribucion_generados": {
    "post_linkedin": {
      "titulo": "De la Comunidad al Mercado: El impacto de los proyectos prácticos de IA",
      "copy": "Nada nos da más orgullo que ver a nuestros talentos conquistando el mercado de tecnología! 🚀\n\nNuestra estudiante Mariana Souza acaba de ser contratada como Desarrolladora Junior de IA tras destacar sus proyectos prácticos desarrollados con LangChain y Oracle Cloud Infrastructure.\n\nHistorias como la de Mariana demuestran que construir soluciones reales es el mejor camino para impulsar la carrera tech. Felicitaciones, Mariana! 👏\n#TalentosTech #InteligenciaArtificial #OracleCloud #CarreraDev",
      "canal_recomendado": "LinkedIn Oficial",
      "potencial_engagement": "Alto"
    },
    "destaque_newsletter_semanal": {
      "seccion": "Logro de la Semana",
      "titular": "Estudiante consigue empleo dev con portfolio de IA en Oracle Cloud",
      "resumen": "Mariana Souza obtuvo su primera oportunidad como Dev Jr. de IA destacando proyectos desarrollados durante la formación."
    },
    "sugerencia_contenido_faq": {
      "tema": "Tip Rápido: Cómo crear nodos de reintento en LangGraph",
      "origen": "Duda frecuente planteada por Lucas Albuquerque en el canal de soporte",
      "status": "derivado_a_mentoria"
    }
  },
  "almacenamiento_oci": {
    "bucket": "communitylab-activos-marketing",
    "ruta_objeto": "activos/2026-semana-04/paquete-distribucion.json",
    "status": "guardado_con_exito"
  }
}
```

Nótese lo que se perdió en el camino a propósito: `id`, `timestamp`, `sentimiento_score`, `categoria` y `estado_aprobacion` no aparecen en la salida oficial. Son metadatos de trabajo interno, no algo que el formato oficial pida. Si el equipo de negocio necesitara auditar por qué se eligió un activo sobre otro, esa trazabilidad vive en los logs/DB internos de Equipo D, no en la respuesta del endpoint.

## Reparto de equipos

| Equipo                                   | Fases          | Enfoque                                                   |
| ---------------------------------------- | -------------- | --------------------------------------------------------- |
| Equipo A · Ingesta y análisis            | 1, 2           | Ingesta + análisis LLM                                    |
| Equipo B · Clasificación, score y router | 3, 4, 5        | Clasificación, score, router                              |
| Equipo C · Generación y HITL             | 6, 7           | Generación de contenido + HITL                            |
| Equipo D · Storage, dashboard y RAG      | Storage, 9, 10 | OCI, dashboard, RAG (diferencial), integración end-to-end |

Cada equipo tiene su propia pestaña (arriba, junto a esta) con roles, entregables semana a semana, Definition of Done y dependencias. La razón detrás de este reparto específico está en la sección "Análisis crítico".

## Cronograma

| Semana | Fechas      | Equipo A                                                | Equipo B                                                    | Equipo C                                     | Equipo D                                                   |
| ------ | ----------- | ------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| 1      | 21/09–27/09 | Esquemas Pydantic, dataset sintético, mocks de análisis | Taxonomía de categorías, fórmula de score, diseño del grafo | Wireframe HITL, few-shot borrador            | Repo, bucket OCI, esqueleto docker-compose, dashboard mock |
| 2      | 28/09–04/10 | Endpoint `/ingest` real, prompt de análisis v1          | Clasificador y scorer contra mocks de A                     | Generación contra input mockeado             | Conectar OCI de verdad, Streamlit en Docker                |
| 3      | 05/10–11/10 | Segunda fuente si da tiempo, pruebas                    | Integración real con A, ajuste de umbrales                  | Integración real con B, panel HITL funcional | Guardar activos reales, primera corrida end-to-end         |
| 4      | 12/10–18/10 | Manejo de errores, dataset final, contract testing      | Reintentos, métricas de evaluación                          | Aprobar/rechazar persistiendo estado         | Dashboard con datos reales, RAG si sobra tiempo            |
| 5      | 19/10–25/10 | Code freeze, documentación                              | Code freeze, documentación                                  | Code freeze, documentación                   | `docker compose up` desde clon limpio, video de respaldo   |

- **Carga de materiales:** hasta el 25/10 — repo final, README, diagrama, video de respaldo, slides.
- **Demo Day 1:** 27/10.
- **Demo Day 2:** 29/10.

El punto que no puede esperar: el contrato de datos (sección anterior) tiene que quedar congelado antes de terminar la semana 1. Sin eso, los equipos B, C y D no pueden empezar en paralelo con mocks en la semana 2.

## Riesgos

| Riesgo                                                                             | Prob. | Impacto | Mitigación                                                                                                                      | Responsable |
| ---------------------------------------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| LLM no disponible                                                                  | Media | Alto    | Mock/fallback preparado desde la semana 1                                                                                       | Equipo B    |
| LLM devuelve JSON inválido                                                         | Alta  | Medio   | Validación con Pydantic + reintento                                                                                             | Equipo B    |
| Dataset insuficiente                                                               | Media | Alto    | Dataset sintético desde la semana 1                                                                                             | Equipo A    |
| Problemas con OCI (cuotas, permisos)                                               | Media | Alto    | Probar el bucket real antes de semana 3                                                                                         | Equipo D    |
| El contrato de datos cambia a mitad de camino                                      | Media | Alto    | Versionado (`schema_version`) + congelarlo en semana 1                                                                          | Todos       |
| Router demasiado complejo                                                          | Media | Medio   | Empezar con reglas simples, LangGraph solo si da tiempo                                                                         | Equipo B    |
| RAG consume tiempo del MVP obligatorio                                             | Alta  | Medio   | Construirlo solo en semana 4, nunca antes                                                                                       | Equipo D    |
| `docker compose up` no funciona en máquina limpia                                  | Media | Alto    | Probarlo desde un clon limpio en semana 1, no en semana 5                                                                       | Equipo D    |
| Integración de las 4 partes demasiado tarde                                        | Alta  | Alto    | Mocks desde semana 1, primera corrida end-to-end en semana 3                                                                    | Todos       |
| Alucinaciones en el contenido generado                                             | Alta  | Alto    | Reglas explícitas de no inventar datos + revisión humana obligatoria                                                            | Equipo C    |
| Desincronización entre las 8 personas (horarios, ausencias)                        | Media | Media   | Reunión corta semanal de los 4 equipos juntos, no solo dentro de cada equipo                                                    | Todos       |
| Solo se guarda 1 activo por categoría en el batch (limitación del formato oficial) | Media | Medio   | Documentar la regla de desempate (mayor relevance_score gana); evaluar con negocio si se necesita más de 1 activo por categoría | Equipo D    |

## Casos de prueba

| #   | Caso              | Input (resumen)                         | Resultado esperado                                                         |
| --- | ----------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Historia de éxito | "Conseguí mi primer trabajo..."         | sentimiento positivo, categoría SUCCESS_STORY, score alto, genera LinkedIn |
| 2   | Pregunta técnica  | "¿Cómo estructuro nodos condicionales?" | categoría FAQ / EDUCATIONAL_CONTENT                                        |
| 3   | FAQ recurrente    | misma pregunta en varias interacciones  | categoría FAQ, alta recurrencia                                            |
| 4   | Feedback positivo | "El curso me ayudó muchísimo"           | positivo, COMMUNITY_HIGHLIGHT / SOCIAL_POST                                |
| 5   | Feedback negativo | "No logro entender..."                  | negativo, posible SUPPORT_ALERT                                            |
| 6   | Irrelevante       | "Hoy llovió muchísimo"                  | score bajo, categoría IGNORE                                               |
| 7   | Logro             | "Terminé mi proyecto"                   | logro detectado, contenido potencial                                       |
| 8   | Alerta de soporte | "Llevo tres días intentando..."         | señal de soporte detectada                                                 |
| 9   | Ambiguo           | "Bueno, al fin..."                      | baja confianza, cae a revisión humana                                      |
| 10  | Fallo del LLM     | LLM no disponible                       | estado FALLIDO registrado, sin corromper el resto del pipeline             |

Cada equipo tiene marcados en su pestaña los casos que más le aplican directamente.

## Checklist final

### MVP obligatorio

- [ ] Ingestión de CSV/JSON en lote
- [ ] Validación con Pydantic
- [ ] Análisis de sentimiento, temas y entidades vía LLM
- [ ] Clasificación en las 7 categorías
- [ ] Relevance score
- [ ] Router condicional
- [ ] Generación de mínimo 2 formatos de contenido
- [ ] Panel Human-in-the-loop (ver, editar, aprobar, rechazar)
- [ ] Almacenamiento en OCI Object Storage (capa Always Free)
- [ ] Mínimo 3 ejemplos de transformación demostrados
- [ ] Repositorio en GitHub con README y diagrama de arquitectura
- [ ] `docker compose up` funcional desde un clon limpio

### Diferenciales (solo si sobra tiempo)

- [ ] RAG / FAQ con vector DB
- [ ] Fuentes reales conectadas (Discord, GitHub, Google Forms)
- [ ] OCI Compute
- [ ] Generación de imágenes para las publicaciones
- [ ] Bot de Discord/Telegram

## Estructura de repositorio y Git

```
communitylab/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── ingestion/
│   │   ├── ai/
│   │   ├── intelligence/
│   │   ├── workflow/
│   │   ├── content/
│   │   ├── storage/
│   │   └── rag/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app.py
│   ├── pages/
│   ├── Dockerfile
│   └── requirements.txt
├── schemas/
│   ├── input.json
│   ├── output.json
│   └── examples/
├── prompts/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── Architecture.md
│   ├── DataContract.md
│   └── Deployment.md
├── docker-compose.yml
├── .env.example
└── README.md
```

### Estrategia de Git

```
main
 └── develop
      ├── feature/equipo-a-ingesta
      ├── feature/equipo-b-router
      ├── feature/equipo-c-generacion
      └── feature/equipo-d-storage
```

Reglas: PR antes de fusionar a `develop`, mínimo una revisión, commits pequeños, nadie modifica el contrato de datos sin avisar a los otros 3 equipos, y todo cambio de esquema actualiza los ejemplos y tests de contrato en `schemas/examples/`.
