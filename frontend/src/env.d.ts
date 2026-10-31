declare namespace App {
  interface Locals {
    /** Usuario con sesión válida (lo resuelve src/middleware.ts). */
    user: import("./types/auth").Usuario | null;
    /** Token opaco de la sesión; solo vive en el servidor y en la cookie httpOnly. */
    token: string | null;
  }
}
