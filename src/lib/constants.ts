export const SHIFTS = {
  DIA: {
    name: 'DIA',
    label: 'Turno Día',
    startHour: 7,
    endHour: 19,
    graceMinutes: 10,
    mealType: 'ALMUERZO' as const,
    mealHour: 12,
    mealCutoffHour: 10, // Hora limite para reporte a cocina
  },
  NOCHE: {
    name: 'NOCHE',
    label: 'Turno Noche',
    startHour: 19,
    endHour: 7, // Siguiente dia
    graceMinutes: 10,
    mealType: 'CENA' as const,
    mealHour: 0, // Medianoche aprox
    mealCutoffHour: 22, // Hora limite para reporte a cocina
  },
} as const;

export const EMPLOYEE_TYPES = {
  ADMINISTRATIVO: {
    label: 'Administrativo',
    mealEligible: false,
    color: 'blue',
  },
  OPERATIVO: {
    label: 'Operativo',
    mealEligible: true,
    color: 'green',
  },
} as const;

export const ATTENDANCE_TYPES = {
  INGRESO: 'INGRESO',
  SALIDA: 'SALIDA',
} as const;

export const MEAL_STATUS = {
  PROGRAMADO: 'PROGRAMADO',
  SERVIDO: 'SERVIDO',
  CANCELADO: 'CANCELADO',
  NO_PRESENTADO: 'NO_PRESENTADO',
} as const;

export const ALERT_TYPES = {
  TARDANZA: 'TARDANZA',
  SALIDA_ANTICIPADA: 'SALIDA_ANTICIPADA',
  MEAL_CANCELLED: 'MEAL_CANCELLED',
  NO_SHOW: 'NO_SHOW',
  OVERTIME: 'OVERTIME',
  ACCIDENTE: 'ACCIDENTE',
} as const;

export const ALERT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
