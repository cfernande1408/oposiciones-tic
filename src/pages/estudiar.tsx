import React from 'react';
import Layout from '@theme/Layout';
import Plan from '@site/src/components/Plan';

export default function Estudiar(): React.ReactElement {
  return (
    <Layout title="Plan de estudio" description="Planifica el estudio por meses hasta el examen">
      <main>
        <Plan />
      </main>
    </Layout>
  );
}
