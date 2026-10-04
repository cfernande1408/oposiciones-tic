import {LETRAS, type Pregunta} from './quiz';

// La clave de la API de Gemini la pone cada usuario y vive solo en su navegador:
// nunca se incluye en el repositorio ni en la web publicada.
const K_CLAVE = 'opos:gemini:clave';
const K_MODELO = 'opos:gemini:modelo';
const K_CACHE = 'opos:gemini:cache:v1';
export const MODELO_POR_DEFECTO = 'gemini-flash-latest';
export const URL_CLAVE = 'https://aistudio.google.com/apikey';
export const URL_GEMINI = 'https://gemini.google.com/app';

const leer = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const escribir = (k: string, v: string | null) => {
  try {
    if (v == null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* almacenamiento no disponible */
  }
};

export const obtenerClave = () => leer(K_CLAVE);
export const guardarClave = (c: string | null) => escribir(K_CLAVE, c && c.trim() ? c.trim() : null);
export const obtenerModelo = () => leer(K_MODELO) || MODELO_POR_DEFECTO;
export const guardarModelo = (m: string) => escribir(K_MODELO, m.trim() || null);

function leerCache(): Record<string, string> {
  try {
    return JSON.parse(leer(K_CACHE) || '{}');
  } catch {
    return {};
  }
}
export const explicacionGuardada = (id: string): string | null => leerCache()[id] ?? null;
const guardarExplicacion = (id: string, texto: string) => {
  const c = leerCache();
  c[id] = texto;
  escribir(K_CACHE, JSON.stringify(c));
};

export function construirPrompt(p: Pregunta, respuesta: number | null): string {
  const opciones = p.opciones
    .map((o, i) => `${LETRAS[i]}) ${o.texto}${o.correcta ? '  [CORRECTA]' : ''}`)
    .join('\n');
  const banco = p.opciones
    .map((o, i) => `${LETRAS[i]}) ${o.explicacion}${o.fuente && o.fuente !== '—' ? ` (Fuente: ${o.fuente})` : ''}`)
    .join('\n');
  const marcada = respuesta == null ? 'la dejó en blanco' : `marcó la ${LETRAS[respuesta]}`;
  return [
    'Eres preparador de oposiciones TIC de la Administración española (Técnico Medio TIC del Ayuntamiento de Madrid y GSI de la AGE).',
    'Explica esta pregunta de test a un opositor con base técnica.',
    '',
    `PREGUNTA: ${p.enunciado}`,
    p.codigo ? `CÓDIGO:\n${p.codigo}` : '',
    `OPCIONES:\n${opciones}`,
    `El opositor ${marcada}.`,
    `NOTAS DEL BANCO DE PREGUNTAS:\n${banco}`,
    p.nota ? `NOTA: ${p.nota}` : '',
    '',
    'Instrucciones:',
    '- En español y en un máximo de 180 palabras, sin introducción ni despedida.',
    '- Primero, por qué la correcta es correcta, explicando el concepto de fondo.',
    '- Después, una línea por cada opción incorrecta diciendo por qué no lo es.',
    '- Termina con un truco breve para recordarlo en el examen.',
    '- Si citas normativa, cita solo artículos que aparezcan en las notas o de los que estés seguro. Si no estás seguro de algo, dilo.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function pedirExplicacion(p: Pregunta, respuesta: number | null): Promise<string> {
  const guardada = explicacionGuardada(p.id);
  if (guardada) return guardada;
  const clave = obtenerClave();
  if (!clave) throw new Error('Falta la clave de la API de Gemini.');
  const modelo = obtenerModelo();
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-goog-api-key': clave},
      body: JSON.stringify({
        contents: [{role: 'user', parts: [{text: construirPrompt(p, respuesta)}]}],
        generationConfig: {temperature: 0.3, maxOutputTokens: 1024},
      }),
    },
  );
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = datos?.error?.message ?? `Error ${r.status}`;
    if (r.status === 400 || r.status === 403) throw new Error(`Gemini rechazó la petición: ${msg}. Revisa la clave.`);
    if (r.status === 404) throw new Error(`El modelo «${modelo}» no existe: cámbialo en los ajustes.`);
    if (r.status === 429) throw new Error('Has superado la cuota gratuita de Gemini. Prueba en un rato.');
    throw new Error(msg);
  }
  const texto: string = (datos?.candidates?.[0]?.content?.parts ?? [])
    .map((x: {text?: string}) => x.text ?? '')
    .join('')
    .trim();
  if (!texto) throw new Error('Gemini no devolvió texto. Prueba otra vez.');
  guardarExplicacion(p.id, texto);
  return texto;
}
