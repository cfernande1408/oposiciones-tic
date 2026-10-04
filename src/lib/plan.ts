import type {Pregunta, Stats} from './quiz';

export type Oposicion = 'madrid' | 'gsi';

// Bancos que son exámenes reales: miden lo que de verdad pregunta cada tribunal.
export const EXAMENES_REALES: Record<Oposicion, string[]> = {
  madrid: ['ayto-tm-tic-2025', 'ayto-tai-tic-2026'],
  gsi: ['examen-gsi-2026', 'examen-gsi-2024'],
};

export type InfoTema = {
  tema: number;
  enExamenes: number; // preguntas reales de este tema
  fallo: number | null; // 0..1 según tu historial, null si no hay datos
  peso: number;
};

export function calcularPesos(
  oposicion: Oposicion,
  temas: number[],
  preguntas: Pregunta[],
  stats: Stats,
  dominados: Set<number>,
): InfoTema[] {
  const reales = new Set(EXAMENES_REALES[oposicion]);
  return temas.map((t) => {
    const delTema = preguntas.filter((p) => p.tema === t);
    const enExamenes = delTema.filter((p) => reales.has(p.banco) && !p.anulada).length;
    let ok = 0;
    let ko = 0;
    delTema.forEach((p) => {
      const s = stats[p.id];
      if (s) {
        ok += s.ok;
        ko += s.ko;
      }
    });
    const fallo = ok + ko >= 3 ? ko / (ok + ko) : null;
    // Frecuencia en examen (con suavizado para no ignorar temas que aún no han caído)
    // × debilidad (sin datos se asume media) × reducción si ya lo dominas.
    const frecuencia = enExamenes + 1;
    const debilidad = 0.6 + (fallo ?? 0.4);
    const dominio = dominados.has(t) ? 0.3 : 1;
    return {tema: t, enExamenes, fallo, peso: frecuencia * debilidad * dominio};
  });
}

export type Fase = 'primera' | 'segunda' | 'final';

export type Semana = {
  inicio: Date;
  mes: string; // 'YYYY-MM'
  horas: number;
  fase: Fase;
};

const DIA = 86_400_000;

export function claveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nombreMes(clave: string): string {
  const [y, m] = clave.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-ES', {month: 'long', year: 'numeric'});
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function construirSemanas(
  inicio: Date,
  examen: Date,
  horasSemana: number,
  ajustes: Record<string, number>,
): Semana[] {
  const semanas: Semana[] = [];
  for (let t = inicio.getTime(); t < examen.getTime(); t += 7 * DIA) {
    const d = new Date(t);
    const fraccion = Math.min(1, (examen.getTime() - t) / (7 * DIA));
    const mes = claveMes(d);
    semanas.push({inicio: d, mes, horas: (ajustes[mes] ?? horasSemana) * fraccion, fase: 'primera'});
  }
  const n = semanas.length;
  if (n === 0) return semanas;
  const final = Math.max(1, Math.min(4, Math.round(n * 0.15)));
  const segunda = n - final >= 6 ? Math.round((n - final) * 0.3) : 0;
  semanas.forEach((s, i) => {
    if (i >= n - final) s.fase = 'final';
    else if (i >= n - final - segunda) s.fase = 'segunda';
  });
  return semanas;
}

export type Asignacion = {tema: number; horas: number};
export type PlanMes = {
  mes: string;
  horas: number;
  fases: Fase[];
  primera: Asignacion[];
  segunda: Asignacion[];
  simulacros: number;
};

// Reparte las horas de una fase entre temas según su peso y las va llenando
// semana a semana, empezando por los de mayor peso.
function repartir(semanas: Semana[], pesos: InfoTema[]): Map<string, Map<number, number>> {
  const total = semanas.reduce((a, s) => a + s.horas, 0);
  const suma = pesos.reduce((a, p) => a + p.peso, 0) || 1;
  const cola = [...pesos]
    .sort((a, b) => b.peso - a.peso)
    .map((p) => ({tema: p.tema, resto: (total * p.peso) / suma}));
  const porMes = new Map<string, Map<number, number>>();
  let i = 0;
  for (const s of semanas) {
    let libre = s.horas;
    const m = porMes.get(s.mes) ?? new Map<number, number>();
    while (libre > 1e-6 && i < cola.length) {
      const c = cola[i];
      const h = Math.min(libre, c.resto);
      m.set(c.tema, (m.get(c.tema) ?? 0) + h);
      c.resto -= h;
      libre -= h;
      if (c.resto <= 1e-6) i++;
    }
    porMes.set(s.mes, m);
  }
  return porMes;
}

export function generarPlan(semanas: Semana[], pesos: InfoTema[]): PlanMes[] {
  const p1 = repartir(semanas.filter((s) => s.fase === 'primera'), pesos);
  // En la segunda vuelta pesa más la debilidad: se eleva el peso al cuadrado
  // para concentrar el tiempo en los temas que más cuestan y más caen.
  const pesos2 = pesos.map((p) => ({...p, peso: p.peso * p.peso}));
  const p2 = repartir(semanas.filter((s) => s.fase === 'segunda'), pesos2);
  const meses = [...new Set(semanas.map((s) => s.mes))];
  const aLista = (m?: Map<number, number>) =>
    [...(m ?? new Map()).entries()]
      .filter(([, h]) => h >= 0.25)
      .map(([tema, horas]) => ({tema, horas}))
      .sort((a, b) => b.horas - a.horas);
  return meses.map((mes) => {
    const delMes = semanas.filter((s) => s.mes === mes);
    return {
      mes,
      horas: delMes.reduce((a, s) => a + s.horas, 0),
      fases: [...new Set(delMes.map((s) => s.fase))],
      primera: aLista(p1.get(mes)),
      segunda: aLista(p2.get(mes)),
      simulacros: delMes.filter((s) => s.fase === 'final').length,
    };
  });
}
