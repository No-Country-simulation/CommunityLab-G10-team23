import { SolicitudProcesamiento } from "@/types/backend";

// Lotes de prueba para demos mientras los lotes no lleguen desde la nube.
export const SAMPLES: { key: string; label: string; data: SolicitudProcesamiento }[] = [
  {
    key: "official",
    label: "Caso oficial",
    data: {
      origen_comunidad: "Discord_Grupo_ONE_G10",
      periodo_referencia: "Semana_04",
      interacciones: [
        {
          autor: "Mariana Souza",
          canal: "#logros-y-empleos",
          tipo: "testimonio",
          texto: "Quedé seleccionada para mi primer empleo de desarrollo gracias al proyecto del hackathon y el apoyo de los mentores.",
        },
        {
          autor: "Lucas Gómez",
          canal: "#dudas-tecnicas",
          tipo: "pregunta",
          texto: "¿Cómo puedo desplegar un contenedor de FastAPI con LangGraph en Oracle Cloud Infrastructure (OCI)?",
        },
        {
          autor: "Comité Organizador",
          canal: "#anuncios",
          tipo: "comunicado",
          texto: "¡Felicitaciones a los más de 20 equipos que lograron conectar el flujo completo de ingesta, clasificación y generación!",
        },
        {
          autor: "Sofía Ramírez",
          canal: "#soporte",
          tipo: "mensaje",
          texto: "Desde ayer no puedo acceder a la plataforma de cursos, me aparece un error al iniciar sesión y tengo entrega mañana.",
        },
        {
          autor: "UsuarioBot",
          canal: "#spam",
          tipo: "test",
          texto: "ok ok 123",
        },
      ],
    },
  },
  {
    key: "empty",
    label: "Lote sin oportunidades",
    data: {
      origen_comunidad: "Discord_Test",
      periodo_referencia: "Semana_Test",
      interacciones: [
        {
          autor: "UsuarioBot",
          canal: "#spam",
          tipo: "test",
          texto: "ok ok 123",
        },
      ],
    },
  },
];
