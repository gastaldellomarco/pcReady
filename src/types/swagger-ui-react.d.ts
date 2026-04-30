declare module "swagger-ui-react" {
  import type { ComponentType } from "react";

  interface SwaggerRequest {
    headers?: Record<string, string>;
    [key: string]: unknown;
  }

  interface SwaggerUIProps {
    url?: string;
    spec?: unknown;
    docExpansion?: "list" | "full" | "none";
    defaultModelsExpandDepth?: number;
    persistAuthorization?: boolean;
    requestInterceptor?: (request: SwaggerRequest) => SwaggerRequest | Promise<SwaggerRequest>;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}
