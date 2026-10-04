import React, {useEffect, useMemo, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {BANCOS} from '../../data/bancos';
import {TEMAS, nombreTema} from '../../data/temas';
import {cargarStats, type Stats} from '../../lib/quiz';
import {
  calcularPesos,
  construirSemanas,
  generarPlan,
  nombreMes,
  type Fase,
  type Oposicion,
} from '../../lib/plan';
import styles from './styles.module.css';

const TODAS = BANCOS.flatMap((b) => b.preguntas);
const KEY = 'opos:plan:v1';
// Temas propios del Ayuntamiento que no están en el temario de GSI.
const SOLO_MADRID = new Set([3, 4, 5, 6, 12, 13]);

type Config = {
  oposicion: Oposicion;
  inicio: string;
  examen: string;
  horas: number;
  ajustes: Record<string, number>;
  dominados: number[];
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const masDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const aFecha = (s: string) => new Date(`${s}T00:00:00`);
const fmt = (d: Date) => d.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'});
const horasTxt = (h: number) => `${Math.round(h * 2) / 2} h`.replace('.', ',');

const NOMBRE_FASE: Record<Fase, string> = {
  primera: 'Primera vuelta',
  segunda: 'Segunda vuelta',
  final: 'Repaso final',
};

export default function Plan(): React.ReactElement {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    setStats(cargarStats());
    let guardada: Config | null = null;
    try {
      guardada = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      /* ignorar */
    }
    setCfg(
      guardada ?? {oposicion: 'madrid', inicio: hoyISO(), examen: masDias(28), horas: 10, ajustes: {}, dominados: []},
    );
  }, []);

  useEffect(() => {
    if (!cfg) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {
      /* ignorar */
    }
  }, [cfg]);

  const set = (p: Partial<Config>) => setCfg((c) => (c ? {...c, ...p} : c));

  const temas = useMemo(
    () =>
      Object.keys(TEMAS)
        .map(Number)
        .filter((t) => cfg?.oposicion !== 'gsi' || !SOLO_MADRID.has(t)),
    [cfg?.oposicion],
  );

  const pesos = useMemo(
    () => (cfg ? calcularPesos(cfg.oposicion, temas, TODAS, stats, new Set(cfg.dominados)) : []),
    [cfg, temas, stats],
  );

  const semanas = useMemo(() => {
    if (!cfg || !cfg.examen || !cfg.inicio) return [];
    return construirSemanas(aFecha(cfg.inicio), aFecha(cfg.examen), cfg.horas, cfg.ajustes);
  }, [cfg]);

  const plan = useMemo(() => generarPlan(semanas, pesos), [semanas, pesos]);

  if (!cfg) return <section className={styles.panel} />;

  const total = semanas.reduce((a, s) => a + s.horas, 0);
  const horasPrimera = semanas.filter((s) => s.fase === 'primera').reduce((a, s) => a + s.horas, 0);
  const porTema = temas.length ? horasPrimera / temas.length : 0;
  const tramo = (f: Fase) => {
    const ss = semanas.filter((s) => s.fase === f);
    return ss.length ? `${fmt(ss[0].inicio)} – ${fmt(new Date(ss[ss.length - 1].inicio.getTime() + 6 * 86_400_000))}` : null;
  };
  const fallosConocidos = pesos.filter((p) => p.fallo != null).length;

  return (
    <section className={styles.panel} aria-labelledby="plan-titulo">
      <h1 id="plan-titulo" className={styles.titulo}>
        Plan de estudio
      </h1>
      <p className={styles.intro}>
        Reparte las horas que tienes hasta el examen según lo que más pregunta cada tribunal y lo que más fallas tú. Cambia
        las horas de cualquier mes y el plan se recalcula.
      </p>

      <div className={styles.config}>
        <fieldset className={styles.campo}>
          <legend>Oposición</legend>
          <div className={styles.segmentado}>
            {(['madrid', 'gsi'] as Oposicion[]).map((o) => (
              <label key={o} className={clsx(styles.segmento, cfg.oposicion === o && styles.segmentoActivo)}>
                <input type="radio" name="opo" checked={cfg.oposicion === o} onChange={() => set({oposicion: o})} />
                {o === 'madrid' ? 'Ayto. Madrid' : 'GSI (AGE)'}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.campo}>
          <span>Empiezo el</span>
          <input type="date" value={cfg.inicio} onChange={(e) => set({inicio: e.target.value})} />
        </label>
        <label className={styles.campo}>
          <span>Examen el</span>
          <input type="date" value={cfg.examen} onChange={(e) => set({examen: e.target.value})} />
        </label>
        <label className={styles.campo}>
          <span>Horas por semana</span>
          <input
            type="number"
            min={1}
            max={80}
            inputMode="numeric"
            value={cfg.horas}
            onChange={(e) => set({horas: Math.max(1, Number(e.target.value) || 1)})}
          />
        </label>
      </div>
      <p className={styles.ayuda}>
        ¿Aún no hay fecha? Calcula desde la convocatoria: en GSI el examen suele caer unos 5 meses después (diciembre → mayo).
      </p>

      {semanas.length === 0 ? (
        <p className={styles.aviso}>La fecha del examen tiene que ser posterior a la de inicio.</p>
      ) : (
        <>
          <div className={styles.resumen}>
            <p className={styles.cifra}>
              {semanas.length} <span>semanas</span>
            </p>
            <p className={styles.cifra}>
              {Math.round(total)} <span>horas</span>
            </p>
            <p className={styles.cifra}>
              {horasTxt(porTema)} <span>por tema en 1.ª vuelta</span>
            </p>
          </div>
          <ol className={styles.fases}>
            {(['primera', 'segunda', 'final'] as Fase[]).map((f) =>
              tramo(f) ? (
                <li key={f} className={styles[`fase_${f}`]}>
                  <strong>{NOMBRE_FASE[f]}</strong> {tramo(f)}
                </li>
              ) : null,
            )}
          </ol>
          {Math.round(porTema * 2) / 2 < 3 && (
            <p className={styles.aviso}>
              Con menos de 3 horas por tema no da para estudiarlo todo a fondo. El plan va primero a lo que más cae: si no
              llegas, lo que queda al final es lo que menos rinde.
            </p>
          )}

          <ol className={styles.meses}>
            {plan.map((m) => (
              <li key={m.mes} className={styles.mes}>
                <div className={styles.mesCabecera}>
                  <h2>{nombreMes(m.mes)}</h2>
                  <label className={styles.ajuste}>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      inputMode="numeric"
                      value={cfg.ajustes[m.mes] ?? ''}
                      placeholder={String(cfg.horas)}
                      aria-label={`Horas por semana en ${nombreMes(m.mes)}`}
                      onChange={(e) => {
                        const ajustes = {...cfg.ajustes};
                        if (e.target.value === '') delete ajustes[m.mes];
                        else ajustes[m.mes] = Math.max(0, Number(e.target.value));
                        set({ajustes});
                      }}
                    />
                    h/sem
                  </label>
                </div>
                <p className={styles.mesMeta}>
                  {horasTxt(m.horas)} en total. {m.fases.map((f) => NOMBRE_FASE[f]).join(' y ')}.
                </p>

                {m.primera.length > 0 && (
                  <>
                    <h3>Estudiar y hacer el test del tema</h3>
                    <ul className={styles.temas}>
                      {m.primera.map((a) => (
                        <li key={a.tema}>
                          <span>{nombreTema(a.tema)}</span>
                          <span className={styles.h}>{horasTxt(a.horas)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {m.segunda.length > 0 && (
                  <>
                    <h3>Repasar y volver a testear</h3>
                    <ul className={styles.temas}>
                      {m.segunda.map((a) => (
                        <li key={a.tema}>
                          <span>{nombreTema(a.tema)}</span>
                          <span className={styles.h}>{horasTxt(a.horas)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {m.simulacros > 0 && (
                  <>
                    <h3>Repaso final</h3>
                    <p className={styles.final}>
                      {m.simulacros} {m.simulacros === 1 ? 'simulacro' : 'simulacros'} (uno por semana) y el resto del tiempo
                      repasar falladas. <Link to="/">Ir a los tests</Link>
                    </p>
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <details className={styles.prioridad}>
        <summary>Prioridad de los temas ({temas.length})</summary>
        <p className={styles.ayuda}>
          Peso = preguntas en exámenes reales de {cfg.oposicion === 'madrid' ? 'Madrid' : 'GSI'} × tu tasa de fallo
          {fallosConocidos ? '' : ' (cuando hagas tests, se ajusta solo)'}. Marca los que ya dominas para reducir su tiempo.
        </p>
        <div className={styles.tablaScroll}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th scope="col">Tema</th>
                <th scope="col">En exámenes</th>
                <th scope="col">Tu fallo</th>
                <th scope="col">Lo domino</th>
              </tr>
            </thead>
            <tbody>
              {[...pesos]
                .sort((a, b) => b.peso - a.peso)
                .map((p) => (
                  <tr key={p.tema}>
                    <th scope="row">{nombreTema(p.tema)}</th>
                    <td>{p.enExamenes}</td>
                    <td>{p.fallo == null ? '—' : `${Math.round(p.fallo * 100)} %`}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Domino el tema ${p.tema}`}
                        checked={cfg.dominados.includes(p.tema)}
                        onChange={(e) =>
                          set({
                            dominados: e.target.checked
                              ? [...cfg.dominados, p.tema]
                              : cfg.dominados.filter((t) => t !== p.tema),
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
