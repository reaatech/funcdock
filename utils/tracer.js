import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, propagation } from '@opentelemetry/api';

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'funcdock';

let sdk;
let tracer;
let tracerInitialized = false;

export const initTracer = () => {
  if (tracerInitialized) {
    return;
  }
  tracerInitialized = true;

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '2.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'production',
  });

  const instrumentations = [getNodeAutoInstrumentations()];

  if (OTEL_ENDPOINT) {
    const traceExporter = new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
    });

    sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations,
    });

    sdk.start();
  }

  tracer = trace.getTracer('funcdock-tracer', '2.0.0');
};

export const getTracer = () => {
  if (!tracer) {
    initTracer();
  }
  return tracer;
};

export const withSpan = async (name, attributes = {}, fn) => {
  const span = getTracer().startSpan(name, { attributes });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
};

export const shutdownTracer = async () => {
  if (sdk) {
    await sdk.shutdown();
  }
};

export { trace, context, propagation };
