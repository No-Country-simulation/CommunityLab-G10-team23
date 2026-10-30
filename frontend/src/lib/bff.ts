// Utilidades del BFF (solo servidor): los endpoints de src/pages/api/* reenvían a FastAPI.

// Se lee en cada petición para respetar el BACKEND_URL del contenedor en tiempo de ejecución.
export const backendUrl = () => process.env.BACKEND_URL || "http://localhost:8000";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
