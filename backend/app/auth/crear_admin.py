"""Crea el primer administrador (no hay credenciales por defecto).

Uso dentro del contenedor:
    docker compose exec -it backend python -m app.auth.crear_admin --email ana@ejemplo.com --nombre "Ana"

Pide la contraseña de forma interactiva. Para automatizarlo, pásala por la entrada estándar:
    printf '%s' "$CLAVE" | docker compose exec -T backend python -m app.auth.crear_admin \\
        --email ana@ejemplo.com --nombre "Ana" --password-stdin
"""

import argparse
import getpass
import re
import sys

from app.auth.service import Conflicto, crear_usuario
from app.contracts.auth import EMAIL_PATTERN, PASSWORD_MAX, PASSWORD_MIN, RolUsuario


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Crea una cuenta de administrador.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--password-stdin", action="store_true", help="Lee la contraseña de la entrada estándar")
    args = parser.parse_args(argv)

    if not re.match(EMAIL_PATTERN, args.email):
        print("El correo no es válido.", file=sys.stderr)
        return 1

    if args.password_stdin:
        password = sys.stdin.read().rstrip("\n")
    else:
        password = getpass.getpass("Contraseña: ")
        if password != getpass.getpass("Repite la contraseña: "):
            print("Las contraseñas no coinciden.", file=sys.stderr)
            return 1

    if not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
        print(f"La contraseña debe tener entre {PASSWORD_MIN} y {PASSWORD_MAX} caracteres.", file=sys.stderr)
        return 1

    try:
        usuario = crear_usuario(args.email, args.nombre, RolUsuario.admin, password)
    except Conflicto as error:
        print(error.detail, file=sys.stderr)
        return 1

    print(f"Administrador creado: {usuario.email} ({usuario.id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
