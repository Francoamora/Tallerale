# Deploy Guide

## Arquitectura recomendada

- `frontend-taller/` -> `Vercel`
- backend Django en la raiz -> `Railway`

No conviene desplegar el backend Django en `Vercel` si el frontend ya vive ahi. Este repo es un monorepo y cada plataforma tiene que apuntar a su directorio correcto.

## Vercel

Configurar un proyecto nuevo o editar el actual con:

- `Root Directory`: `frontend-taller`
- `Framework Preset`: `Next.js`

Variables de entorno:

```env
NEXT_PUBLIC_API_BASE_URL=https://tu-backend.up.railway.app/api
API_BASE_URL=https://tu-backend.up.railway.app/api
```

Notas:

- Si `Root Directory` queda en `./`, Vercel detecta el backend Django viejo de la raiz.
- El frontend ya esta preparado para build de produccion con `webpack`.

## Railway

El backend ya incluye [railway.json](/Users/francoagustinmoraagmail.comm/Desktop/Tallerale/railway.json) con:

- `collectstatic` en build
- `gunicorn` como start command

Variables de entorno minimas:

```env
DJANGO_SECRET_KEY=super-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=tu-backend.up.railway.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://tu-backend.up.railway.app,https://tu-frontend.vercel.app
DJANGO_CORS_ALLOWED_ORIGINS=https://tu-frontend.vercel.app
DATABASE_URL=postgresql://usuario:password@host:5432/database
```

Opcional:

```env
DJANGO_HSTS_SECONDS=3600
```

## Flujo sugerido

1. Crear o corregir el proyecto de `Vercel` apuntando a `frontend-taller`
2. Crear o corregir el servicio de `Railway` apuntando a la raiz del repo
3. Cargar variables del backend en `Railway`
4. Copiar la URL publica de `Railway`
5. Cargar esa URL en las variables del proyecto `Vercel`
6. Redeployar ambos
