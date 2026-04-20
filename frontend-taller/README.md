# TallerOS Frontend

Frontend desacoplado de `TallerOS`, construido con `Next.js 16`, `TypeScript` y `Tailwind CSS`.

## Desarrollo local

1. Crear variables de entorno:

```bash
cp .env.example .env.local
```

2. Apuntar el frontend al backend Django:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
API_BASE_URL=http://127.0.0.1:8000/api
```

3. Levantar el proyecto:

```bash
npm install
npm run dev
```

## Deploy en Vercel

Este repo es un monorepo simple:

- backend Django en la raiz del repositorio
- frontend Next.js en `frontend-taller/`

Para desplegar el frontend correcto en Vercel:

1. Importar el repo `Francoamora/Tallerale`
2. Configurar `Root Directory` como `frontend-taller`
3. Elegir `Framework Preset: Next.js`
4. Cargar estas variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://tu-backend.up.railway.app/api
API_BASE_URL=https://tu-backend.up.railway.app/api
```

Si Vercel apunta a `./`, va a detectar el backend Django viejo de la raiz y no este frontend.
