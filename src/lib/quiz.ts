export type Opcion = {
  texto: string;
  correcta: boolean;
  explicacion: string;
  fuente: string;
};

export type Pregunta = {
  id: string;
  numero?: number;
  tema?: number;
  origen?: string;
  verificada?: boolean;
  confianza?: 'alta' | 'media' | 'tribunal' | string;
  anulada?: boolean;
  enunciado: string;
  codigo?: string;
  contexto?: string;
  opciones: Opcion[];
  nota?: string;
  banco: string;
};

export type Banco = {
  id: string;
  titulo: string;
  preguntas: Pregunta[];
};

export type Modo = 'estudio' | 'examen';

export type Sesion = {
  modo: Modo;
  preguntas: Pregunta[];
  respuestas: (number | null)[];
  actual: number;
  inicio: number;
  limiteMs: number | null;
  fin: number | null;
  simulacro?: boolean;
};

export const LETRAS = ['a', 'b', 'c', 'd', 'e'];

// Programa Ayto. de Madrid: Grupo I = temas 1-14, Grupo II = 15-69.
export type Grupo = 'I' | 'II';
export function grupoDeTema(t?: number): Grupo | null {
  if (t == null) return null;
  return t <= 14 ? 'I' : 'II';
}

// Reparto real del 1er ejercicio de 2025 (13 de 107 preguntas de Grupo I).
export const SIMULACRO = {total: 100, grupoI: 12, minutos: 100};

export function crearSimulacro(todas: Pregunta[], rnd: <T>(a: T[]) => T[]): Pregunta[] {
  const validas = todas.filter((p) => !p.anulada && p.tema != null);
  const g1 = rnd(validas.filter((p) => grupoDeTema(p.tema) === 'I'));
  const g2 = rnd(validas.filter((p) => grupoDeTema(p.tema) === 'II'));
  const n1 = Math.min(SIMULACRO.grupoI, g1.length);
  const n2 = Math.min(SIMULACRO.total - n1, g2.length);
  // Grupo I primero, como en el examen real; dentro de cada grupo, por tema.
  const porTema = (a: Pregunta, b: Pregunta) => (a.tema ?? 0) - (b.tema ?? 0);
  return [...g1.slice(0, n1).sort(porTema), ...g2.slice(0, n2).sort(porTema)];
}

export function indiceCorrecta(p: Pregunta): number {
  return p.opciones.findIndex((o) => o.correcta);
}

export function barajar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Resultado = {
  aciertos: number;
  errores: number;
  blancos: number;
  puntuables: number;
  netas: number;
  nota: number;
};

// Penalización del Ayto. de Madrid: cada error resta 1/3 de acierto.
// Las anuladas no puntúan.
export function corregir(s: Sesion): Resultado {
  let aciertos = 0;
  let errores = 0;
  let blancos = 0;
  s.preguntas.forEach((p, i) => {
    if (p.anulada) return;
    const r = s.respuestas[i];
    if (r == null) blancos++;
    else if (p.opciones[r]?.correcta) aciertos++;
    else errores++;
  });
  const puntuables = aciertos + errores + blancos;
  const netas = aciertos - errores / 3;
  const nota = puntuables ? Math.max(0, netas) / puntuables * 10 : 0;
  return {aciertos, errores, blancos, puntuables, netas, nota};
}

export function corregirPorGrupo(s: Sesion): Record<Grupo, Resultado> {
  const out = {} as Record<Grupo, Resultado>;
  (['I', 'II'] as Grupo[]).forEach((g) => {
    const idx = s.preguntas.map((_, i) => i).filter((i) => grupoDeTema(s.preguntas[i].tema) === g);
    out[g] = corregir({...s, preguntas: idx.map((i) => s.preguntas[i]), respuestas: idx.map((i) => s.respuestas[i])});
  });
  return out;
}

export type EstadoCasilla = 'vacia' | 'marcada' | 'acierto' | 'error' | 'anulada';

export function estadoCasilla(s: Sesion, i: number, revelar: boolean): EstadoCasilla {
  const p = s.preguntas[i];
  const r = s.respuestas[i];
  if (r == null) return p.anulada && revelar ? 'anulada' : 'vacia';
  if (!revelar) return 'marcada';
  if (p.anulada) return 'anulada';
  return p.opciones[r]?.correcta ? 'acierto' : 'error';
}

// ---- Historial en el navegador (localStorage) ----

export type Stat = {ok: number; ko: number; last: 'ok' | 'ko'; ts: number};
export type Stats = Record<string, Stat>;
const KEY = 'opos:stats:v1';

export function cargarStats(): Stats {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function guardarStats(s: Stats): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* almacenamiento lleno o bloqueado: se ignora */
  }
}

export function anotar(stats: Stats, id: string, ok: boolean): Stats {
  const prev = stats[id] ?? {ok: 0, ko: 0, last: 'ok', ts: 0};
  return {
    ...stats,
    [id]: {
      ok: prev.ok + (ok ? 1 : 0),
      ko: prev.ko + (ok ? 0 : 1),
      last: ok ? 'ok' : 'ko',
      ts: Date.now(),
    },
  };
}

export function formatoTiempo(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
