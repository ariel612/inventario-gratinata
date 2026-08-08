// Migración única: Firestore (app original) -> Postgres (app nueva).
//
// Requisitos antes de correr:
// 1. Service account de Firebase con acceso de lectura al proyecto
//    "inventario-gratinata". Guardar el JSON y exportar:
//      GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/serviceAccountKey.json
//    (Firebase Console > Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada)
// 2. DATABASE_URL en .env apuntando a la base de PRODUCCIÓN (Neon), no a la
//    de desarrollo local. Verificar dos veces antes de correr.
// 3. Correr primero con --dry-run para ver qué se va a escribir sin tocar
//    la base de datos.
//
// Uso:
//   npx tsx scripts/migrate-from-firestore.ts --dry-run
//   npx tsx scripts/migrate-from-firestore.ts
//
// Idempotente: usa upserts, se puede volver a correr sin duplicar datos.

import "dotenv/config";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { Area, Role } from "../src/generated/prisma/enums";

const DRY_RUN = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

function initFirestore(): Firestore {
  const projectId = "inventario-gratinata";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)), projectId });
  } else {
    // Usa GOOGLE_APPLICATION_CREDENTIALS del entorno.
    initializeApp({ credential: applicationDefault(), projectId });
  }
  return getFirestore();
}

function log(msg: string) {
  console.log(`${DRY_RUN ? "[dry-run] " : ""}${msg}`);
}

function tempPassword() {
  return crypto.randomBytes(6).toString("base64url");
}

// ===== 1. Usuarios base por rol =====
// La app original usaba un PIN compartido por rol (inseguro, por eso la
// migración a Next.js). No hay identidad por empleado que migrar: se crean
// 3 cuentas iniciales con contraseña temporal, igual que en el seed de
// desarrollo. El admin las reparte y cada quien cambia su contraseña.
async function migrateUsuarios() {
  const roles: [string, string, Role][] = [
    ["cocina", "Equipo Cocina", Role.COCINA],
    ["recepcion", "Equipo Recepción", Role.RECEPCION],
    ["admin", "Administrador", Role.ADMIN],
  ];
  for (const [username, name, role] of roles) {
    const password = tempPassword();
    if (DRY_RUN) {
      log(`User ${username} (${role})`);
      continue;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, name, role, passwordHash },
    });
    console.log(`  usuario=${username.padEnd(12)} password temporal=${password}`);
  }
}

// ===== 2. Catálogo (proveedores + productos) =====
type CatalogoItem = { n: string; m: number };
type CatalogoProveedor = { p: string; wa?: string; i: CatalogoItem[] };

async function migrateCatalogo(db: Firestore, area: Area, docId: string) {
  const snap = await db.collection("gratinata").doc(docId).get();
  if (!snap.exists) {
    log(`${docId}: no existe, se omite`);
    return { providerIdByName: new Map<string, string>(), productIdByKey: new Map<string, string>() };
  }
  const providers = (snap.data()?.items ?? []) as CatalogoProveedor[];
  const providerIdByName = new Map<string, string>();
  const productIdByKey = new Map<string, string>(); // "prov||name" -> productId

  for (let pIdx = 0; pIdx < providers.length; pIdx++) {
    const p = providers[pIdx];
    log(`${docId} proveedor: ${p.p} (${p.i.length} productos)`);
    if (DRY_RUN) continue;

    const provider = await prisma.provider.upsert({
      where: { area_name: { area, name: p.p } },
      update: { whatsapp: p.wa || null, orden: pIdx },
      create: { area, name: p.p, whatsapp: p.wa || null, orden: pIdx },
    });
    providerIdByName.set(p.p, provider.id);

    for (let iIdx = 0; iIdx < p.i.length; iIdx++) {
      const item = p.i[iIdx];
      const product = await prisma.product.upsert({
        where: { providerId_name: { providerId: provider.id, name: item.n } },
        update: { minStock: item.m, orden: iIdx },
        create: { providerId: provider.id, name: item.n, minStock: item.m, orden: iIdx },
      });
      productIdByKey.set(`${p.p}||${item.n}`, product.id);
    }
  }
  return { providerIdByName, productIdByKey };
}

// ===== 3. Stock semanal =====
async function migrateStock(db: Firestore, colId: string, productIdByKey: Map<string, string>) {
  const snap = await db.collection(colId).get();
  log(`${colId}: ${snap.size} semanas`);
  for (const doc of snap.docs) {
    const weekKey = doc.id;
    const entries = (doc.data().entries ?? {}) as Record<string, { stock?: number; procesado?: boolean; pedido?: number }>;
    for (const [key, entry] of Object.entries(entries)) {
      const productId = productIdByKey.get(key);
      if (!productId) continue; // producto eliminado desde entonces
      if (DRY_RUN) continue;
      await prisma.stockEntry.upsert({
        where: { productId_weekKey: { productId, weekKey } },
        update: {
          stock: entry.stock ?? null,
          procesado: !!entry.procesado,
          pedido: entry.pedido ?? null,
        },
        create: {
          productId,
          weekKey,
          stock: entry.stock ?? null,
          procesado: !!entry.procesado,
          pedido: entry.pedido ?? null,
        },
      });
    }
  }
}

