FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Usuario sin privilegios. UID 1000 = usuario opc de Oracle Linux, dueño de ~/.oci
# en la VM: así el contenedor puede leer las credenciales montadas (chmod 600).
RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin app \
    && mkdir -p /app/data && chown app:app /app/data

COPY --chown=root:root . .

USER app

EXPOSE 8000

# Producción: sin --reload (docker-compose.dev.yml lo activa para desarrollo local)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
