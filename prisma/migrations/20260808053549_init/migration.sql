-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COCINA', 'RECEPCION', 'ADMIN');

-- CreateEnum
CREATE TYPE "Area" AS ENUM ('COCINA', 'RECEPCION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "stock" DOUBLE PRECISION,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "pedido" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "items" JSONB NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Racha" (
    "area" "Area" NOT NULL,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "mejor" INTEGER NOT NULL DEFAULT 0,
    "ultimaFecha" TEXT,

    CONSTRAINT "Racha_pkey" PRIMARY KEY ("area")
);

-- CreateTable
CREATE TABLE "CierreArea" (
    "id" TEXT NOT NULL,
    "depto" "Area" NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CierreArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreTarea" (
    "id" TEXT NOT NULL,
    "cierreAreaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CierreTarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreTurno" (
    "id" TEXT NOT NULL,
    "depto" "Area" NOT NULL,
    "fecha" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tareas" JSONB NOT NULL,
    "areasSnapshot" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreHistorial" (
    "id" TEXT NOT NULL,
    "depto" "Area" NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "tareas" JSONB NOT NULL,
    "areasSnapshot" JSONB NOT NULL,
    "finalizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiseItem" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "min" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MiseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiseDiario" (
    "fecha" TEXT NOT NULL,
    "linea" JSONB NOT NULL,
    "repuesto" JSONB NOT NULL,
    "producir" JSONB NOT NULL,
    "sel" JSONB NOT NULL,
    "hecho" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiseDiario_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "MiseHistorial" (
    "id" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "guardadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "items" JSONB NOT NULL,

    CONSTRAINT "MiseHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecetaProducto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ingredientes" JSONB NOT NULL,

    CONSTRAINT "RecetaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaProducto" (
    "producto" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "VentaProducto_pkey" PRIMARY KEY ("producto")
);

-- CreateTable
CREATE TABLE "Sugerencia" (
    "producto" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Sugerencia_pkey" PRIMARY KEY ("producto")
);

-- CreateTable
CREATE TABLE "ConfigAlerta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "alertaWa" TEXT,

    CONSTRAINT "ConfigAlerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "LoginAttempt_username_createdAt_idx" ON "LoginAttempt"("username", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_area_name_key" ON "Provider"("area", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_providerId_name_key" ON "Product"("providerId", "name");

-- CreateIndex
CREATE INDEX "StockEntry_weekKey_idx" ON "StockEntry"("weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "StockEntry_productId_weekKey_key" ON "StockEntry"("productId", "weekKey");

-- CreateIndex
CREATE INDEX "Pedido_area_fecha_idx" ON "Pedido"("area", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CierreArea_depto_nombre_key" ON "CierreArea"("depto", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CierreTurno_depto_fecha_key" ON "CierreTurno"("depto", "fecha");

-- CreateIndex
CREATE INDEX "CierreHistorial_depto_finalizadoEn_idx" ON "CierreHistorial"("depto", "finalizadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "MiseItem_nombre_key" ON "MiseItem"("nombre");

-- CreateIndex
CREATE INDEX "MiseHistorial_guardadoEn_idx" ON "MiseHistorial"("guardadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "RecetaProducto_nombre_key" ON "RecetaProducto"("nombre");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreTarea" ADD CONSTRAINT "CierreTarea_cierreAreaId_fkey" FOREIGN KEY ("cierreAreaId") REFERENCES "CierreArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
