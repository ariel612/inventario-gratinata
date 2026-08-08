// Seed de desarrollo:
// - Un usuario por rol con contraseña temporal.
// - Catálogo de proveedores/productos, extraído directo de legacy/index.html
//   (los arrays INV_COCINA / INV_RECEPCION de la app original) para no
//   retipear ~150 productos a mano y garantizar fidelidad con los datos reales.
//
// En producción, los usuarios y el catálogo reales se migran con
// scripts/migrate-from-firestore.ts (Fase 9).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role, Area } from "../src/generated/prisma/enums";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function tempPassword() {
  return crypto.randomBytes(6).toString("base64url");
}

async function upsertUser(username: string, name: string, role: Role) {
  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash, name, role, active: true },
    create: { username, name, role, passwordHash },
  });
  console.log(`${role.padEnd(10)} usuario=${username.padEnd(12)} password temporal=${password}`);
}

type LegacyItem = { n: string; m: number };
type LegacyProvider = { p: string; wa?: string; i: LegacyItem[] };
type LegacyCierreArea = { n: string; t: string[] };

// Extrae `var NOMBRE=<literal>;` de legacy/index.html y lo evalúa como
// expresión JS aislada (es contenido propio del repo, no input de usuario).
function extractLegacyArray<T>(source: string, varName: string): T {
  const marker = `var ${varName}=`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`No se encontró ${varName} en legacy/index.html`);
  const exprStart = start + marker.length;
  const end = source.indexOf(";\nvar", exprStart);
  const literal = source.slice(exprStart, end === -1 ? source.indexOf(";", exprStart) : end);
  return new Function(`return (${literal});`)();
}

async function seedCatalogo(area: Area, providers: LegacyProvider[]) {
  for (let pIdx = 0; pIdx < providers.length; pIdx++) {
    const p = providers[pIdx];
    const provider = await prisma.provider.upsert({
      where: { area_name: { area, name: p.p } },
      update: { whatsapp: p.wa || null, orden: pIdx },
      create: { area, name: p.p, whatsapp: p.wa || null, orden: pIdx },
    });
    for (let iIdx = 0; iIdx < p.i.length; iIdx++) {
      const item = p.i[iIdx];
      await prisma.product.upsert({
        where: { providerId_name: { providerId: provider.id, name: item.n } },
        update: { minStock: item.m, orden: iIdx },
        create: { providerId: provider.id, name: item.n, minStock: item.m, orden: iIdx },
      });
    }
  }
  const totalProductos = providers.reduce((a, p) => a + p.i.length, 0);
  console.log(`${area.padEnd(10)} ${providers.length} proveedores, ${totalProductos} productos`);
}

async function seedCierreAreas(depto: Area, areas: LegacyCierreArea[]) {
  for (let aIdx = 0; aIdx < areas.length; aIdx++) {
    const a = areas[aIdx];
    const cierreArea = await prisma.cierreArea.upsert({
      where: { depto_nombre: { depto, nombre: a.n } },
      update: { orden: aIdx },
      create: { depto, nombre: a.n, orden: aIdx },
    });
    for (let tIdx = 0; tIdx < a.t.length; tIdx++) {
      const existing = await prisma.cierreTarea.findFirst({
        where: { cierreAreaId: cierreArea.id, texto: a.t[tIdx] },
      });
      if (!existing) {
        await prisma.cierreTarea.create({
          data: { cierreAreaId: cierreArea.id, texto: a.t[tIdx], orden: tIdx },
        });
      }
    }
  }
  console.log(`${depto.padEnd(10)} ${areas.length} áreas de cierre`);
}

async function seedMiseCatalogo(items: LegacyItem[]) {
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    await prisma.miseItem.upsert({
      where: { nombre: item.n },
      update: { min: item.m, orden: idx },
      create: { nombre: item.n, min: item.m, orden: idx },
    });
  }
  console.log(`Mise en Place: ${items.length} productos`);
}

async function main() {
  console.log("Sembrando usuarios de desarrollo (cambiar contraseña en el primer login real):\n");
  await upsertUser("cocina", "Equipo Cocina", Role.COCINA);
  await upsertUser("recepcion", "Equipo Recepción", Role.RECEPCION);
  await upsertUser("admin", "Administrador", Role.ADMIN);

  console.log("\nSembrando catálogo desde legacy/index.html:\n");
  const legacyPath = path.join(__dirname, "..", "legacy", "index.html");
  const source = fs.readFileSync(legacyPath, "utf-8");
  const invCocina = extractLegacyArray<LegacyProvider[]>(source, "INV_COCINA");
  const invRecepcion = extractLegacyArray<LegacyProvider[]>(source, "INV_RECEPCION");
  await seedCatalogo(Area.COCINA, invCocina);
  await seedCatalogo(Area.RECEPCION, invRecepcion);

  console.log("\nSembrando áreas de cierre desde legacy/index.html:\n");
  const cierreCocina = extractLegacyArray<LegacyCierreArea[]>(source, "CIERRE_AREAS_SEED");
  const cierreRecepcion = extractLegacyArray<LegacyCierreArea[]>(source, "CIERRE_RECEPCION_AREAS_SEED");
  await seedCierreAreas(Area.COCINA, cierreCocina);
  await seedCierreAreas(Area.RECEPCION, cierreRecepcion);

  console.log("\nSembrando catálogo de Mise en Place desde legacy/index.html:\n");
  const miseSeed = extractLegacyArray<LegacyItem[]>(source, "MISE_SEED");
  await seedMiseCatalogo(miseSeed);

  // Recetas + ventas: en producción estos datos los alimenta la integración
  // con Fudo (fuera del alcance de esta migración). Sembramos un par de
  // ejemplos para poder probar la calculadora de compra.
  console.log("\nSembrando ejemplo de recetas/ventas (Fudo):\n");
  await prisma.ventaProducto.upsert({
    where: { producto: "Pizza Margarita" },
    update: { cantidad: 45 },
    create: { producto: "Pizza Margarita", cantidad: 45 },
  });
  await prisma.ventaProducto.upsert({
    where: { producto: "Pizza Pepperoni" },
    update: { cantidad: 30 },
    create: { producto: "Pizza Pepperoni", cantidad: 30 },
  });
  await prisma.recetaProducto.upsert({
    where: { nombre: "Pizza Margarita" },
    update: {},
    create: {
      nombre: "Pizza Margarita",
      ingredientes: [
        { n: "Queso Cabra", cant: 0.15, u: "kg" },
        { n: "Salsa Tomate gn", cant: 0.2, u: "kg" },
      ],
    },
  });
  await prisma.recetaProducto.upsert({
    where: { nombre: "Pizza Pepperoni" },
    update: {},
    create: {
      nombre: "Pizza Pepperoni",
      ingredientes: [
        { n: "Pepperoni", cant: 0.1, u: "kg" },
        { n: "Salsa Tomate gn", cant: null, u: "kg" },
      ],
    },
  });
  await prisma.sugerencia.upsert({
    where: { producto: "Queso cabra Holandia despunte kg" },
    update: { valor: 6 },
    create: { producto: "Queso cabra Holandia despunte kg", valor: 6 },
  });
  console.log("Recetas: 2 productos, Ventas: 2 registros, Sugerencias: 1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