// ===== 4. Pedidos =====
async function migratePedidos(db: Firestore, colId: string, area: Area) {
  const snap = await db.collection(colId).get();
  log(`${colId}: ${snap.size} pedidos`);
  for (const doc of snap.docs) {
    const data = doc.data() as { fecha: string; items: { p: string; n: string; c: string }[] };
    const fechaStr = doc.id.split("_")[1]; // pedido_YYYY-MM-DD_<epoch>
    const fecha = fechaStr ? new Date(fechaStr) : new Date();
    const items = (data.items ?? []).map((i) => ({ provider: i.p, product: i.n, cantidad: i.c }));
    if (DRY_RUN) continue;
    await prisma.pedido.create({ data: { area, fecha, items } }).catch(() => {
      // Ya migrado en una corrida anterior con el mismo contenido: no hay
      // clave natural para upsert acá, así que se ignora el duplicado.
    });
  }
}

// ===== 5. Racha =====
async function migrateRacha(db: Firestore, docId: string, area: Area) {
  const snap = await db.collection("gratinata").doc(docId).get();
  if (!snap.exists) return;
  const data = snap.data() as { actual?: number; mejor?: number; ultimaFecha?: string };
  log(`${docId}: actual=${data.actual} mejor=${data.mejor}`);
  if (DRY_RUN) return;
  await prisma.racha.upsert({
    where: { area },
    update: { actual: data.actual ?? 0, mejor: data.mejor ?? 0, ultimaFecha: data.ultimaFecha ?? null },
    create: { area, actual: data.actual ?? 0, mejor: data.mejor ?? 0, ultimaFecha: data.ultimaFecha ?? null },
  });
}

// ===== 6. Áreas de cierre =====
type CierreAreaFS = { n: string; t: string[] };

async function migrateCierreAreas(db: Firestore, docId: string, depto: Area) {
  const snap = await db.collection("gratinata").doc(docId).get();
  if (!snap.exists) return;
  const areas = (snap.data()?.areas ?? []) as CierreAreaFS[];
  log(`${docId}: ${areas.length} áreas`);
  for (let aIdx = 0; aIdx < areas.length; aIdx++) {
    const a = areas[aIdx];
    if (DRY_RUN) continue;
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
        await prisma.cierreTarea.create({ data: { cierreAreaId: cierreArea.id, texto: a.t[tIdx], orden: tIdx } });
      }
    }
  }
}

// ===== 7. Historial de cierres =====
async function migrateCierreHistorial(db: Firestore, colId: string, depto: Area) {
  const snap = await db.collection(colId).get();
  log(`${colId}: ${snap.size} cierres`);
  for (const doc of snap.docs) {
    const data = doc.data() as {
      nombre: string;
      fecha: string;
      tareas: Record<string, boolean>;
      areasSnapshot: CierreAreaFS[];
      finalizadoEn?: string;
    };
    if (DRY_RUN) continue;
    await prisma.cierreHistorial.create({
      data: {
        depto,
        nombre: data.nombre,
        fecha: data.fecha,
        tareas: data.tareas ?? {},
        areasSnapshot: data.areasSnapshot ?? [],
        finalizadoEn: data.finalizadoEn ? new Date(data.finalizadoEn) : new Date(),
      },
    });
  }
}

// ===== 8. Mise en Place =====
async function migrateMiseCatalog(db: Firestore) {
  const snap = await db.collection("gratinata").doc("miseCatalog").get();
  if (!snap.exists) return;
  const items = (snap.data()?.items ?? []) as CatalogoItem[];
  log(`miseCatalog: ${items.length} productos`);
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (DRY_RUN) continue;
    await prisma.miseItem.upsert({
      where: { nombre: item.n },
      update: { min: item.m, orden: idx },
      create: { nombre: item.n, min: item.m, orden: idx },
    });
  }
}

async function migrateMiseDiario(db: Firestore) {
  const snap = await db.collection("miseDiario").get();
  log(`miseDiario: ${snap.size} días`);
  for (const doc of snap.docs) {
    const data = doc.data();
    if (DRY_RUN) continue;
    await prisma.miseDiario.upsert({
      where: { fecha: doc.id },
      update: {
        linea: data.linea ?? {},
        repuesto: data.repuesto ?? {},
        producir: data.producir ?? {},
        sel: data.sel ?? {},
        hecho: data.hecho ?? {},
      },
      create: {
        fecha: doc.id,
        linea: data.linea ?? {},
        repuesto: data.repuesto ?? {},
        producir: data.producir ?? {},
        sel: data.sel ?? {},
        hecho: data.hecho ?? {},
      },
    });
  }
}

