"""
Módulo de la interfaz Streamlit HITL (Human-In-The-Loop).
"""

import streamlit as st
from enums import EstadoAprobacion
from pipeline import ejecutar_pipeline
from utils import OUTPUT_FILE, actualizar_activo_persistido, cargar_json


def renderizar_panel_hitl():
    """Renderiza el dashboard de edición y aprobación."""
    st.set_page_config(page_title="Equipo C - HITL", page_icon="✍️", layout="wide")
    st.title("Equipo C · Generación y HITL")
    st.caption("Panel de aprobación humana y revisión de candidatos antes de su consumo por Equipo D.")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("🚀 Generar / Regenerar Candidatos"):
            with st.spinner("Procesando pipeline con Gemini..."):
                resultado = ejecutar_pipeline()
                st.success(f"Se generaron {len(resultado['activos_candidatos'])} candidatos.")
                st.rerun()

    with col2:
        if st.button("🔄 Recargar Datos"):
            st.rerun()

    datos = cargar_json(OUTPUT_FILE)
    activos = datos.get("activos_candidatos", [])

    st.divider()

    if not activos:
        st.info("No hay candidatos persistidos. Pulsa 'Generar' para iniciar.")
        return

    # Contadores
    pendientes = [a for a in activos if a["estado_aprobacion"] == EstadoAprobacion.pendiente.value]
    aprobados = [a for a in activos if a["estado_aprobacion"] == EstadoAprobacion.aprobado.value]
    rechazados = [a for a in activos if a["estado_aprobacion"] == EstadoAprobacion.rechazado.value]

    c1, c2, c3 = st.columns(3)
    c1.metric("Pendientes ⏳", len(pendientes))
    c2.metric("Aprobados ✅", len(aprobados))
    c3.metric("Rechazados ❌", len(rechazados))

    st.divider()

    for idx, activo in enumerate(activos):
        cid = activo["candidato_id"]
        estado = activo["estado_aprobacion"]
        tipo = activo["tipo_activo"]

        with st.expander(
            f"{tipo} | Orig: {activo['interaccion_id']} | Estado: {estado}",
            expanded=(estado == EstadoAprobacion.pendiente.value),
        ):
            st.write(f"**Candidato ID:** `{cid}` | **Categoría:** `{activo['categoria']}`")
            if activo.get("uso_fallback_llm"):
                st.warning("⚠️ Este activo usó fallback debido a un problema con el LLM.")

            contenido = activo["contenido"]
            nuevo_contenido = {}

            # Campos editables en Streamlit
            for k, v in contenido.items():
                if isinstance(v, str):
                    nuevo_contenido[k] = st.text_area(
                        k.replace("_", " ").title(),
                        value=v,
                        key=f"{idx}_{k}_{cid}",
                    )
                else:
                    nuevo_contenido[k] = v

            col_a, col_b, col_c = st.columns(3)
            with col_a:
                if st.button("Guardar Edición 💾", key=f"edit_{cid}"):
                    actualizar_activo_persistido(cid, EstadoAprobacion.pendiente, nuevo_contenido, "usuario_streamlit")
                    st.success("Guardado correctamente.")
                    st.rerun()
            with col_b:
                if st.button("Aprobar ✅", key=f"app_{cid}"):
                    actualizar_activo_persistido(cid, EstadoAprobacion.aprobado, nuevo_contenido, "usuario_streamlit")
                    st.success("Activo aprobado.")
                    st.rerun()
            with col_c:
                if st.button("Rechazar ❌", key=f"rej_{cid}"):
                    actualizar_activo_persistido(cid, EstadoAprobacion.rechazado, nuevo_contenido, "usuario_streamlit")
                    st.warning("Activo rechazado.")
                    st.rerun()