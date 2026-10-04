import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import {BANCOS} from '../../data/bancos';
import {BLOQUES, TEMAS, TODOS_TEMAS, nombreTema} from '../../data/temas';
import {
  LETRAS,
  anotar,
  SIMULACROS,
  barajar,
  cargarStats,
  corregir,
  corregirPorGrupo,
  crearSimulacro,
  estadoCasilla,
  formatoTiempo,
  guardarStats,
  indiceCorrecta,
  type Modo,
  type Pregunta,
  type Sesion,
  type Stats,
} from '../../lib/quiz';
import ExplicacionGemini from './Gemini';
import styles from './styles.module.css';

const TODAS = BANCOS.flatMap((b) => b.preguntas);

export default function Quiz(): React.ReactElement {
  const [stats, setStats] = useState<Stats>({});
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => setStats(cargarStats()), []);

  const fase = !sesion ? 'config' : sesion.fin == null ? 'curso' : 'resultados';
  useEffect(() => {
    window.scrollTo({top: 0});
  }, [fase]);

  const actualizarStats = useCallback((fn: (s: Stats) => Stats) => {
    setStats((prev) => {
      const next = fn(prev);
      guardarStats(next);
      return next;
    });
  }, []);

  if (!sesion) {
    return <Configuracion stats={stats} onEmpezar={setSesion} onBorrar={() => actualizarStats(() => ({}))} />;
  }
  if (sesion.fin == null) {
    return <EnCurso sesion={sesion} setSesion={setSesion} actualizarStats={actualizarStats} />;
  }
  return <Resultados sesion={sesion} onNueva={setSesion} onSalir={() => setSesion(null)} />;
}

/* ------------------------------------------------------------------ */
/* Configuración                                                      */
/* ------------------------------------------------------------------ */

