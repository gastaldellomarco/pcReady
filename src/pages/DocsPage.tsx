import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui/dist/swagger-ui.css';

export default function DocsPage(): JSX.Element {
  return (
    <section style={{ padding: 16 }}>
      <h1>API Documentation</h1>
      <p>Interactive API documentation served with Swagger UI.</p>
      <div style={{ marginTop: 12 }}>
        <SwaggerUI url="/openapi.json" />
      </div>
    </section>
  );
}
