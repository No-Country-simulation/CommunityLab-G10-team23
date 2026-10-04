"""
Punto de entrada oficial de la aplicación.
"""

import sys
from hitl import renderizar_panel_hitl
from pipeline import ejecutar_pipeline

if __name__ == "__main__":
    # Permite ejecutarlo por CLI o por interfaz gráfica
    if len(sys.argv) > 1 and sys.argv[1] == "--cli":
        print("Ejecutando pipeline por consola...")
        res = ejecutar_pipeline()
        print(f"Listo! Se generaron {len(res['activos_candidatos'])} candidatos.")
    else:
        renderizar_panel_hitl()