function Configuracion({
  stats,
  onEmpezar,
  onBorrar,
}: {
  stats: Stats;
  onEmpezar: (s: Sesion) => void;
  onBorrar: () => void;
}) {
  const [bancos, setBancos] = useState<string[]>(BANCOS.map((b) => b.id));
  // Temas marcados en el selector. Por defecto, todos; un enlace del plan puede traer otros.
  const [temas, setTemas] = useState<number[]>(TODOS_TEMAS);
  const [desdeEnlace, setDesdeEnlace] = useState(false);

  // Enlaces con el test ya configurado, p. ej. ?temas=9,10&modo=estudio&n=30
  // Parámetros: temas, bancos, n, modo (estudio|examen), aleatorio (0|1), falladas (1), anuladas (1).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if ([...q.keys()].length === 0) return;
    const lista = (k: string) => (q.get(k) ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (q.has('temas')) setTemas(lista('temas').map(Number).filter((n) => !Number.isNaN(n)));
    if (q.has('bancos')) {
      const pedidos = lista('bancos').filter((b) => BANCOS.some((x) => x.id === b));
      if (pedidos.length) setBancos(pedidos);
    }
    if (q.has('n')) setLimite(q.get('n') ?? '');
    if (q.get('modo') === 'examen' || q.get('modo') === 'estudio') setModo(q.get('modo') as Modo);
    if (q.has('aleatorio')) setAleatorio(q.get('aleatorio') !== '0');
    if (q.has('falladas')) setSoloFalladas(q.get('falladas') === '1');
    if (q.has('anuladas')) setAnuladas(q.get('anuladas') === '1');
    setDesdeEnlace(true);
  }, []);

  useEffect(() => {
    if (desdeEnlace) document.getElementById('test-desde-enlace')?.scrollIntoView({block: 'center'});
  }, [desdeEnlace]);
  const [modo, setModo] = useState<Modo>('estudio');
  const [aleatorio, setAleatorio] = useState(true);
  const [soloFalladas, setSoloFalladas] = useState(false);
  const [anuladas, setAnuladas] = useState(false);
  const [limite, setLimite] = useState<string>('');

  // Preguntas por tema con los demás filtros aplicados (bancos, anuladas, falladas).
  const conteo = useMemo(() => {
    const m = new Map<number, number>();
    TODAS.forEach((p) => {
      if (p.tema == null || !bancos.includes(p.banco)) return;
      if (!anuladas && p.anulada) return;
      if (soloFalladas && stats[p.id]?.last !== 'ko') return;
      m.set(p.tema, (m.get(p.tema) ?? 0) + 1);
    });
    return m;
  }, [bancos, anuladas, soloFalladas, stats]);

  const pool = useMemo(
    () =>
      TODAS.filter(
        (p) =>
          bancos.includes(p.banco) &&
          p.tema != null &&
          temas.includes(p.tema) &&
          (anuladas || !p.anulada) &&
          (!soloFalladas || stats[p.id]?.last === 'ko'),
      ),
    [bancos, temas, anuladas, soloFalladas, stats],
  );

  const falladas = useMemo(() => Object.values(stats).filter((s) => s.last === 'ko').length, [stats]);
  const vistas = Object.keys(stats).length;

  const n = Math.min(pool.length, Number(limite) > 0 ? Number(limite) : pool.length);

  const empezar = () => {
    const lista = (aleatorio ? barajar(pool) : [...pool].sort(ordenOriginal)).slice(0, n);
    onEmpezar(nuevaSesion(modo, lista));
  };

  if (BANCOS.length === 0) {
    return (
      <section className={styles.panel}>
        <h1 className={styles.titulo}>No hay bancos de preguntas</h1>
        <p>Añade un fichero .json a la carpeta preguntas del repositorio y vuelve a desplegar.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="cfg-titulo">
      <h1 id="cfg-titulo" className={styles.titulo}>
        Prepara un test
      </h1>
      <p className={styles.resumen}>
        {TODAS.length} preguntas en {BANCOS.length} {BANCOS.length === 1 ? 'banco' : 'bancos'}.
        {vistas > 0 && (
          <>
            {' '}
            Has respondido {vistas} y tienes {falladas} {falladas === 1 ? 'fallada' : 'falladas'} pendientes.
          </>
        )}
      </p>

      <div className={styles.simulacros}>
        {SIMULACROS.map((t) => {
          const disponibles = TODAS.filter((p) => !p.anulada && p.opciones.length === t.opciones).length;
          return (
            <div key={t.id} className={styles.simulacro}>
              <div>
                <h2 className={styles.simulacroTitulo}>{t.titulo}</h2>
                <p className={styles.simulacroTexto}>{t.descripcion}</p>
                <p className={styles.simulacroTexto}>{disponibles} preguntas disponibles, sin anuladas.</p>
              </div>
              <div className={styles.simulacroBotones}>
                <button
                  className={styles.primario}
                  disabled={disponibles === 0}
                  onClick={() => {
                    const lista = crearSimulacro(t, TODAS, barajar);
                    onEmpezar({...nuevaSesion('examen', lista), limiteMs: t.minutos * 60_000, simulacro: t.id});
                  }}>
                  Empezar
                </button>
                <button
                  className={styles.secundario}
                  disabled={disponibles === 0}
                  onClick={() => {
                    const lista = crearSimulacro(t, TODAS, barajar);
                    onEmpezar({...nuevaSesion('estudio', lista), simulacro: t.id});
                  }}>
                  Con corrección al momento
                </button>
              </div>
              <p className={styles.simulacroNota}>
                «Empezar»: cronometrado y sin ver respuestas hasta entregar. «Con corrección»: explicación y fuente al
                responder cada pregunta, sin reloj.
              </p>
            </div>
          );
        })}
      </div>

      <h2 className={styles.subtituloForm}>O prepara un test a tu medida</h2>

      <fieldset className={styles.grupo}>
        <legend>Modo</legend>
        <div className={styles.segmentado} role="radiogroup">
          {(['estudio', 'examen'] as Modo[]).map((m) => (
            <label key={m} className={clsx(styles.segmento, modo === m && styles.segmentoActivo)}>
              <input type="radio" name="modo" value={m} checked={modo === m} onChange={() => setModo(m)} />
              <span className={styles.segmentoTitulo}>{m === 'estudio' ? 'Estudio' : 'Examen'}</span>
              <span className={styles.segmentoTexto}>
                {m === 'estudio'
                  ? 'Corrige al momento y explica cada opción.'
                  : '1 minuto por pregunta, sin ver respuestas hasta entregar.'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>Bancos</legend>
        {BANCOS.map((b) => (
          <label key={b.id} className={styles.check}>
            <input
              type="checkbox"
              checked={bancos.includes(b.id)}
              onChange={(e) =>
                setBancos((prev) => (e.target.checked ? [...prev, b.id] : prev.filter((x) => x !== b.id)))
              }
            />
            <span>
              {b.titulo} <span className={styles.tenue}>({b.preguntas.length})</span>
            </span>
          </label>
        ))}
      </fieldset>

      <SelectorTemas temas={temas} setTemas={setTemas} conteo={conteo} />

      <div className={styles.fila}>
        <label className={clsx(styles.campo, styles.campoCorto)}>
          <span>Nº de preguntas</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Todas"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
          />
        </label>
      </div>

      <fieldset className={styles.grupo}>
        <legend>Opciones</legend>
        <label className={styles.check}>
          <input type="checkbox" checked={aleatorio} onChange={(e) => setAleatorio(e.target.checked)} />
          <span>Orden aleatorio</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={soloFalladas}
            disabled={falladas === 0}
            onChange={(e) => setSoloFalladas(e.target.checked)}
          />
          <span>Solo las que fallé la última vez</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={anuladas} onChange={(e) => setAnuladas(e.target.checked)} />
          <span>Incluir preguntas anuladas (no puntúan)</span>
        </label>
      </fieldset>

      {desdeEnlace && (
        <p id="test-desde-enlace" className={styles.desdeEnlace} role="status">
          Test configurado desde el plan de estudio. Revisa y pulsa Empezar.
        </p>
      )}
      <div className={styles.acciones}>
        <button className={styles.primario} disabled={n === 0} onClick={empezar}>
          {n === 0 ? 'No hay preguntas con estos filtros' : `Empezar con ${n} ${n === 1 ? 'pregunta' : 'preguntas'}`}
        </button>
        {modo === 'examen' && n > 0 && <span className={styles.tenue}>Tiempo: {n} min</span>}
      </div>

      {vistas > 0 && (
        <button
          className={styles.enlace}
          onClick={() => {
            if (window.confirm('Se borrará tu historial de aciertos y fallos en este navegador.')) onBorrar();
          }}>
          Borrar historial
        </button>
      )}
    </section>
  );
}

function SelectorTemas({
  temas,
  setTemas,
  conteo,
}: {
  temas: number[];
  setTemas: (t: number[]) => void;
  conteo: Map<number, number>;
}) {
  const sel = new Set(temas);
  const ordenados = [...temas].sort((a, b) => a - b);
  const resumen =
    temas.length === TODOS_TEMAS.length
      ? 'Todos los temas'
      : temas.length === 0
        ? 'Ningún tema'
        : temas.length <= 8
          ? `${temas.length === 1 ? '1 tema' : `${temas.length} temas`}: ${ordenados.join(', ')}`
          : `${temas.length} temas`;
  const total = temas.reduce((a, t) => a + (conteo.get(t) ?? 0), 0);
  const alternar = (ts: number[], on: boolean) =>
    setTemas(on ? [...new Set([...temas, ...ts])] : temas.filter((t) => !ts.includes(t)));
  const grupoI = BLOQUES[0].temas;
  const grupoII = TODOS_TEMAS.filter((t) => !grupoI.includes(t));
  const atajos: [string, number[]][] = [
    ['Todos', TODOS_TEMAS],
    ['Grupo I', grupoI],
    ['Grupo II', grupoII],
    ['Ninguno', []],
  ];

  return (
    <fieldset className={styles.grupo}>
      <legend>Temas</legend>
      <details className={styles.selector}>
        <summary>
          <span className={styles.selectorResumen}>{resumen}</span>
          <span className={styles.tenue}>{total} preguntas</span>
        </summary>
        <div className={styles.selectorCuerpo}>
          <div className={styles.atajosTemas}>
            {atajos.map(([nombre, ts]) => (
              <button key={nombre} type="button" className={styles.chipBoton} onClick={() => setTemas(ts)}>
                {nombre}
              </button>
            ))}
          </div>
          {BLOQUES.map((b) => {
            const marcados = b.temas.filter((t) => sel.has(t)).length;
            const todos = marcados === b.temas.length;
            return (
              <div key={b.nombre} className={styles.bloque}>
                <label className={styles.bloqueCab}>
                  <input
                    type="checkbox"
                    checked={todos}
                    ref={(el) => {
                      if (el) el.indeterminate = marcados > 0 && !todos;
                    }}
                    onChange={(e) => alternar(b.temas, e.target.checked)}
                  />
                  <span>{b.nombre}</span>
                  <span className={styles.cuenta}>
                    {marcados}/{b.temas.length}
                  </span>
                </label>
                <ul className={styles.listaTemas}>
                  {b.temas.map((t) => (
                    <li key={t}>
                      <label className={clsx(styles.check, !(conteo.get(t) ?? 0) && styles.sinPreguntas)}>
                        <input type="checkbox" checked={sel.has(t)} onChange={(e) => alternar([t], e.target.checked)} />
                        <span className={styles.temaNombre}>
                          {t}. {TEMAS[t]}
                        </span>
                        <span className={styles.cuenta}>{conteo.get(t) ?? 0}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </fieldset>
  );
}

function ordenOriginal(a: Pregunta, b: Pregunta) {
  return a.banco === b.banco ? (a.numero ?? 0) - (b.numero ?? 0) : a.banco.localeCompare(b.banco);
}

function nuevaSesion(modo: Modo, preguntas: Pregunta[]): Sesion {
  return {
    modo,
    preguntas,
    respuestas: preguntas.map(() => null),
    actual: 0,
    inicio: Date.now(),
    limiteMs: modo === 'examen' ? preguntas.length * 60_000 : null,
    fin: null,
  };
}

/* ------------------------------------------------------------------ */
/* Test en curso                                                      */
/* ------------------------------------------------------------------ */

function EnCurso({
  sesion,
  setSesion,
  actualizarStats,
}: {
  sesion: Sesion;
  setSesion: React.Dispatch<React.SetStateAction<Sesion | null>>;
  actualizarStats: (fn: (s: Stats) => Stats) => void;
}) {
  const {modo, preguntas, respuestas, actual} = sesion;
  const p = preguntas[actual];
  const r = respuestas[actual];
  const estudio = modo === 'estudio';
  const revelada = estudio && r != null;
  const total = preguntas.length;

  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (sesion.limiteMs == null) return;
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [sesion.limiteMs]);

  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    window.scrollTo({top: 0});
  }, [actual]);

  const restante = sesion.limiteMs != null ? sesion.inicio + sesion.limiteMs - ahora : null;

  const entregar = useCallback(() => {
    if (sesion.fin != null) return;
    if (sesion.modo === 'examen') {
      actualizarStats((st) =>
        sesion.preguntas.reduce((acc, q, i) => {
          const resp = sesion.respuestas[i];
          if (resp == null || q.anulada) return acc;
          return anotar(acc, q.id, !!q.opciones[resp]?.correcta);
        }, st),
      );
    }
    setSesion({...sesion, fin: Date.now()});
  }, [sesion, setSesion, actualizarStats]);

  useEffect(() => {
    if (restante != null && restante <= 0) entregar();
  }, [restante, entregar]);

  const ir = useCallback(
    (i: number) => setSesion((s) => (s ? {...s, actual: Math.max(0, Math.min(s.preguntas.length - 1, i))} : s)),
    [setSesion],
  );

  const responder = useCallback(
    (j: number) => {
      const q = sesion.preguntas[sesion.actual];
      const prev = sesion.respuestas[sesion.actual];
      if (j >= q.opciones.length) return;
      if (sesion.modo === 'estudio') {
        if (prev != null) return;
        if (!q.anulada) actualizarStats((st) => anotar(st, q.id, !!q.opciones[j]?.correcta));
      }
      const nuevas = [...sesion.respuestas];
      nuevas[sesion.actual] = sesion.modo === 'examen' && prev === j ? null : j;
      setSesion({...sesion, respuestas: nuevas});
    },
    [sesion, setSesion, actualizarStats],
  );

  const pedirEntrega = () => {
    const blancos = respuestas.filter((x) => x == null).length;
    const msg =
      modo === 'examen'
        ? blancos
          ? `Te quedan ${blancos} en blanco. ¿Entregar el examen?`
          : '¿Entregar el examen?'
        : '¿Terminar y ver el resumen?';
    if (window.confirm(msg)) entregar();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const porLetra = LETRAS.indexOf(k);
      const porNumero = ['1', '2', '3', '4', '5'].indexOf(k);
      if (porLetra >= 0) responder(porLetra);
      else if (porNumero >= 0) responder(porNumero);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') ir(actual + 1);
      else if (e.key === 'ArrowLeft') ir(actual - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [responder, ir, actual]);

  const contestadas = respuestas.filter((x) => x != null).length;
  const ultima = actual === total - 1;

  return (
    <section className={styles.panel} aria-label={estudio ? 'Test en modo estudio' : 'Examen'}>
      <div className={styles.cabecera}>
        <span className={styles.modo}>
          {sesion.simulacro
            ? `Simulacro ${sesion.simulacro === 'gsi' ? 'GSI' : 'Madrid'}${estudio ? ' con corrección' : ''}`
            : estudio
              ? 'Estudio'
              : 'Examen'}
        </span>
        <span className={styles.progreso}>
          Pregunta {actual + 1} de {total}
        </span>
        {restante != null && (
          <span
            className={clsx(styles.reloj, restante < 5 * 60_000 && styles.relojAviso)}
            aria-label={`Tiempo restante ${formatoTiempo(restante)}`}>
            {formatoTiempo(restante)}
          </span>
        )}
      </div>

      <Hoja sesion={sesion} revelar={estudio} onIr={ir} />

      <PreguntaVista pregunta={p} respuesta={r} revelada={revelada} onResponder={estudio && r != null ? undefined : responder} />

      <nav className={styles.navegacion} aria-label="Navegación entre preguntas">
        <button className={styles.secundario} onClick={() => ir(actual - 1)} disabled={actual === 0}>
          Anterior
        </button>
        {ultima ? (
          <button className={styles.primario} onClick={pedirEntrega}>
            {estudio ? 'Terminar' : 'Entregar examen'}
          </button>
        ) : (
          <button className={styles.primario} onClick={() => ir(actual + 1)}>
            Siguiente
          </button>
        )}
      </nav>

      <div className={styles.pie}>
        <span className={styles.tenue}>
          {contestadas} de {total} contestadas
        </span>
        {!ultima && (
          <button className={styles.enlace} onClick={pedirEntrega}>
            {estudio ? 'Terminar ahora' : 'Entregar ahora'}
          </button>
        )}
      </div>
      <p className={clsx(styles.tenue, styles.atajos)}>Teclado: a, b, c, d para responder y flechas para moverte.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Hoja de respuestas (tira de casillas)                              */
/* ------------------------------------------------------------------ */

const ETIQUETA_ESTADO: Record<string, string> = {
  vacia: 'sin contestar',
  marcada: 'contestada',
  acierto: 'acertada',
  error: 'fallada',
  anulada: 'anulada',
};

function Hoja({
  sesion,
  revelar,
  onIr,
  completa = false,
}: {
  sesion: Sesion;
  revelar: boolean;
  onIr?: (i: number) => void;
  completa?: boolean;
}) {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (completa) return;
    const ol = ref.current;
    const el = ol?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!ol || !el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const left = el.offsetLeft - ol.offsetLeft - ol.clientWidth / 2 + el.offsetWidth / 2;
    ol.scrollTo({left, behavior: reduce ? 'auto' : 'smooth'});
  }, [sesion.actual, completa]);

  return (
    <ol ref={ref} className={clsx(styles.hoja, completa && styles.hojaCompleta)} aria-label="Hoja de respuestas">
      {sesion.preguntas.map((q, i) => {
        const estado = estadoCasilla(sesion, i, revelar);
        const actual = !completa && i === sesion.actual;
        return (
          <li key={q.id}>
            <button
              type="button"
              className={clsx(styles.casilla, styles[`casilla_${estado}`])}
              aria-current={actual ? 'true' : undefined}
              aria-label={`Pregunta ${i + 1}, ${ETIQUETA_ESTADO[estado]}`}
              onClick={() => onIr?.(i)}>
              {i + 1}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Pregunta con sus opciones                                          */
/* ------------------------------------------------------------------ */

function PreguntaVista({
  pregunta: p,
  respuesta,
  revelada,
  onResponder,
  sinEnunciado = false,
}: {
  pregunta: Pregunta;
  respuesta: number | null;
  revelada: boolean;
  onResponder?: (j: number) => void;
  sinEnunciado?: boolean;
}) {
  const banco = BANCOS.find((b) => b.id === p.banco);
  const correcta = indiceCorrecta(p);
  const acierto = respuesta != null && p.opciones[respuesta]?.correcta;
  return (
    <article className={styles.pregunta}>
      {!sinEnunciado && (
        <>
          <p className={styles.meta}>
            {nombreTema(p.tema)}
            {(banco || p.numero != null) && (
              <span className={styles.origen}>
                {banco?.titulo}
                {p.numero != null && `${banco ? ', ' : ''}pregunta ${p.numero}`}
              </span>
            )}
          </p>
          {p.anulada && <p className={styles.avisoAnulada}>Anulada por el tribunal: no puntúa.</p>}
          {p.contexto && <p className={styles.contexto}>{p.contexto}</p>}
          <h2 className={styles.enunciado}>{p.enunciado}</h2>
          {p.codigo && (
            <pre className={styles.codigo}>
              <code>{p.codigo}</code>
            </pre>
          )}
        </>
      )}
      {revelada && !p.anulada && (
        <p className={clsx(styles.veredictoGeneral, acierto ? styles.vgAcierto : styles.vgFallo)} role="status">
          {respuesta == null
            ? `En blanco. La correcta es la ${LETRAS[correcta]}.`
            : acierto
              ? 'Acertada.'
              : `Fallada. La correcta es la ${LETRAS[correcta]}.`}
        </p>
      )}

      <ol className={styles.opciones}>
        {p.opciones.map((o, j) => {
          const elegida = respuesta === j;
          const estado = revelada ? (o.correcta ? 'correcta' : elegida ? 'fallo' : 'neutra') : elegida ? 'elegida' : 'libre';
          const contenido = (
            <>
              <span className={styles.burbuja} aria-hidden="true">
                {LETRAS[j]}
              </span>
              <span className={styles.textoOpcion}>{o.texto}</span>
            </>
          );
          return (
            <li key={j} className={clsx(styles.opcion, styles[`opcion_${estado}`])}>
              {onResponder ? (
                <button
                  type="button"
                  className={styles.opcionBoton}
                  aria-pressed={elegida}
                  onClick={() => onResponder(j)}>
                  <span className={styles.srOnly}>Opción {LETRAS[j]}: </span>
                  {contenido}
                </button>
              ) : (
                <div className={styles.opcionBoton}>{contenido}</div>
              )}
              {revelada && (
                <div className={styles.explicacion}>
                  <p className={styles.veredicto}>
                    {o.correcta ? 'Correcta' : elegida ? 'Tu respuesta, incorrecta' : 'Incorrecta'}
                  </p>
                  <p>{o.explicacion}</p>
                  {o.fuente && o.fuente !== '—' && <p className={styles.fuente}>Fuente: {o.fuente}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {revelada && (p.nota || p.confianza === 'media') && (
        <aside className={styles.nota}>
          {p.confianza === 'media' && <p>Respuesta pendiente de verificar con la plantilla oficial.</p>}
          {p.nota && <p>{p.nota}</p>}
        </aside>
      )}

      {revelada && <ExplicacionGemini pregunta={p} respuesta={respuesta} />}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Resultados                                                         */
/* ------------------------------------------------------------------ */

function Resultados({
  sesion,
  onNueva,
  onSalir,
}: {
  sesion: Sesion;
  onNueva: (s: Sesion) => void;
  onSalir: () => void;
}) {
  const res = corregir(sesion);
  const desglose = corregirPorGrupo(sesion);
  const porGrupo =
    sesion.simulacro !== 'gsi' && desglose.I.puntuables > 0 && desglose.II.puntuables > 0 ? desglose : null;
  const [filtro, setFiltro] = useState<'todas' | 'mal'>('mal');
  const duracion = (sesion.fin ?? Date.now()) - sesion.inicio;

  const repasables = sesion.preguntas.filter((p, i) => {
    if (p.anulada) return false;
    const r = sesion.respuestas[i];
    return r == null || !p.opciones[r]?.correcta;
  });

  const indices = sesion.preguntas
    .map((_, i) => i)
    .filter((i) => {
      if (filtro === 'todas') return true;
      const p = sesion.preguntas[i];
      const r = sesion.respuestas[i];
      return !p.anulada && (r == null || !p.opciones[r]?.correcta);
    });

  return (
    <section className={styles.panel} aria-labelledby="res-titulo">
      <h1 id="res-titulo" className={styles.titulo}>
        {sesion.simulacro
          ? `${SIMULACROS.find((t) => t.id === sesion.simulacro)?.titulo} corregido`
          : sesion.modo === 'examen'
            ? 'Examen corregido'
            : 'Resumen del test'}
      </h1>

      <div className={styles.marcador}>
        <p className={styles.nota10}>
          {res.nota.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          <span className={styles.sobre}> sobre 10</span>
        </p>
        <dl className={styles.cifras}>
          <div>
            <dt>Aciertos</dt>
            <dd>{res.aciertos}</dd>
          </div>
          <div>
            <dt>Errores</dt>
            <dd>{res.errores}</dd>
          </div>
          <div>
            <dt>En blanco</dt>
            <dd>{res.blancos}</dd>
          </div>
          <div>
            <dt>Netas</dt>
            <dd>{res.netas.toLocaleString('es-ES', {maximumFractionDigits: 2})}</dd>
          </div>
          <div>
            <dt>Tiempo</dt>
            <dd>{formatoTiempo(duracion)}</dd>
          </div>
        </dl>
        <p className={styles.tenue}>Netas = aciertos − errores ÷ 3. Las anuladas no cuentan.</p>
        {porGrupo && (
          <div className={styles.tablaScroll}>
          <table className={styles.tablaGrupos}>
            <caption className={styles.srOnly}>Resultado por grupo del programa</caption>
            <thead>
              <tr>
                <th scope="col">Grupo</th>
                <th scope="col">Total</th>
                <th scope="col">Bien</th>
                <th scope="col">Mal</th>
                <th scope="col">Blanco</th>
                <th scope="col">Nota</th>
              </tr>
            </thead>
            <tbody>
              {(['I', 'II'] as const).map((g) => (
                <tr key={g}>
                  <th scope="row">{g === 'I' ? 'Grupo I' : 'Grupo II'}</th>
                  <td>{porGrupo[g].puntuables}</td>
                  <td>{porGrupo[g].aciertos}</td>
                  <td>{porGrupo[g].errores}</td>
                  <td>{porGrupo[g].blancos}</td>
                  <td>{porGrupo[g].nota.toLocaleString('es-ES', {maximumFractionDigits: 2})}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <Hoja sesion={sesion} revelar completa />

      <div className={styles.acciones}>
        {repasables.length > 0 && (
          <button className={styles.primario} onClick={() => onNueva(nuevaSesion('estudio', repasables))}>
            Repasar {repasables.length} falladas y en blanco
          </button>
        )}
        <button className={styles.secundario} onClick={onSalir}>
          Nuevo test
        </button>
      </div>

      <h2 className={styles.subtitulo}>Revisión</h2>
      <div className={styles.segmentadoMini} role="radiogroup" aria-label="Qué preguntas revisar">
        {(['mal', 'todas'] as const).map((f) => (
          <label key={f} className={clsx(styles.chip, filtro === f && styles.chipActivo)}>
            <input type="radio" name="filtro" checked={filtro === f} onChange={() => setFiltro(f)} />
            {f === 'mal' ? 'Falladas y en blanco' : 'Todas'}
          </label>
        ))}
      </div>

      {indices.length === 0 && <p>Ninguna fallada ni en blanco. Buen trabajo.</p>}
      <ol className={styles.revision}>
        {indices.map((i) => {
          const p = sesion.preguntas[i];
          const r = sesion.respuestas[i];
          const estado = estadoCasilla(sesion, i, true);
          const correcta = indiceCorrecta(p);
          return (
            <li key={p.id}>
              <details className={styles.revItem}>
                <summary>
                  <span className={clsx(styles.casilla, styles[`casilla_${estado}`])} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.revTexto}>
                    {p.enunciado}
                    <span className={styles.tenue}>
                      {' '}
                      {r == null ? 'En blanco' : `Marcaste ${LETRAS[r]}`}
                      {correcta >= 0 && !p.anulada ? `, correcta ${LETRAS[correcta]}` : ''}
                    </span>
                  </span>
                </summary>
                <PreguntaVista pregunta={p} respuesta={r} revelada sinEnunciado />
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
