const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

type PredictionStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

interface ReplicatePrediction {
  id: string;
  status: PredictionStatus;
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
}

export interface ReplicateInput {
  version: string;
  input: Record<string, unknown>;
}

export interface ReplicateOptions {
  maxAttempts?: number;
  maxPolls?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  requestTimeoutMs?: number;
}

export class ReplicateError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = "ReplicateError";
  }
}

const sleep = (milliseconds: number): void => {
  // WHY: Nakama's Goja runtime is synchronous and has no timer API; keep waits
  // bounded so polling backs off without an unbounded hot loop.
  const until = Date.now() + milliseconds;
  while (Date.now() < until) {
    // Intentionally empty.
  }
};

const parsePrediction = (body: string): ReplicatePrediction => {
  try {
    return JSON.parse(body) as ReplicatePrediction;
  } catch (_error) {
    throw new ReplicateError("Replicate devolvió JSON inválido", "INVALID_RESPONSE");
  }
};

const requestWithRetry = (
  nk: nkruntime.Nakama,
  url: string,
  method: nkruntime.RequestMethod,
  headers: Record<string, string>,
  body: string | undefined,
  options: Required<ReplicateOptions>
): ReplicatePrediction => {
  let backoffMs = options.initialBackoffMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = nk.httpRequest(
        url,
        method,
        headers,
        body,
        options.requestTimeoutMs
      );

      if (response.code >= 200 && response.code < 300) {
        return parsePrediction(response.body);
      }

      const retryable = response.code === 429 || response.code >= 500;
      if (!retryable || attempt === options.maxAttempts) {
        throw new ReplicateError(
          `Replicate respondió HTTP ${response.code}`,
          "HTTP_ERROR",
          response.code
        );
      }
    } catch (error) {
      if (error instanceof ReplicateError || attempt === options.maxAttempts) {
        if (error instanceof ReplicateError) throw error;
        throw new ReplicateError("Falló la conexión con Replicate", "NETWORK_ERROR");
      }
    }

    sleep(backoffMs);
    backoffMs = Math.min(backoffMs * 2, options.maxBackoffMs);
  }

  throw new ReplicateError("Se agotaron los reintentos", "RETRIES_EXHAUSTED");
};

const getOutputUrl = (prediction: ReplicatePrediction): string => {
  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== "string" || url.length === 0) {
    throw new ReplicateError("Replicate no devolvió una imagen", "MISSING_OUTPUT");
  }
  return url;
};

export const generateReplicateImage = (
  nk: nkruntime.Nakama,
  apiToken: string,
  request: ReplicateInput,
  overrides: ReplicateOptions = {}
): string => {
  if (!apiToken) {
    throw new ReplicateError("Falta el token de Replicate", "MISSING_API_TOKEN");
  }

  const options: Required<ReplicateOptions> = {
    maxAttempts: overrides.maxAttempts ?? 3,
    maxPolls: overrides.maxPolls ?? 12,
    initialBackoffMs: overrides.initialBackoffMs ?? 100,
    maxBackoffMs: overrides.maxBackoffMs ?? 1_000,
    requestTimeoutMs: overrides.requestTimeoutMs ?? 15_000,
  };
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    Prefer: "wait=10",
  };

  let prediction = requestWithRetry(
    nk,
    REPLICATE_API_URL,
    "post",
    headers,
    JSON.stringify(request),
    options
  );

  for (let poll = 0; poll < options.maxPolls; poll += 1) {
    if (prediction.status === "succeeded") return getOutputUrl(prediction);
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new ReplicateError(
        prediction.error || `Prediction ${prediction.status}`,
        "PREDICTION_FAILED"
      );
    }

    const statusUrl = prediction.urls?.get;
    if (!statusUrl) {
      throw new ReplicateError("Prediction sin URL de estado", "MISSING_STATUS_URL");
    }

    sleep(Math.min(options.initialBackoffMs * 2 ** poll, options.maxBackoffMs));
    prediction = requestWithRetry(
      nk,
      statusUrl,
      "get",
      headers,
      undefined,
      options
    );
  }

  throw new ReplicateError("Timeout esperando la imagen", "POLL_TIMEOUT");
};
