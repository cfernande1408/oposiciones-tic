import React from 'react';
import Layout from '@theme/Layout';
import Quiz from '@site/src/components/Quiz';

export default function Inicio(): React.ReactElement {
  return (
    <Layout title="Test" description="Tests de Técnico Medio TIC (Ayto. de Madrid) y GSI (AGE) con explicación de cada opción">
      <main>
        <Quiz />
      </main>
    </Layout>
  );
}
