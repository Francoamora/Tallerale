# Entorno local

## Cuentas de prueba

Las crea `python manage.py seed_demo` (definidas en
`taller/management/commands/seed_demo.py`). Todas comparten la misma
contraseña y pertenecen al taller de demo **Taller San Martín**.

**Contraseña:** `Taller-Local-2026`

| Rol | Usuario | Para probar |
|---|---|---|
| Administrador | `demo@tallerista.test` | Todo el sistema |
| Recepción | `recepcion@tallerista.test` | Órdenes, agenda y cobros, sin finanzas |
| Mecánico | `mecanico@tallerista.test` | Sólo el trabajo operativo, sin importes |
| Contador | `contador@tallerista.test` | Finanzas, sin agenda ni tablero |
| Soporte | `soporte@tallerista.test` | Centro CEO (`/ceo`) y activación de planes |

`seed_demo` es idempotente: si olvidaste la contraseña o alguien la cambió,
volvé a correrlo y quedan todas como arriba. Los datos de muestra (clientes,
órdenes, turnos, cobros) sólo se cargan si el taller de demo está vacío.

El comando **sólo corre con `DEBUG` activo**: en producción se niega, porque
estas contraseñas están publicadas en el repositorio.

## Levantar el entorno

```bash
createdb tallerista_demo
DATABASE_URL=postgresql://localhost:5432/tallerista_demo DJANGO_DEBUG=True ./venv/bin/python manage.py migrate
DATABASE_URL=postgresql://localhost:5432/tallerista_demo DJANGO_DEBUG=True ./venv/bin/python manage.py seed_demo
```

Backend (Django) y frontend (Next.js), en dos terminales:

```bash
DATABASE_URL=postgresql://localhost:5432/tallerista_demo DJANGO_DEBUG=True ./venv/bin/python manage.py runserver 127.0.0.1:8001
API_BASE_URL=http://127.0.0.1:8001/api NEXT_PUBLIC_API_BASE_URL=/api/backend npm run dev
```

La app queda en http://localhost:3000.

Se usa el puerto **8001** para el backend porque el 8000 suele estar ocupado
por otros proyectos. Si el 8000 está libre podés usarlo y omitir las dos
variables del frontend: `.env.local` ya apunta ahí.

Sin `DATABASE_URL`, Django usa `db.sqlite3`; `seed_demo` funciona igual sobre
esa base.