async function migrateMiseHistorial(db: Firestore) {
  const snap = await db.collection("miseHistorial").get();
  log(`miseHistorial: ${snap.size} registros`);
  for (const doc of snap.docs) {
    const data = doc.data() as {
      fecha: string;
      guardadoEn?: string;
      items: { n: string; linea: string; repuesto: string; producir: string; hecho: boolean }[];
    };
    if (DRY_RUN) continue;
    await prisma.miseHistorial.create({
      data: {
        fecha: data.fecha,
        guardadoEn: data.guardadoEn ? new Date(data.guardadoEn) : new Date(),
        items: data.items ?? [],
      },
    });
  }
}

// ===== 9. Recetas, ventas, sugerencias (feed de Fudo) =====
async function migrateRecetas(db: Firestore) {
  const snap = await db.collection("gratinata").doc("recetas").get();
  if (!snap.exists) return;
  const productos = (snap.data()?.productos ?? {}) as Record<string, unknown>;
  const nombres = Object.keys(productos);
  log(`recetas: ${nombres.length} productos`);
  for (const nombre of nombres) {
    if (DRY_RUN) continue;
    await prisma.recetaProducto.upsert({
      where: { nombre },
      update: { ingredientes: productos[nombre] as object },
      create: { nombre, ingredientes: productos[nombre] as object },
    });
  }
}

async function migrateVentas(db: Firestore) {
  const snap = await db.collection("gratinata").doc("ventasProductos").get();
  if (!snap.exists) return;
  const items = (snap.data()?.items ?? {}) as Record<string, number>;
  log(`ventasProductos: ${Object.keys(items).length} productos`);
  for (const [producto, cantidad] of Object.entries(items)) {
    if (DRY_RUN) continue;
    await prisma.ventaProducto.upsert({
      where: { producto },
      update: { cantidad },
      create: { producto, cantidad },
    });
  }
}

async function migrateSugerencias(db: Firestore) {
  const snap = await db.collection("gratinata").doc("sugerencias").get();
  if (!snap.exists) return;
  const items = (snap.data()?.items ?? {}) as Record<string, number>;
  log(`sugerencias: ${Object.keys(items).length} productos`);
  for (const [producto, valor] of Object.entries(items)) {
    if (DRY_RUN) continue;
    await prisma.sugerencia.upsert({
      where: { producto },
      update: { valor },
      create: { producto, valor },
    });
  }
}

// ===== 10. Config (alerta de WhatsApp) =====
async function migrateConfig(db: Firestore) {
  const snap = await db.collection("gratinata").doc("config").get();
  if (!snap.exists) return;
  const alertaWa = snap.data()?.alertaWa as string | undefined;
  log(`config: alertaWa=${alertaWa || "(vacío)"}`);
  if (DRY_RUN || !alertaWa) return;
  await prisma.configAlerta.upsert({
    where: { id: 1 },
    update: { alertaWa },
    create: { id: 1, alertaWa },
  });
}

async function main() {
  if (DRY_RUN) console.log("=== DRY RUN: no se escribe nada, solo se muestra qué se migraría ===\n");
  console.log(`Destino: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}\n`);

  const db = initFirestore();

  console.log("--- Usuarios ---");
  await migrateUsuarios();

  console.log("\n--- Catálogo Cocina ---");
  const cocina = await migrateCatalogo(db, Area.COCINA, "catalogo");
  console.log("--- Catálogo Recepción ---");
  const recepcion = await migrateCatalogo(db, Area.RECEPCION, "catalogoRecepcion");

  console.log("\n--- Stock semanal ---");
  await migrateStock(db, "stock", cocina.productIdByKey);
  await migrateStock(db, "stockRecepcion", recepcion.productIdByKey);

  console.log("\n--- Pedidos ---");
  await migratePedidos(db, "pedidos", Area.COCINA);
  await migratePedidos(db, "pedidosRecepcion", Area.RECEPCION);

  console.log("\n--- Racha ---");
  await migrateRacha(db, "rachaCocina", Area.COCINA);
  await migrateRacha(db, "rachaRecepcion", Area.RECEPCION);

  console.log("\n--- Áreas de cierre ---");
  await migrateCierreAreas(db, "cierreAreas", Area.COCINA);
  await migrateCierreAreas(db, "cierreAreasRecepcion", Area.RECEPCION);

  console.log("\n--- Historial de cierres ---");
  await migrateCierreHistorial(db, "cierreHistorial", Area.COCINA);
  await migrateCierreHistorial(db, "cierreHistorialRecepcion", Area.RECEPCION);

  console.log("\n--- Mise en Place ---");
  await migrateMiseCatalog(db);
  await migrateMiseDiario(db);
  await migrateMiseHistorial(db);

  console.log("\n--- Recetas / ventas / sugerencias (Fudo) ---");
  await migrateRecetas(db);
  await migrateVentas(db);
  await migrateSugerencias(db);

  console.log("\n--- Config ---");
  await migrateConfig(db);

  console.log(DRY_RUN ? "\nDry run terminado, no se escribió nada." : "\nMigración terminada.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
