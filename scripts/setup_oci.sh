#!/usr/bin/env bash
# Instala las credenciales de OCI en la VM del backend a partir de archivos locales.
#
# Uso (en la VM, después de copiar los archivos con scp):
#   bash scripts/setup_oci.sh <ruta/oci_api_key.pem> <ruta/config>
#
# La clave privada y el archivo config NUNCA se versionan en el repositorio.
# Si usas instance principals (docs/Guia_Despliegue_OCI.md, paso 1, opción B)
# no necesitas este script.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Uso: $0 <oci_api_key.pem> <config>" >&2
  exit 1
fi

KEY_SRC="$1"
CONFIG_SRC="$2"
OCI_DIR="$HOME/.oci"

for f in "$KEY_SRC" "$CONFIG_SRC"; do
  [ -f "$f" ] || { echo "No existe el archivo: $f" >&2; exit 1; }
done

echo "=== Configurando credenciales de OCI Object Storage ==="
mkdir -p "$OCI_DIR"
chmod 700 "$OCI_DIR"

install -m 600 "$KEY_SRC" "$OCI_DIR/oci_api_key.pem"
install -m 600 "$CONFIG_SRC" "$OCI_DIR/config"

# key_file debe apuntar a la ruta dentro de la VM (el contenedor monta la misma ruta).
sed -i "s|^key_file=.*|key_file=$OCI_DIR/oci_api_key.pem|" "$OCI_DIR/config"

echo "=== Credenciales de OCI configuradas ==="
ls -la "$OCI_DIR"
echo "Borra las copias temporales de la clave que hayas subido: rm -f \"$KEY_SRC\""
