-- Perfiles reclamables (ver schema.prisma, modelo User): `users` gana
-- documento de identidad genérico (tipo + número, únicos como pareja) y
-- `email`/`password_hash` pasan a opcionales, para soportar el "perfil
-- sombra" que una organización puede pre-registrar antes de que la persona
-- tenga cuenta (ver AuthService.register y MembershipsService.invite).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "numero_documento" TEXT NOT NULL,
ADD COLUMN     "tipo_documento" TEXT NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_tipo_documento_numero_documento_key" ON "users"("tipo_documento", "numero_documento");
