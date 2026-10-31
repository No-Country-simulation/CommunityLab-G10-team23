# Configuración de Credenciales OCI (Equipo D)

Cómo configurar las credenciales de OCI Object Storage en la instancia backend (`instancia-doa`, `164.152.246.126`).

> [!WARNING]
> Versiones anteriores de este documento y de `scripts/setup_oci.sh` incluían la clave privada de la API de OCI. Esa clave debe considerarse **comprometida**: revócala en la consola de OCI (Perfil → API Keys) y configura una nueva siguiendo estos pasos. La clave privada y los identificadores de la cuenta nunca se suben al repositorio. La clave sigue en el historial de Git: cómo limpiarlo y el resto del análisis de seguridad están en [Guia_Despliegue_OCI.md](Guia_Despliegue_OCI.md#seguridad-del-despliegue). Allí también se recomienda crear la clave para un usuario de servicio con permisos mínimos, o usar instance principals sin claves.

---

## 1. Generar la clave en la consola de OCI

Perfil → **API Keys** → **Add API Key** → *Generate API key pair*. Descarga la clave privada (`.pem`) y copia el fragmento de configuración que muestra la consola en un archivo llamado `config`.

## 2. Copiar los archivos a la instancia

Desde tu equipo:

```bash
scp oci_api_key.pem config opc@164.152.246.126:/tmp/
ssh opc@164.152.246.126 "bash ~/CommunityLab-G10-team23/scripts/setup_oci.sh /tmp/oci_api_key.pem /tmp/config && rm -f /tmp/oci_api_key.pem /tmp/config"
```

El script deja los archivos en `~/.oci` con permisos `600` y ajusta la línea `key_file` a:

```ini
key_file=/home/opc/.oci/oci_api_key.pem
```

Docker Compose monta `/home/opc/.oci` dentro del contenedor en modo solo lectura, así que el backend encuentra la configuración sin pasos adicionales.

## 3. Reiniciar y verificar

```bash
cd ~/CommunityLab-G10-team23
docker compose up -d --force-recreate backend
python3 -c "import oci; c = oci.config.from_file(); client = oci.object_storage.ObjectStorageClient(c); print('OCI Conectado! Namespace:', client.get_namespace().data)"
curl http://localhost:8000/api/v1/storage/packages
docker compose logs backend | grep "OCI Storage"
```

Resultado esperado: `OCI Conectado! Namespace: axrmv8bsyp2r`, y en el log `[OCI Storage] Conectado exitosamente…`. Si el log dice `Usando almacenamiento Mock local`, el backend no encontró las credenciales y está guardando los paquetes en disco, no en OCI.
