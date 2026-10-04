import React from 'react';
import Layout from '@theme/Layout';
import Quiz from '@site/src/components/Quiz';

export default function Inicio(): React.ReactElement {
  return (
    <Layout title="Test" description="Tests de oposiciones TIC con explicación de cada opción y su fuente">
      <main>
        <Quiz />
      </main>
    </Layout>
  );
}
