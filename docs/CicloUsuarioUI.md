# Ciclo de vida del usuario en la interfaz

```mermaid
flowchart LR
  A["① Cargar lote<br/><small>subir o arrastrar un JSON</small>"]
  B["② Procesamiento<br/><small>las filas aparecen a medida que terminan</small>"]
  C["③ Revisar<br/><small>aprobar, editar o rechazar cada candidato</small>"]
  D["④ Guardar cambios<br/><small>Paquete N en OCI</small>"]
  E["⑤ Historial<br/><small>tabla, «Ver activo» y dashboard</small>"]

  A --> B --> C --> D --> E
  D -.->|"quedan pendientes"| C
  E -.->|"nuevo lote"| A

  classDef paso fill:#e0e7ff,stroke:#4f46e5,color:#1e1b4b
  classDef fin fill:#dcfce7,stroke:#16a34a,color:#14532d
  class A,B,C,D paso
  class E fin
```

- "Guardar cambios" solo se habilita cuando el lote terminó de procesarse y no quedan candidatos pendientes.
- El Historial se puede abrir en cualquier momento desde el encabezado.
