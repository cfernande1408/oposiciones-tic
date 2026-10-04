import type {Banco, Pregunta} from '../lib/quiz';

// Carga automática: cualquier .json dentro de /preguntas aparece en la web.
// Formatos admitidos: { meta: {id, titulo}, preguntas: [...] } o un array de preguntas.
declare const require: {
  context(dir: string, sub: boolean, re: RegExp): {
    keys(): string[];
    (key: string): unknown;
  };
};

const ctx = require.context('../../preguntas', false, /\.json$/);

const vistos = new Set<string>();

export const BANCOS: Banco[] = ctx
  .keys()
  .filter((k) => k.startsWith('./'))
  .map((k) => {
    const raw = ctx(k) as any;
    const data = raw?.default ?? raw;
    const fichero = k.replace('./', '').replace(/\.json$/, '');
    const lista: any[] = Array.isArray(data) ? data : data.preguntas ?? [];
    const meta = Array.isArray(data) ? {} : data.meta ?? {};
    const id: string = meta.id ?? fichero;
    const preguntas: Pregunta[] = lista
      .filter((p) => {
        if (vistos.has(p.id)) {
          console.warn(`Pregunta duplicada ignorada: ${p.id} (${fichero})`);
          return false;
        }
        vistos.add(p.id);
        return true;
      })
      .map((p) => ({...p, banco: id}));
    return {id, titulo: meta.titulo ?? fichero, preguntas};
  })
  .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
