import React, {useEffect, useState} from 'react';
import type {Pregunta} from '../../lib/quiz';
import {
  URL_CLAVE,
  URL_GEMINI,
  construirPrompt,
  explicacionGuardada,
  guardarClave,
  guardarModelo,
  obtenerClave,
  obtenerModelo,
  pedirExplicacion,
} from '../../lib/gemini';
import styles from './styles.module.css';

// Markdown mínimo: párrafos, listas con «-» o «*» y negritas con **texto**.
function enLinea(t: string): React.ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith('**') && trozo.endsWith('**') ? <strong key={i}>{trozo.slice(2, -2)}</strong> : trozo,
  );
}
function Markdown({texto}: {texto: string}) {
  const bloques: React.ReactNode[] = [];
  let lista: string[] = [];
  const cerrarLista = () => {
    if (lista.length) {
      bloques.push(
        <ul key={`l${bloques.length}`}>
          {lista.map((li, i) => (
            <li key={i}>{enLinea(li)}</li>
          ))}
        </ul>,
      );
      lista = [];
    }
  };
  texto.split('\n').forEach((linea) => {
    const l = linea.trim();
    const item = l.match(/^([-*•]|\d+[.)])\s+(.*)/);
    if (item) {
      lista.push(item[2]);
      return;
    }
    cerrarLista();
    if (l) bloques.push(<p key={`p${bloques.length}`}>{enLinea(l.replace(/^#+\s*/, ''))}</p>);
  });
  cerrarLista();
  return <>{bloques}</>;
}

type Estado = {fase: 'inicio'} | {fase: 'cargando'} | {fase: 'ok'; texto: string} | {fase: 'error'; msg: string};

export default function ExplicacionGemini({pregunta, respuesta}: {pregunta: Pregunta; respuesta: number | null}) {
  const [estado, setEstado] = useState<Estado>({fase: 'inicio'});
  const [ajustes, setAjustes] = useState(false);
  const [clave, setClave] = useState('');
  const [modelo, setModelo] = useState('');
  const [hayClave, setHayClave] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setHayClave(!!obtenerClave());
    setModelo(obtenerModelo());
    const g = explicacionGuardada(pregunta.id);
    setEstado(g ? {fase: 'ok', texto: g} : {fase: 'inicio'});
    setAjustes(false);
    setCopiado(false);
  }, [pregunta.id]);

  const explicar = async () => {
    if (!obtenerClave()) {
      setAjustes(true);
      return;
    }
    setEstado({fase: 'cargando'});
    try {
      setEstado({fase: 'ok', texto: await pedirExplicacion(pregunta, respuesta)});
    } catch (e) {
      setEstado({fase: 'error', msg: e instanceof Error ? e.message : String(e)});
    }
  };

  const copiarYAbrir = async () => {
    try {
      await navigator.clipboard.writeText(construirPrompt(pregunta, respuesta));
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
    window.open(URL_GEMINI, '_blank', 'noopener');
  };

  return (
    <div className={styles.gemini}>
      {estado.fase !== 'ok' && (
        <div className={styles.geminiAcciones}>
          <button type="button" className={styles.secundario} onClick={explicar} disabled={estado.fase === 'cargando'}>
            {estado.fase === 'cargando' ? 'Preguntando a Gemini…' : 'Explícamelo con Gemini'}
          </button>
          <button type="button" className={styles.enlace} onClick={copiarYAbrir}>
            {copiado ? 'Copiado: pégalo en Gemini' : 'Copiar y abrir en Gemini'}
          </button>
        </div>
      )}

      {estado.fase === 'error' && <p className={styles.geminiError}>{estado.msg}</p>}

      {estado.fase === 'ok' && (
        <div className={styles.geminiRespuesta} aria-live="polite">
          <p className={styles.geminiTitulo}>Explicación de Gemini</p>
          <Markdown texto={estado.texto} />
          <p className={styles.geminiAviso}>
            Generada por IA: contrasta las cifras y artículos con la fuente del banco.
          </p>
        </div>
      )}

      {ajustes && (
        <div className={styles.geminiAjustes}>
          <p>
            Para ver la explicación aquí necesitas una clave gratuita de la API de Gemini.{' '}
            <a href={URL_CLAVE} target="_blank" rel="noopener noreferrer">
              Créala en Google AI Studio
            </a>{' '}
            y pégala. Se guarda solo en este navegador, nunca en la web.
          </p>
          <label className={styles.geminiCampo}>
            <span>Clave de la API</span>
            <input
              type="password"
              autoComplete="off"
              placeholder={hayClave ? 'Ya hay una clave guardada' : 'AIza…'}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </label>
          <label className={styles.geminiCampo}>
            <span>Modelo</span>
            <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </label>
          <div className={styles.geminiAcciones}>
            <button
              type="button"
              className={styles.primario}
              onClick={() => {
                if (clave) guardarClave(clave);
                guardarModelo(modelo);
                setHayClave(!!obtenerClave());
                setClave('');
                setAjustes(false);
                if (obtenerClave()) explicar();
              }}>
              Guardar y explicar
            </button>
            {hayClave && (
              <button
                type="button"
                className={styles.enlace}
                onClick={() => {
                  guardarClave(null);
                  setHayClave(false);
                }}>
                Borrar la clave
              </button>
            )}
          </div>
        </div>
      )}

      {hayClave && !ajustes && (
        <button type="button" className={styles.geminiConfig} onClick={() => setAjustes(true)}>
          Ajustes de Gemini
        </button>
      )}
    </div>
  );
}
