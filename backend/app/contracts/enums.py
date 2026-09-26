from enum import Enum


class AssetCategory(str, Enum):
    success_story = "SUCCESS_STORY"
    faq = "FAQ"
    educational_content = "EDUCATIONAL_CONTENT"
    social_post = "SOCIAL_POST"
    community_highlight = "COMMUNITY_HIGHLIGHT"
    support_alert = "SUPPORT_ALERT"
    ignore = "IGNORE"


class TipoActivoOficial(str, Enum):
    post_linkedin = "post_linkedin"
    destaque_newsletter_semanal = "destaque_newsletter_semanal"
    sugerencia_contenido_faq = "sugerencia_contenido_faq"


class EstadoAprobacion(str, Enum):
    pendiente = "pendiente"
    aprobado = "aprobado"
    rechazado = "rechazado"


class EstadoRespuesta(str, Enum):
    exito = "exito"


class EstadoAlmacenamientoOCI(str, Enum):
    guardado_con_exito = "guardado_con_exito"


__all__ = [
    "AssetCategory",
    "TipoActivoOficial",
    "EstadoAprobacion",
    "EstadoRespuesta",
    "EstadoAlmacenamientoOCI",
]
