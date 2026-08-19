import {
  useState,
  useRef,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  validatePhotoFile,
  fileToImageElement,
  detectFaceInImage,
  cropImageToSquare,
  type FaceDetectionResult,
  type CropResult,
  type SquareCropBox,
} from "../lib/face-detect";

export interface PhotoUploadProps {
  onPhotoReady: (croppedBlob: Blob, previewUrl: string, originalFile: File) => void;
  onCancel?: () => void;
  initialPreviewUrl?: string;
  disabled?: boolean;
}

type UploadState = "idle" | "analyzing" | "detected" | "error";

export function PhotoUpload({
  onPhotoReady,
  onCancel,
  initialPreviewUrl,
  disabled = false,
}: PhotoUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>(
    initialPreviewUrl ? "detected" : "idle"
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionResult, setDetectionResult] = useState<FaceDetectionResult | null>(null);
  const [cropResult, setCropResult] = useState<CropResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<"crop" | "original">("crop");
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function processSelectedFile(file: File) {
    const validation = validatePhotoFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.message || "Archivo inválido.");
      setUploadState("error");
      return;
    }

    setSelectedFile(file);
    setUploadState("analyzing");
    setErrorMessage(null);
    setDetectionResult(null);
    setCropResult(null);

    try {
      const img = await fileToImageElement(file);
      setOriginalDataUrl(img.src);

      const detection = await detectFaceInImage(img);

      if (!detection.detected || !detection.cropBox) {
        setErrorMessage(
          detection.message || "No se detectó ningún rostro en la foto. Probá con otra selfie."
        );
        setDetectionResult(detection);
        setUploadState("error");
        return;
      }

      const cropped = await cropImageToSquare(img, detection.cropBox, 512);

      setDetectionResult(detection);
      setCropResult(cropped);
      setUploadState("detected");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la imagen.";
      setErrorMessage(msg);
      setUploadState("error");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled && uploadState !== "analyzing") {
      setIsDragging(true);
    }
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled || uploadState === "analyzing") return;

    const file = event.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setDetectionResult(null);
    setCropResult(null);
    setErrorMessage(null);
    setConsentChecked(false);
    setOriginalDataUrl(null);
    setUploadState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function handleConfirm(event: FormEvent) {
    event.preventDefault();
    if (!cropResult || !selectedFile || !consentChecked || disabled) return;

    onPhotoReady(cropResult.blob, cropResult.dataUrl, selectedFile);
  }

  const confidencePercent = detectionResult?.face?.confidence
    ? Math.round(detectionResult.face.confidence * 100)
    : null;

  return (
    <section style={styles.card} aria-labelledby="photo-upload-title">
      <header style={styles.header}>
        <p style={styles.eyebrow}>FOTO DEL BOXEADOR</p>
        <h2 id="photo-upload-title" style={styles.title}>
          Subí tu foto de ring
        </h2>
        <p style={styles.subtitle}>
          Detectamos tu rostro en el cliente para que el avatar de IA conserve tu identidad.
        </p>
      </header>

      {/* ESTADO 1: IDLE / DROPZONE */}
      {uploadState === "idle" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            ...styles.dropzone,
            borderColor: isDragging ? "#e23b2e" : "#f2c14e",
            background: isDragging ? "#2e221a" : "#1f1712",
          }}
        >
          <div style={styles.iconCircle}>🥊</div>
          <p style={styles.dropzoneTitle}>Arrastrá tu foto acá</p>
          <p style={styles.dropzoneHint}>JPG, PNG o WEBP (máx. 10 MB)</p>

          <div style={styles.buttonRow}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              style={styles.primaryButton}
            >
              Seleccionar foto
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled}
              style={styles.secondaryButton}
            >
              Tomar selfie
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={disabled}
                style={styles.cancelButton}
              >
                Volver
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* ESTADO 2: ANALIZANDO ROSTRO */}
      {uploadState === "analyzing" && (
        <div style={styles.loadingContainer} aria-live="polite">
          <div style={styles.spinner} />
          <p style={styles.loadingTitle}>ANALIZANDO ROSTRO…</p>
          <p style={styles.loadingSubtitle}>
            Buscando tu guardia en el ring y calculando encuadre 1:1.
          </p>
        </div>
      )}

      {/* ESTADO 3: ERROR / NO SE DETECTÓ ROSTRO */}
      {uploadState === "error" && (
        <div style={styles.errorContainer} role="alert">
          <div style={styles.errorBadge}>⚠️ ATENCIÓN</div>
          <h3 style={styles.errorTitle}>No pudimos validar la foto</h3>
          <p style={styles.errorDescription}>{errorMessage}</p>

          <div style={styles.errorTips}>
            <p style={styles.tipHeader}>Consejos para una buena foto:</p>
            <ul style={styles.tipList}>
              <li>Mirá directo a la cámara con buena luz frontal.</li>
              <li>Asegurate de que no haya anteojos oscuros o manos tapando la cara.</li>
              <li>La foto debe tener a una sola persona.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={styles.primaryButton}
          >
            Intentar con otra foto
          </button>
        </div>
      )}

      {/* ESTADO 4: ROSTRO DETECTADO Y RECORTADO */}
      {uploadState === "detected" && cropResult && (
        <form onSubmit={handleConfirm} style={styles.detectedContainer}>
          <div style={styles.successBadge}>
            ✓ Rostro detectado {confidencePercent ? `(${confidencePercent}% confianza)` : ""}
          </div>

          {/* Toggle de vistas: recorte 1:1 vs foto original */}
          <div style={styles.tabsRow}>
            <button
              type="button"
              onClick={() => setViewMode("crop")}
              style={{
                ...styles.tabButton,
                ...(viewMode === "crop" ? styles.tabButtonActive : {}),
              }}
            >
              Recorte 1:1 (Avatar)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("original")}
              style={{
                ...styles.tabButton,
                ...(viewMode === "original" ? styles.tabButtonActive : {}),
              }}
            >
              Encuadre original
            </button>
          </div>

          <div style={styles.previewFrame}>
            {viewMode === "crop" ? (
              <img
                src={cropResult.dataUrl}
                alt="Vista previa del recorte 1:1 para el avatar"
                style={styles.previewImageSquare}
              />
            ) : (
              <div style={styles.originalOverlayWrapper}>
                {originalDataUrl && (
                  <img
                    src={originalDataUrl}
                    alt="Foto original"
                    style={styles.previewImageFull}
                  />
                )}
                {detectionResult?.cropBox && (
                  <CropOverlayBox cropBox={detectionResult.cropBox} />
                )}
              </div>
            )}
          </div>

          {/* Checkbox de consentimiento obligatorio (PRD §3 / Spec 02) */}
          <label style={styles.consentLabel}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              disabled={disabled}
              style={styles.checkbox}
            />
            <span style={styles.consentText}>
              Subo mi propia foto (o tengo permiso explícito) y acepto generar un
              avatar de boxeo caricaturesco con IA.
            </span>
          </label>

          {/* Botones de acción */}
          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={handleReset}
              disabled={disabled}
              style={styles.secondaryButton}
            >
              Cambiar foto
            </button>
            <button
              type="submit"
              disabled={!consentChecked || disabled}
              style={{
                ...styles.primaryButton,
                opacity: !consentChecked || disabled ? 0.55 : 1,
              }}
            >
              Usar esta foto
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function CropOverlayBox({ cropBox }: { cropBox: SquareCropBox }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${cropBox.x}px`,
        top: `${cropBox.y}px`,
        width: `${cropBox.size}px`,
        height: `${cropBox.size}px`,
        border: "2px solid #f2c14e",
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        pointerEvents: "none",
      }}
    />
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  card: {
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "10px 10px 0 #ad2e24",
    boxSizing: "border-box",
    color: "#fff8e7",
    fontFamily: "Georgia, serif",
    maxWidth: "480px",
    padding: "clamp(20px, 5vw, 36px)",
    width: "100%",
  },
  header: {
    marginBottom: "20px",
    textAlign: "center",
  },
  eyebrow: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.16em",
    margin: "0 0 6px",
  },
  title: {
    fontSize: "clamp(1.8rem, 6vw, 2.6rem)",
    lineHeight: 0.96,
    margin: "0 0 10px",
    textTransform: "uppercase",
  },
  subtitle: {
    color: "#d8cbbb",
    fontSize: "0.92rem",
    lineHeight: 1.45,
    margin: 0,
  },
  dropzone: {
    alignItems: "center",
    border: "3px dashed #f2c14e",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minHeight: "220px",
    padding: "24px 16px",
    textAlign: "center",
    transition: "background 0.2s, border-color 0.2s",
  },
  iconCircle: {
    fontSize: "2.5rem",
    marginBottom: "10px",
  },
  dropzoneTitle: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.3rem",
    letterSpacing: "0.05em",
    margin: "0 0 4px",
    textTransform: "uppercase",
  },
  dropzoneHint: {
    color: "#a89b8d",
    fontSize: "0.85rem",
    margin: "0 0 18px",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "center",
    width: "100%",
  },
  primaryButton: {
    background: "#e23b2e",
    border: "2px solid #ad2e24",
    color: "#ffffff",
    cursor: "pointer",
    flex: "1 1 140px",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.08em",
    minHeight: "44px",
    padding: "10px 16px",
    textTransform: "uppercase",
  },
  secondaryButton: {
    background: "#382c23",
    border: "2px solid #f2c14e",
    color: "#fff8e7",
    cursor: "pointer",
    flex: "1 1 120px",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.08em",
    minHeight: "44px",
    padding: "10px 16px",
    textTransform: "uppercase",
  },
  cancelButton: {
    background: "transparent",
    border: "2px solid #786555",
    color: "#d8cbbb",
    cursor: "pointer",
    flex: "1 1 90px",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.08em",
    minHeight: "44px",
    padding: "10px 16px",
    textTransform: "uppercase",
  },
  loadingContainer: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    minHeight: "200px",
    justifyContent: "center",
    padding: "24px",
    textAlign: "center",
  },
  spinner: {
    border: "4px solid #382c23",
    borderTop: "4px solid #f2c14e",
    borderRadius: "50%",
    height: "44px",
    marginBottom: "16px",
    width: "44px",
  },
  loadingTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.3rem",
    letterSpacing: "0.1em",
    margin: "0 0 8px",
  },
  loadingSubtitle: {
    color: "#d8cbbb",
    fontSize: "0.9rem",
    margin: 0,
  },
  errorContainer: {
    background: "#3a1412",
    border: "2px solid #e23b2e",
    boxSizing: "border-box",
    padding: "20px",
    textAlign: "left",
  },
  errorBadge: {
    color: "#fca5a5",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.12em",
    marginBottom: "6px",
  },
  errorTitle: {
    fontSize: "1.2rem",
    fontWeight: 700,
    margin: "0 0 8px",
  },
  errorDescription: {
    color: "#fecaca",
    fontSize: "0.92rem",
    lineHeight: 1.4,
    margin: "0 0 16px",
  },
  errorTips: {
    background: "rgba(0, 0, 0, 0.25)",
    borderLeft: "3px solid #f2c14e",
    marginBottom: "16px",
    padding: "10px 12px",
  },
  tipHeader: {
    color: "#f2c14e",
    fontSize: "0.85rem",
    fontWeight: 700,
    margin: "0 0 4px",
  },
  tipList: {
    color: "#d8cbbb",
    fontSize: "0.82rem",
    lineHeight: 1.4,
    margin: 0,
    paddingLeft: "18px",
  },
  detectedContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  successBadge: {
    alignSelf: "center",
    background: "#14532d",
    border: "2px solid #22c55e",
    color: "#86efac",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.06em",
    padding: "6px 14px",
    textTransform: "uppercase",
  },
  tabsRow: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
  },
  tabButton: {
    background: "#382c23",
    border: "1px solid #5a4638",
    color: "#d8cbbb",
    cursor: "pointer",
    fontSize: "0.85rem",
    minHeight: "36px",
    padding: "6px 12px",
  },
  tabButtonActive: {
    background: "#f2c14e",
    border: "1px solid #f2c14e",
    color: "#17120f",
    fontWeight: 700,
  },
  previewFrame: {
    alignItems: "center",
    background: "#0e0a08",
    border: "2px solid #5a4638",
    display: "flex",
    justifyContent: "center",
    maxHeight: "300px",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  previewImageSquare: {
    aspectRatio: "1/1",
    display: "block",
    maxHeight: "260px",
    maxWidth: "100%",
    objectFit: "cover",
  },
  originalOverlayWrapper: {
    maxHeight: "260px",
    maxWidth: "100%",
    overflow: "hidden",
    position: "relative",
  },
  previewImageFull: {
    display: "block",
    maxHeight: "260px",
    maxWidth: "100%",
    objectFit: "contain",
  },
  consentLabel: {
    alignItems: "flex-start",
    cursor: "pointer",
    display: "flex",
    gap: "10px",
    userSelect: "none",
  },
  checkbox: {
    accentColor: "#e23b2e",
    height: "20px",
    marginTop: "2px",
    width: "20px",
  },
  consentText: {
    color: "#d8cbbb",
    fontSize: "0.84rem",
    lineHeight: 1.4,
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    width: "100%",
  },
};
