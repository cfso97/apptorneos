// Carga los catálogos iniciales descritos en la sección 16.1 de
// docs/modelo-datos-torneos-saas.md (permissions/role_permissions) más un
// Plan placeholder y el Sport "Fútbol" (único deporte del alcance del MVP,
// sección 19). Idempotente: se puede correr varias veces sin duplicar datos.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// IDs fijos para que el seed sea idempotente sin depender de un campo único
// adicional en `plans`/`sports` (que hoy no lo tienen en el esquema).
const PLAN_PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000001';
const SPORT_FUTBOL_ID = '00000000-0000-0000-0000-000000000002';

interface PermisoSeed {
  codigo: string;
  modulo: string;
}

const PERMISOS: PermisoSeed[] = [
  // Torneos (core)
  { codigo: 'crear_torneo', modulo: 'torneos' },
  { codigo: 'editar_torneo', modulo: 'torneos' },
  { codigo: 'editar_organizacion', modulo: 'torneos' },
  { codigo: 'configurar_requisitos', modulo: 'torneos' },
  { codigo: 'configurar_fases', modulo: 'torneos' },
  { codigo: 'aprobar_inscripcion', modulo: 'torneos' },
  { codigo: 'rechazar_inscripcion', modulo: 'torneos' },
  { codigo: 'editar_resultado', modulo: 'torneos' },
  { codigo: 'confirmar_resultado', modulo: 'torneos' },
  { codigo: 'resolver_disputa', modulo: 'torneos' },
  { codigo: 'registrar_evento_partido', modulo: 'torneos' },
  { codigo: 'descalificar_participante', modulo: 'torneos' },
  { codigo: 'reemplazar_participante', modulo: 'torneos' },
  { codigo: 'aplicar_sancion', modulo: 'torneos' },
  { codigo: 'ver_recaudos', modulo: 'torneos' },
  { codigo: 'registrar_pago', modulo: 'torneos' },
  { codigo: 'registrar_reembolso', modulo: 'torneos' },
  { codigo: 'asignar_arbitro', modulo: 'torneos' },
  { codigo: 'ver_estadisticas', modulo: 'torneos' },
  { codigo: 'generar_carnet', modulo: 'torneos' },
  // Equipos
  { codigo: 'editar_plantilla', modulo: 'equipos' },
  { codigo: 'invitar_jugador_equipo', modulo: 'equipos' },
  { codigo: 'inscribir_equipo_torneo', modulo: 'equipos' },
  { codigo: 'convocar_jugadores_torneo', modulo: 'equipos' },
  // Jugador
  { codigo: 'inscribirse_torneo', modulo: 'jugador' },
  { codigo: 'ver_perfil_propio', modulo: 'jugador' },
  { codigo: 'ver_historial_propio', modulo: 'jugador' },
  { codigo: 'agregar_logro_autoreportado', modulo: 'jugador' },
  // Acudiente
  { codigo: 'ver_estado_cuenta_menor', modulo: 'acudiente' },
  { codigo: 'confirmar_inscripcion_menor', modulo: 'acudiente' },
  // Escuela (reservado, fase 2 — no se asigna a ningún rol todavía)
  { codigo: 'administrar_jugadores_escuela', modulo: 'escuela' },
  { codigo: 'registrar_pago_mensualidad', modulo: 'escuela' },
  { codigo: 'crear_equipo_escuela', modulo: 'escuela' },
  // Canchas (reservado, fase 2 — no se asigna a ningún rol todavía)
  { codigo: 'registrar_cancha', modulo: 'canchas' },
  { codigo: 'editar_reserva', modulo: 'canchas' },
  { codigo: 'administrar_costos_cancha', modulo: 'canchas' },
  // Plataforma (reservado, futuro super-admin — no se asigna a ningún rol todavía)
  { codigo: 'gestionar_organizaciones', modulo: 'plataforma' },
  { codigo: 'gestionar_planes', modulo: 'plataforma' },
  { codigo: 'ver_metricas_globales', modulo: 'plataforma' },
];

// Matriz rol × permiso — sección 16.1 de docs/modelo-datos-torneos-saas.md
// (alcance MVP: módulos Torneos + Equipos + Jugador + Acudiente).
// NOTA: `ver_estado_cuenta_menor` está en el catálogo de esa sección pero no
// aparece en la matriz rol×permiso documentada — se deja sin asignar por
// ahora, tal como está en la fuente de verdad (avisar a Cristian, posible
// vacío de documentación).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin_org: [
    'crear_torneo',
    'editar_torneo',
    'editar_organizacion',
    'configurar_requisitos',
    'configurar_fases',
    'aprobar_inscripcion',
    'rechazar_inscripcion',
    'editar_resultado',
    'resolver_disputa',
    'registrar_evento_partido',
    'descalificar_participante',
    'reemplazar_participante',
    'aplicar_sancion',
    'ver_recaudos',
    'registrar_pago',
    'registrar_reembolso',
    'asignar_arbitro',
    'ver_estadisticas',
    'generar_carnet',
  ],
  coach: [
    'confirmar_resultado',
    'ver_estadisticas',
    'editar_plantilla',
    'invitar_jugador_equipo',
    'inscribir_equipo_torneo',
    'convocar_jugadores_torneo',
    'ver_perfil_propio',
    'ver_historial_propio',
    'agregar_logro_autoreportado',
  ],
  jugador: [
    'ver_estadisticas',
    'inscribirse_torneo',
    'ver_perfil_propio',
    'ver_historial_propio',
    'agregar_logro_autoreportado',
  ],
  acudiente: [
    'ver_estadisticas',
    'inscribirse_torneo',
    'ver_perfil_propio',
    'ver_historial_propio',
    'confirmar_inscripcion_menor',
  ],
  arbitro: ['editar_resultado', 'registrar_evento_partido', 'aplicar_sancion'],
};

async function seedPermissions(): Promise<void> {
  for (const permiso of PERMISOS) {
    await prisma.permission.upsert({
      where: { codigo: permiso.codigo },
      update: { modulo: permiso.modulo },
      create: permiso,
    });
  }

  for (const [rol, permisos] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionCodigo of permisos) {
      await prisma.rolePermission.upsert({
        where: { rol_permissionCodigo: { rol, permissionCodigo } },
        update: {},
        create: { rol, permissionCodigo },
      });
    }
  }
}

async function seedPlan(): Promise<void> {
  await prisma.plan.upsert({
    where: { id: PLAN_PLACEHOLDER_ID },
    update: {},
    create: {
      id: PLAN_PLACEHOLDER_ID,
      nombre: 'Plan Base (placeholder)',
      precioBase: 0,
    },
  });
}

async function seedSports(): Promise<void> {
  await prisma.sport.upsert({
    where: { id: SPORT_FUTBOL_ID },
    update: {},
    create: {
      id: SPORT_FUTBOL_ID,
      nombre: 'Fútbol',
      tipoParticipacion: 'equipo',
      manejaSets: false,
      unidadResultado: 'goles',
      configDefault: {},
    },
  });
}

async function main(): Promise<void> {
  await seedPermissions();
  await seedPlan();
  await seedSports();
}

main()
  .catch((error: unknown) => {
    console.error('Error al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
