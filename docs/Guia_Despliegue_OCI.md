# Guía de despliegue en OCI

Paso a paso para crear los ambientes de **backend** y **frontend** de Community IA en Oracle Cloud Infrastructure (capa Always Free), con la arquitectura documentada en [Documentacion_Equipo_D_y_Despliegue_OCI.md](Documentacion_Equipo_D_y_Despliegue_OCI.md). Las opciones marcadas como **[recomendado]** mejoran la seguridad respecto del despliegue original; las demás reproducen lo que ya está documentado. El análisis de vulnerabilidades del despliegue y lo que se corrigió está en [Seguridad del despliegue](#seguridad-del-despliegue); los pasos de esta guía ya incorporan esas correcciones.

## Arquitectura

```
Internet ──:3000──► VM frontend (VM.Standard.E2.1.Micro, Oracle Linux 9)
                     └ Docker: Astro (Node 22) + BFF /api/*
                          │ HTTP :8000 (BACKEND_URL)
                          ▼
                    VM backend (VM.Standard.E2.1.Micro, Oracle Linux 9) ──HTTPS──► API de Gemini
                     └ Docker: FastAPI + LangGraph
                          │ SDK de OCI
                          ▼
                    Object Storage: bucket communitylab-activos-marketing (privado)
```

- El navegador solo habla con el frontend. El frontend reenvía las llamadas `/api/*` al backend (patrón BFF), así que no hay problemas de CORS.
- El backend analiza con Gemini y guarda los paquetes aprobados en Object Storage.
- Región documentada: `sa-vinhedo-1` (Brasil Este - Vinhedo).

| Recurso | Nombre sugerido | Notas |
| :--- | :--- | :--- |
| Compartimento | `communityia` | Agrupa todos los recursos |
| VCN | `communityia-vcn` | Creada con el asistente *VCN with Internet Connectivity* |
| Instancia frontend | `communityia-frontend` | Puerto 3000 |
| Instancia backend | `communityia-backend` | Puerto 8000 |
| Bucket | `communitylab-activos-marketing` | Nombre actual del bucket; se conserva para no romper el almacenamiento |

> La capa Always Free permite **dos** instancias `VM.Standard.E2.1.Micro` por tenancy. Esta arquitectura usa las dos.

---

## Paso 0. Requisitos previos

- Cuenta de OCI con Always Free y región principal `sa-vinhedo-1`.
- Un par de claves SSH (`ssh-keygen -t ed25519`).
- Una clave de Google Gemini (`GEMINI_API_KEY`).
- La URL del repositorio.
- **Antes que nada, revoca la clave de API filtrada.** Hasta esta revisión, `scripts/setup_oci.sh` contenía una clave privada de OCI y los OCID de usuario y tenancy, y siguen en el historial de Git. En **Perfil → API Keys**, elimina la clave con huella `32:d5:c4:ca:1b:c8:74:c4:7e:0a:4d:ea:08:47:63:be` si sigue activa (ver [S1](#seguridad-del-despliegue)).

## Paso 1. Compartimento y permisos

1. **Identity & Security → Compartments → Create Compartment**: `communityia`.
2. Elige cómo se autentica el backend contra Object Storage:

   **Opción A — Clave de API (documentada).**
   Una clave de API tiene **todos los permisos del usuario que la genera**: si es tu usuario administrador, quien la robe controla la tenancy. Créala para un usuario de servicio sin acceso a la consola:
   1. **Identity → Domains → Default → Users → Create user**: `communityia-backend-svc`. En *Edit user capabilities* deja solo **API keys**.
   2. **Groups → Create group**: `communityia-storage`, con ese usuario como miembro.
   3. Crea la política del punto 2 de la opción B, cambiando `dynamic-group communityia-backend` por `group communityia-storage`.
   4. En el usuario de servicio: **API Keys → Add API Key → Generate API key pair**. Descarga la clave privada (`.pem`) y guarda el fragmento de configuración que muestra la consola en un archivo llamado `config`. Se instalan en la VM del backend en el paso 6.

   **Opción B — Instance principals [recomendado].** El backend ya lo soporta (`backend/app/storage/oci_storage.py`): si no encuentra `~/.oci/config`, se autentica con la identidad de la propia instancia y no hay claves en el servidor. Se configura después de crear la instancia (paso 4):
   1. **Identity → Domains → Default → Dynamic groups → Create**: `communityia-backend`, con la regla:
      ```
      instance.id = '<OCID_DE_LA_VM_BACKEND>'
      ```
   2. **Identity → Policies → Create Policy** en el compartimento `communityia`. Solo permite listar, leer y crear objetos en ese bucket, sin borrar ni sobrescribir: un backend comprometido no puede destruir ni alterar los paquetes ya publicados.
      ```
      Allow dynamic-group communityia-backend to manage objects in compartment communityia where all {target.bucket.name='communitylab-activos-marketing', any {request.permission='OBJECT_INSPECT', request.permission='OBJECT_READ', request.permission='OBJECT_CREATE'}}
      ```
   3. Con esta opción **no** debe existir `~/.oci/config` en la VM; si existe, el backend lo usa primero.

## Paso 2. Red

1. **Networking → Virtual Cloud Networks → Start VCN Wizard → Create VCN with Internet Connectivity**, en el compartimento `communityia`. El asistente crea la subred pública, el Internet Gateway y las rutas.
2. Abre la **Security List** de la subred pública y agrega las reglas de entrada (TCP):

   | Puerto | Origen documentado | Origen **[recomendado]** | Uso |
   | :--- | :--- | :--- | :--- |
   | 22 | `0.0.0.0/0` | tu IP pública `/32` (o el servicio **Bastion** de OCI, sin abrir el 22) | SSH |
   | 3000 | `0.0.0.0/0` | IP públicas del equipo y de los evaluadores (`/32` cada una) | Aplicación web |
   | 8000 | `0.0.0.0/0` | CIDR de la VCN (por ejemplo `10.0.0.0/16`) | API del backend |

   **Por qué restringir también el 3000:** la aplicación no tiene inicio de sesión. Quien llegue al puerto puede subir archivos (y gastar la cuota de Gemini), aprobar contenido, publicar paquetes en el bucket y leer todos los paquetes publicados. Mientras no haya autenticación (ver [S2](#seguridad-del-despliegue)), la Security List es el único control de acceso. Si necesitas una demo pública, abre el puerto solo durante la demo.

   Con la opción recomendada, al backend solo se llega desde el frontend dentro de la VCN. Abre `8000` a internet solo si necesitas Swagger público para los evaluadores, y ciérralo después.

   > **La Security List es el control que vale.** Docker publica los puertos de los contenedores con sus propias reglas de iptables, por delante de `firewalld`: quitar un puerto con `firewall-cmd` **no** lo cierra si un contenedor lo publica. Restringe el acceso aquí (o con un *Network Security Group*), no en la VM.

## Paso 3. Bucket

1. **Storage → Buckets → Create Bucket** en el compartimento `communityia`.
2. Nombre: `communitylab-activos-marketing`, nivel **Standard**, visibilidad **privada**.
3. Anota el **namespace** de la tenancy (en la ficha del bucket). El actual es `axrmv8bsyp2r`.
4. Si usas otro nombre, namespace o región, defínelos después en el `.env` del backend: `OCI_BUCKET_NAME`, `OCI_NAMESPACE`, `OCI_REGION`.

## Paso 4. Instancias

Crea dos instancias en **Compute → Instances → Create Instance**:

| Campo | Valor |
| :--- | :--- |
| Nombre | `communityia-frontend` / `communityia-backend` |
| Imagen | Oracle Linux 9 |
| Forma | `VM.Standard.E2.1.Micro` (Always Free) |
| Red | `communityia-vcn`, subred pública, **asignar IP pública** |
| SSH | tu clave pública |

Anota las **IP públicas** de ambas y la **IP privada** del backend. Si elegiste la opción B del paso 1, copia el OCID de la VM del backend y crea ahora el grupo dinámico y la política.

## Paso 5. Preparar cada VM

Conéctate con `ssh opc@<IP_PUBLICA>` y ejecuta en **ambas** instancias:

```bash
# Docker, Docker Compose y Git
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker opc
exit   # vuelve a conectarte para que el grupo docker tenga efecto

# Swap de 4 GiB: con 1 GB de RAM, la compilación del frontend y LangGraph agotan la memoria
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo "/swapfile swap swap defaults 0 0" | sudo tee -a /etc/fstab

# Parches de seguridad automáticos del sistema operativo
sudo dnf install -y dnf-automatic
sudo sed -i 's/^upgrade_type.*/upgrade_type = security/; s/^apply_updates.*/apply_updates = yes/' /etc/dnf/automatic.conf
sudo systemctl enable --now dnf-automatic.timer

# Código
git clone <url-del-repositorio> ~/CommunityLab-G10-team23
```

> Pertenecer al grupo `docker` equivale a tener acceso de root en la VM. Agrega solo a `opc`.

Abre el puerto en el firewall del sistema operativo, según la VM (no sustituye a la Security List; ver la nota del paso 2):

```bash
# VM backend
sudo firewall-cmd --permanent --add-port=8000/tcp && sudo firewall-cmd --reload
# VM frontend
sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload
```

> La ruta `~/CommunityLab-G10-team23` es la del despliegue actual; se mantiene para no romper los comandos de operación.

## Paso 6. Backend

1. **Credenciales de OCI** (solo con la opción A del paso 1). Desde tu equipo, copia los archivos a una carpeta temporal de la VM. El script los instala en `~/.oci` con permisos `600`, ajusta `key_file` y después se borran las copias:

   ```bash
   scp oci_api_key.pem config opc@<IP_BACKEND>:/tmp/
   ssh opc@<IP_BACKEND> "bash ~/CommunityLab-G10-team23/scripts/setup_oci.sh /tmp/oci_api_key.pem /tmp/config && rm -f /tmp/oci_api_key.pem /tmp/config"
   ```

   El contenedor del backend corre con el UID 1000, el mismo de `opc`, así que lee `~/.oci` sin abrir los permisos. Nunca subas estos archivos al repositorio ni los pegues en scripts o documentos; el repositorio ya ignora `*.pem`, `*.key` y `.env`.

2. **Variables de entorno.** Crea `~/CommunityLab-G10-team23/.env`:

   ```env
   GEMINI_API_KEY=<tu-clave>
   GEMINI_MODEL=gemini-3.5-flash-lite
   # Opcional si difieren de los valores por defecto:
   # OCI_BUCKET_NAME=communitylab-activos-marketing
   # OCI_NAMESPACE=axrmv8bsyp2r
   # OCI_REGION=sa-vinhedo-1
   ```

   ```bash
   chmod 600 ~/CommunityLab-G10-team23/.env
   ```

   En Google AI Studio / Google Cloud, restringe la clave de Gemini a la *Generative Language API* y configura una alerta de presupuesto: si alguien abusa de la aplicación, el gasto queda acotado.

3. **Levantar el servicio.**

   ```bash
   cd ~/CommunityLab-G10-team23
   docker compose up -d --build backend
   ```

4. **Crear el primer administrador.** No hay usuarios ni credenciales por defecto; el comando pide la contraseña (mínimo 12 caracteres) sin mostrarla:

   ```bash
   docker compose exec -it backend python -m app.auth.crear_admin --email <tu-correo> --nombre "<tu nombre>"
   ```

   El resto de las cuentas se crean por invitación desde la aplicación, en **Administración → Equipo** (también disponible en `/api/v1/usuarios/invitaciones`); no existe el registro abierto. Las cuentas viven en `auth.db`, dentro del volumen `backend-data`. Para hacer una copia de seguridad: `docker compose cp backend:/app/data/auth.db ./auth.db.bak`. Esa copia contiene los hashes de las contraseñas: guárdala fuera del repositorio.

5. **Verificar.** Todo endpoint, salvo `/health` y el login, exige un token de sesión:

   ```bash
   docker compose ps                                    # backend en estado "healthy"
   curl http://localhost:8000/health
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/v1/storage/packages   # 401 sin sesión

   # Inicia sesión con el administrador (la contraseña no queda en el historial de la terminal)
   read -rp "Correo: " EMAIL; read -rsp "Contraseña: " CLAVE; echo
   TOKEN=$(EMAIL="$EMAIL" CLAVE="$CLAVE" python3 -c 'import json, os, urllib.request as u; b = json.dumps({"email": os.environ["EMAIL"], "password": os.environ["CLAVE"]}).encode(); print(json.load(u.urlopen(u.Request("http://localhost:8000/api/v1/auth/login", b, {"Content-Type": "application/json"})))["token"])')
   curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/storage/packages   # fuerza la conexión con OCI
   curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/auth/logout
   docker compose logs backend | grep "OCI Storage"
   ```

   El log debe decir `Conectado exitosamente` (con `~/.oci/config` o con *Instance Principals*). Si dice `Usando almacenamiento Mock local`, el backend no encontró credenciales y está guardando los paquetes en disco, no en OCI: **no des el despliegue por terminado** en ese estado (ver [S7](#seguridad-del-despliegue)).

## Paso 7. Frontend

> **Actualiza backend y frontend a la vez.** El backend exige sesión en todos los endpoints y el frontend es quien inicia sesión y reenvía el token: una versión nueva de uno con la anterior del otro deja la aplicación sin acceso. No definas `DEMO_MODE=true` en producción: desactiva el inicio de sesión.

1. **Apuntar el BFF al backend.** Crea `~/CommunityLab-G10-team23/.env` en la VM del frontend:

   ```env
   # IP privada del backend dentro de la VCN [recomendado]
   BACKEND_URL=http://<IP_PRIVADA_BACKEND>:8000
   # Si mantuviste el puerto 8000 abierto a internet, también sirve la IP pública.
   ```

   Este `.env` no lleva secretos; solo la dirección del backend.

2. **Levantar el servicio.** La imagen (Node 22 + Astro) se compila en la VM; con 1 GB de RAM tarda varios minutos y necesita la swap del paso 5.

   ```bash
   cd ~/CommunityLab-G10-team23
   docker compose up -d --build frontend
   ```

3. **Verificar.**

   ```bash
   docker compose ps                         # frontend en estado "healthy"
   curl http://localhost:3000/api/health     # debe responder "status":"online"
   ```

   Si responde `"status":"offline"`, el frontend no llega al backend: revisa `BACKEND_URL`, la regla del puerto 8000 en la Security List y el firewall de la VM backend.

## Paso 8. Prueba de punta a punta

1. Abre `http://<IP_PUBLICA_FRONTEND>:3000`: debe aparecer la portada de Community IA. Pulsa **Iniciar sesión**. Entra con el administrador del paso 6. En la barra lateral deben aparecer **Conectado** y tu nombre.
2. Sube un archivo de prueba desde **Bandeja → Subir archivo** y espera el análisis.
3. Aprueba o rechaza todo el contenido y pulsa **Guardar cambios**.
4. Comprueba que en el bucket aparece `activos/paquete_N/paquete-distribucion.json` y que el paquete se ve en **Tabla de casos** y en **Dashboard**.

## Paso 9. Operación

| Tarea | Comando (en la VM correspondiente) |
| :--- | :--- |
| Actualizar a la última versión | `cd ~/CommunityLab-G10-team23 && git pull && docker compose up -d --build backend` (o `frontend`) |
| Ver estado | `docker compose ps` |
| Ver logs | `docker compose logs -f backend` (o `frontend`) |
| Reiniciar tras cambiar `.env` | `docker compose up -d --force-recreate backend` (o `frontend`) |
| Liberar espacio de imágenes viejas | `docker image prune -f` |
| Recompilar con imágenes base parcheadas (una vez al mes) | `docker compose build --pull backend && docker compose up -d backend` (o `frontend`) |
| Comprobar que no hay secretos en el repositorio | `git grep -nE "PRIVATE KEY\|LS0tLS1CRUdJTi\|AIza"` (no debe devolver nada) |

Los contenedores tienen `restart: unless-stopped`: vuelven a arrancar solos después de reiniciar la VM, siempre que Docker esté habilitado (`systemctl enable docker`, paso 5).

## Configuración de Docker Compose

`docker-compose.yml` está preparado para estas instancias:

| Ajuste | Para qué sirve |
| :--- | :--- |
| `restart: unless-stopped` | Los servicios se recuperan tras un reinicio de la VM o una caída |
| Backend sin `--reload` y sin montar el código | Modo producción: la imagen contiene el código y no se reinicia al tocar archivos |
| Volumen `backend-data` en `/app/data` | Los candidatos en revisión y el almacenamiento local de respaldo sobreviven a reconstrucciones |
| `.env` opcional (`required: false`) | Cada VM lleva solo lo que necesita: secretos en el backend, `BACKEND_URL` en el frontend |
| `BACKEND_URL=${BACKEND_URL:-http://backend:8000}` | Se define en el `.env` del frontend; sin valor, apunta al backend del mismo compose |
| `OCI_CONFIG_DIR` (por defecto `/home/opc/.oci`) | Carpeta de credenciales de OCI montada en solo lectura |
| `healthcheck` en ambos servicios | `docker compose ps` muestra si cada servicio responde |
| Usuario sin privilegios (`app` y `node`, UID 1000) | Una vulnerabilidad en la aplicación no da root dentro del contenedor, y el proceso no puede modificar el código de la imagen |
| `cap_drop: ALL` y `no-new-privileges` | El proceso no conserva capacidades de Linux ni puede ganarlas (por ejemplo, con binarios setuid) |
| Logs rotados (`10m` × 3 por servicio) | Los logs no llenan el disco de la VM |
| `backend/.dockerignore` | La imagen no incluye `data/`, los tests, `.env` ni claves |

> Si la VM ya tiene un volumen `backend-data` creado por una versión que corría como root, cámbiale el dueño una vez: `docker compose run --rm --user root backend chown -R 1000:1000 /app/data`.

Para desarrollo local con recarga automática del backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Seguridad del despliegue

Revisión del plan de despliegue, la configuración de Docker, el repositorio y el código expuesto a la red. La severidad corresponde al despliegue tal como estaba documentado, con todos los puertos abiertos a `0.0.0.0/0`.

| Id | Severidad | Hallazgo | Estado |
| :--- | :--- | :--- | :--- |
| S1 | Crítica | `scripts/setup_oci.sh` contenía la clave privada de la API de OCI (en base64), el OCID del usuario, el de la tenancy y la huella. Los documentos decían que ya se había quitado, pero seguía en la rama actual. Con esa clave, cualquiera con acceso al repositorio actúa en OCI con los permisos de ese usuario. | **Corregido en el repo:** el script ya no lleva secretos e instala archivos locales. **Acción manual:** revocar la clave (paso 0) y limpiar el historial (abajo). |
| S2 | Alta | La aplicación no tiene autenticación y el frontend está abierto a internet: cualquiera puede gastar la cuota de Gemini, aprobar contenido, publicar en el bucket y leer todos los paquetes. | **Corregido en el código:** cuentas por invitación, roles e inicio de sesión obligatorio en el backend (fase 1) y en el frontend (fase 2). Mientras no haya HTTPS (S5), mantén el puerto 3000 restringido por IP: la contraseña y la cookie viajarían sin cifrar. La administración gestiona el equipo desde la propia aplicación y cada rol solo ve lo que puede usar (fase 3). |
| S3 | Alta | Backend (8000, con Swagger) y SSH (22) abiertos a `0.0.0.0/0`; el backend acepta cualquier petición sin credenciales. | **Corregido en la guía:** 8000 solo desde la VCN y 22 solo desde tu IP o Bastion (paso 2). **Corregido en el código:** el backend exige sesión y rol en todos los endpoints salvo `/health` y el login. |
| S4 | Alta | La clave de API de la opción A era la de un usuario personal (normalmente administrador), y la política de instance principals daba `manage objects`, que incluye borrar y sobrescribir. | **Corregido en la guía:** usuario de servicio solo con claves de API y política limitada a listar, leer y crear objetos (paso 1). |
| S5 | Media | Tráfico por HTTP: los contenidos y las respuestas viajan sin cifrar. | **Pendiente** (ver pendientes). |
| S6 | Media | Los contenedores corrían como root con las capacidades por defecto, y la imagen del backend copiaba `data/` y los tests. | **Corregido:** UID 1000, `cap_drop: ALL`, `no-new-privileges` y `backend/.dockerignore`. Verificado en contenedores locales. |
| S7 | Media | Si fallan las credenciales de OCI, el backend pasa **en silencio** al almacenamiento local (mock) y la aplicación sigue diciendo que publicó. Además, en ese modo la ruta de `GET /api/v1/storage/packages/{ruta}.json` no se valida, así que podría leer archivos `.json` fuera de la carpeta del mock (hallazgo de revisión de código, no explotado). | **Mitigado por procedimiento:** verificación del log en el paso 6. **Pendiente de código** (abajo). |
| S8 | Baja | `firewalld` no protege los puertos que publica Docker. | **Documentado** (paso 2): el control es la Security List. |
| S9 | Baja | Sin parches automáticos del sistema operativo ni rotación de logs (un disco lleno tumba el servicio). | **Corregido:** `dnf-automatic` (paso 5) y logs rotados en compose. |
| S10 | Baja | Los errores 500 devuelven al cliente el mensaje interno de la excepción, y el README publica las IP de las VM. | **Pendiente de código o decisión del equipo.** |

### Limpiar la clave del historial de Git (S1)

Quitar la clave de la rama no la borra de los commits anteriores (desde `e94d849`) ni de los forks. **Lo que la neutraliza es revocarla**; la limpieza evita que se reutilicen los identificadores. Reescribir el historial cambia los hashes de todos los commits, así que acuérdalo con el equipo antes:

```bash
pip install git-filter-repo
git clone --mirror https://github.com/lunajulio/CommunityIA.git && cd CommunityIA.git

# Reemplazos: cada línea de la clave, la clave en una sola línea, los OCID y la huella
git show e94d849:scripts/setup_oci.sh | sed -n '/^LS0t/,/^EOF/p' | grep -v '^EOF' > ../reemplazos.txt
cat >> ../reemplazos.txt <<'EOF'
regex:LS0tLS1CRUdJTi[A-Za-z0-9+/=]*
regex:ocid1\.(user|tenancy)\.oc1\.\.[a-z0-9]+
32:d5:c4:ca:1b:c8:74:c4:7e:0a:4d:ea:08:47:63:be
EOF

git filter-repo --replace-text ../reemplazos.txt
git push --force --mirror
```

Después, cada integrante vuelve a clonar el repositorio. Repite el proceso en el repositorio de la organización (`No-Country-simulation`) si la clave llegó allí, y si el repositorio es público, pide a GitHub Support que purgue las vistas en caché.

### Cambios de código recomendados (no aplicados)

No se modificaron el backend ni los contratos de API; estos cambios necesitan acuerdo del equipo:

1. **Autenticación (S2).** Implementada: cuentas por invitación, roles `admin` / `revisor` / `lector`, sesiones opacas y límite de intentos por correo (`backend/app/auth/`); en el frontend, cookie `httpOnly` + `SameSite=Strict`, middleware que exige sesión, verificación de origen (CSRF), límite de intentos por IP y pantallas de login, registro y nueva contraseña; vista **Equipo** para invitar, cambiar roles, desactivar y generar enlaces de contraseña nueva, e interfaz adaptada al rol (fase 3).
2. **Fallo explícito del almacenamiento (S7).** Con `ENVIRONMENT=production`, que el backend se niegue a usar el mock y falle al arrancar o al publicar. Además, validar `periodo_referencia` (`^[a-z0-9_]+$`) y comprobar que la ruta resuelta quede dentro de la carpeta del mock.
3. **Swagger solo en desarrollo (S3).** `FastAPI(docs_url=None, redoc_url=None)` cuando `ENVIRONMENT=production`.
4. **Límites de tamaño (S2).** Longitud máxima de `texto` por interacción en el contrato y límite de tamaño del cuerpo en el BFF, para acotar el gasto por petición.
5. **Errores genéricos (S10).** Registrar la excepción en el log y devolver al cliente un mensaje sin detalles internos.

## Pendientes antes de considerarlo producción

1. **HTTPS (S5).** El acceso es por HTTP con IP. Opciones dentro de Always Free: un *Flexible Load Balancer* de 10 Mbps con certificado delante del frontend, o un proxy inverso (Caddy) en la VM del frontend con un dominio. Caddy obtiene el certificado de Let's Encrypt automáticamente. Con el proxy en marcha, define `COOKIE_SECURE=true` y `TRUST_PROXY=true` en el `.env` del frontend, cierra el 3000 a internet (que solo lo alcance el proxy) y abre el 443. Es requisito para abrir la aplicación al público ahora que hay contraseñas.
2. El resto de los [cambios de código recomendados](#cambios-de-código-recomendados-no-aplicados).
3. **Estado no durable.** Los trabajos en curso viven en la memoria del backend y se pierden al reiniciarlo; solo el paquete publicado en el bucket es definitivo.
4. **Imágenes compiladas en las VM.** Compilar en máquinas de 1 GB es lento. Se puede compilar en otro equipo y publicar las imágenes en OCI Container Registry.
