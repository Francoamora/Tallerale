# Deploy Guide

## Arquitectura recomendada

- `frontend-taller/` -> `Vercel`
- backend Django en la raiz -> `Railway`

No conviene desplegar el backend Django en `Vercel` si el frontend ya vive ahi. Este repo es un monorepo y cada plataforma tiene que apuntar a su directorio correcto.

## Vercel

La configuración versionada en `vercel.json` ya resuelve el monorepo. Configurar
el proyecto con:

- `Root Directory`: `./` (raíz del repositorio)
- `Framework Preset`: `Next.js`

Variables de entorno:

```env
NEXT_PUBLIC_API_BASE_URL=https://tu-backend.up.railway.app/api
API_BASE_URL=https://tu-backend.up.railway.app/api
```

El archivo `vercel.json` entra en `frontend-taller`, instala con `npm ci` y
publica su `.next`. No combinar esta modalidad con `Root Directory:
frontend-taller`, porque en ese caso Vercel ignoraría la configuración que vive
en la raíz. El frontend ya está preparado para build de producción con
`webpack`.

## Railway

El backend ya incluye `railway.json` con:

- `collectstatic` en build
- `gunicorn` como start command

Variables de entorno minimas:

```env
DJANGO_SECRET_KEY=super-secret
DJANGO_DEBUG=False
DJANGO_API_DOCS_ENABLED=False
DJANGO_ADMIN_URL=panel-soporte-ruta-privada
DJANGO_ALLOWED_HOSTS=tu-backend.up.railway.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://tu-backend.up.railway.app,https://tu-frontend.vercel.app
DJANGO_CORS_ALLOWED_ORIGINS=https://tu-frontend.vercel.app
DJANGO_MEDIA_ROOT=/app/media
DATABASE_URL=postgresql://usuario:password@host:5432/database
```

Crear un volumen persistente en Railway y montarlo exactamente en
`/app/media`. Los logos de cada taller se guardan allí; sin volumen se perderían
al reemplazar el contenedor. El despliegue ejecuta las migraciones antes de
publicar la nueva versión y usa `/healthz/` para verificar Django y PostgreSQL.
Si soporte no necesita Django Admin, omitir `DJANGO_ADMIN_URL`: el panel no se
publicará. Si se configura, sigue siendo exclusivo para cuentas `staff`.

Opcional:

```env
DJANGO_HSTS_SECONDS=3600
```

Activar `SECURE_HSTS_PRELOAD` no debe formar parte del primer despliegue. Primero
hay que confirmar que todos los subdominios funcionen exclusivamente por HTTPS;
la inclusión en la lista preload es una decisión de infraestructura difícil de
revertir.

## Flujo sugerido

1. Crear o corregir el proyecto de `Vercel` apuntando a la raíz del repositorio
2. Crear o corregir el servicio de `Railway` apuntando a la raiz del repo
3. Cargar variables del backend en `Railway`
4. Copiar la URL publica de `Railway`
5. Cargar esa URL en las variables del proyecto `Vercel`
6. Redeployar ambos

## Validación previa a clientes reales

1. Confirmar backup automático y una restauración de prueba de PostgreSQL.
2. Probar registro, login, cierre de sesión y recuperación de contraseña.
3. Subir un logo PNG, JPEG o WebP y abrir presupuesto, orden, comprobante y
   portal público desde una ventana privada.
4. Repetir las pruebas con dos talleres y comprobar que no puedan acceder a
   IDs, tokens, clientes, vehículos ni documentos entre sí.
5. Ejecutar `python manage.py check --deploy`, las pruebas de Django, el lint y
   el build de Next.js.
6. Auditar dependencias contra los registros públicos (`npm audit` y el
   equivalente del backend) desde un entorno autorizado para consultar Internet.
