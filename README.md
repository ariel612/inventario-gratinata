# Gratinata — Inventario

App interna de inventario, pedidos, checklist de cierre, Mise en Place y
recetas para Gratinata Pizza. Reescrita en Next.js + Postgres a partir de la
versión original en HTML/JS + Firestore (archivada en `legacy/`).

## Stack

- Next.js 16 (App Router, Server Actions), TypeScript, Tailwind v4
- Postgres vía Prisma
- NextAuth (Auth.js) v5, usuario+contraseña (bcrypt)
- Roles: `COCINA`, `RECEPCION`, `ADMIN`

## Desarrollo local

1. `npm install`
2. Copiar `.env.example` a `.env` y completar `AUTH_SECRET` (generar con el
   comando indicado en el archivo).
3. Levantar Postgres local: `npx prisma dev --name gratinata` (deja corriendo,
   imprime el `DATABASE_URL` a pegar en `.env` — agregarle `&pgbouncer=true`
   al final, el proxy local de `prisma dev` lo necesita).
4. `npx prisma migrate dev` — aplica el schema.
5. `npm run db:seed` — crea usuarios de prueba (imprime usuario/contraseña
   por consola) y carga el catálogo/áreas de cierre/Mise en Place desde
   `legacy/index.html`.
6. `npm run dev` y abrir `http://localhost:3000`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Aplica migraciones de Prisma |
| `npm run db:studio` | Prisma Studio (explorar/editar datos) |
| `npm run db:seed` | Seed de desarrollo (usuarios + catálogo desde `legacy/`) |
| `npm run migrate:firestore` | Migración única de datos reales desde Firestore (ver abajo) |

## Roles y accesos

- **Cocina**: inventario Cocina, Mise en Place, Cierre.
- **Recepción**: inventario Recepción, Cierre.
- **Admin**: todo lo anterior + panel Admin (ver/editar/agregar catálogo,
  usuarios, recetas).

## Corte a producción (Fase 9)

`scripts/migrate-from-firestore.ts` migra los datos reales del Firestore
original a Postgres. Requiere:

1. Credencial de servicio de Firebase con lectura al proyecto
   `inventario-gratinata` (Firebase Console → Configuración del proyecto →
   Cuentas de servicio → Generar nueva clave privada) → exportar
   `GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/json`.
2. `DATABASE_URL` en `.env` apuntando a la base de **producción** (Neon),
   no a la de desarrollo local.
3. Correr primero `npm run migrate:firestore -- --dry-run` para ver qué se
   migraría sin escribir nada, después sin `--dry-run`.

El script es idempotente (usa upserts), se puede volver a correr sin duplicar
datos si algo falla a mitad de camino.

## Estructura

```
src/
  app/            rutas (App Router)
  components/      componentes de cliente por módulo
  lib/actions/     Server Actions (única forma de mutar datos)
  lib/data/        lecturas para Server Components
  lib/auth.ts       config de NextAuth (Node runtime)
  lib/auth.config.ts config compatible con Edge (usada por middleware/proxy)
  lib/authz.ts      guards de rol/área para Server Actions
prisma/
  schema.prisma    modelo de datos
  seed.ts          seed de desarrollo
scripts/
  migrate-from-firestore.ts  corte a producción
legacy/            app original (HTML/JS + Firestore), de referencia
```
