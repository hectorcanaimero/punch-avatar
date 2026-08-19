import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { Client, Session } from "@heroiclabs/nakama-js";

import {
  AVATAR_STYLES,
  type AvatarStyle,
} from "../../../src/data/avatar-prompts";
import { PhotoUpload } from "../components/PhotoUpload";

export interface StyleCardMeta {
  id: AvatarStyle;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  accentColor: string;
  badge: string;
  previewBg: string;
}

export const STYLE_CARDS: Readonly<Record<AvatarStyle, StyleCardMeta>> = {
  pixar_3d: {
    id: "pixar_3d",
    name: "Pixar 3D",
    tagline: "Cinematográfico & Expresivo",
    description: "Renderizado 3D estilizado con iluminación suave, texturas ricas y volumen heroico.",
    icon: "🎬",
    accentColor: "#38bdf8",
    badge: "POPULAR",
    previewBg: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)",
  },
  anime_shonen: {
    id: "anime_shonen",
    name: "Anime Shonen",
    tagline: "Poderoso & Dinámico",
    description: "Líneas de acción marcadas, sombreado cel-shading y mirada feroz de protagonista.",
    icon: "⚡",
    accentColor: "#fbbf24",
    badge: "INTENSO",
    previewBg: "linear-gradient(135deg, #78350f 0%, #b45309 100%)",
  },
  comic_retro: {
    id: "comic_retro",
    name: "Comic Americano",
    tagline: "Vintage & Tinta Gruesa",
    description: "Estética de viñeta clásica con trama halftone de puntos, entintado fuerte y colores pop.",
    icon: "💥",
    accentColor: "#ef4444",
    badge: "CLÁSICO",
    previewBg: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)",
  },
  chibi: {
    id: "chibi",
    name: "Chibi Fighter",
    tagline: "Super Deformado & Cómico",
    description: "Cabeza gigante, cuerpo pequeño y guantes desproporcionados para máxima comedia.",
    icon: "🥊",
    accentColor: "#f472b6",
    badge: "DIVERTIDO",
    previewBg: "linear-gradient(135deg, #831843 0%, #be185d 100%)",
  },
  pixel_16bit: {
    id: "pixel_16bit",
    name: "Pixel 16-Bit",
    tagline: "Arcade Retro 90s",
    description: "Sprites nítidos de videojuego de peleas de 16 bits con paleta nostálgica.",
    icon: "🕹️",
    accentColor: "#a855f7",
    badge: "RETRO",
    previewBg: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)",
  },
};

export interface GenerationStage {
  percent: number;
  label: string;
  tip: string;
}

export const GENERATION_STAGES: ReadonlyArray<GenerationStage> = [
  {
    percent: 15,
    label: "Preparando foto y encuadre 1:1...",
    tip: "Asegurando que tu guardia y mirada queden centradas.",
  },
  {
    percent: 35,
    label: "Subiendo imagen al rincón del ring...",
    tip: "Generando firma segura para preservar tu privacidad.",
  },
  {
    percent: 60,
    label: "Entrenando modelo InstantID con tus rasgos...",
    tip: "Fijando tu identidad facial para que seas reconocible en el ring.",
  },
  {
    percent: 85,
    label: "Aplicando estilo caricaturesco y guantes...",
    tip: "Delineando músculos exagerados y detalles de boxeo.",
  },
  {
    percent: 100,
    label: "¡Avatar listo para noquear!",
    tip: "Guardando resultado en tu perfil de peleador.",
  },
];

export function getGenerationStage(progress: number): GenerationStage {
  const clamped = Math.max(0, Math.min(100, progress));
  for (const stage of GENERATION_STAGES) {
    if (clamped <= stage.percent) {
      return stage;
    }
  }
  return GENERATION_STAGES[GENERATION_STAGES.length - 1];
}

export function formatAvatarError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("CONSENT_REQUIRED")) {
    return "Tenés que aceptar el consentimiento de uso de foto para generar tu avatar.";
  }
  if (msg.includes("NO_FACE_DETECTED") || msg.includes("FACE_TOO_SMALL")) {
    return "No se detectó un rostro claro. Probá con otra selfie bien iluminada.";
  }
  if (msg.includes("PHOTO_REQUIRED") || msg.includes("PHOTO_URL_REQUIRED")) {
    return "Falta seleccionar una foto de tu rostro.";
  }
  if (msg.includes("STYLE_REQUIRED") || msg.includes("STYLE_INVALID")) {
    return "Elegí un estilo de avatar válido entre las opciones.";
  }
  if (msg.includes("AUTH_REQUIRED")) {
    return "Sesión expirada o no autenticada. Por favor volvé a ingresar.";
  }
  if (msg.includes("UPLOAD_NOT_CONFIGURED") || msg.includes("CLOUDINARY_UPLOAD_FAILED")) {
    return "Error al subir la imagen al servidor. Verificá tu conexión e intentá de nuevo.";
  }
  if (msg.includes("REPLICATE") || msg.includes("TIMED_OUT")) {
    return "El motor de IA demoró más de lo esperado. Probá de nuevo en unos momentos.";
  }
  return "Ocurrió un error al generar tu avatar. Por favor reintentá.";
}

export function validateAvatarGenerationParams(
  photo: Blob | string | null,
  style: AvatarStyle | null,
  consent: boolean
): { valid: boolean; error?: string } {
  if (!photo) {
    return { valid: false, error: "PHOTO_REQUIRED" };
  }
  if (!style || !AVATAR_STYLES.includes(style)) {
    return { valid: false, error: "STYLE_REQUIRED" };
  }
  if (!consent) {
    return { valid: false, error: "CONSENT_REQUIRED" };
  }
  return { valid: true };
}

export type AvatarStudioStep = "upload" | "style_select" | "generating" | "result";

export interface AvatarStudioProps {
  client?: Client;
  session?: Session;
  initialPhotoUrl?: string;
  initialStyle?: AvatarStyle;
  onAvatarSaved?: (avatarUrl: string, style: AvatarStyle) => void;
  onBack?: () => void;
}

export function AvatarStudio({
  client,
  session,
  initialPhotoUrl,
  initialStyle = "pixar_3d",
  onAvatarSaved,
  onBack,
}: AvatarStudioProps) {
  const [step, setStep] = useState<AvatarStudioStep>(
    initialPhotoUrl ? "style_select" : "upload"
  );
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(
    initialPhotoUrl ?? null
  );
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>(initialStyle);
  const [consentChecked, setConsentChecked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  function handlePhotoReady(
    croppedBlob: Blob,
    previewUrl: string
  ) {
    setPhotoBlob(croppedBlob);
    setPhotoPreviewUrl(previewUrl);
    setConsentChecked(true);
    setErrorMessage(null);
    setStep("style_select");
  }

  function startProgressSimulation() {
    setProgress(10);
    setElapsedSeconds(0);

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const increment = Math.max(1, Math.floor((90 - prev) / 6));
        return Math.min(90, prev + increment);
      });
    }, 600);
  }

  function stopProgressSimulation(finalSuccess: boolean) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (finalSuccess) {
      setProgress(100);
    }
  }

  async function uploadPhotoDirectly(blob: Blob): Promise<string> {
    if (!client || !session) {
      // Standalone/mock fallback: use dataUrl or create object URL
      return photoPreviewUrl || URL.createObjectURL(blob);
    }

    try {
      const rpcRes = await client.rpc(session, "upload_photo_url", {});
      const payloadRaw = rpcRes.payload;
      const payload =
        typeof payloadRaw === "string" ? JSON.parse(payloadRaw) : payloadRaw;

      const { url, params } = payload as {
        url: string;
        params: Record<string, string>;
      };

      const formData = new FormData();
      for (const [k, v] of Object.entries(params)) {
        formData.append(k, v);
      }
      formData.append("file", blob, "avatar_face.jpg");

      const uploadRes = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`CLOUDINARY_UPLOAD_FAILED:${text}`);
      }

      const uploadData = await uploadRes.json();
      return uploadData.secure_url || uploadData.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UPLOAD_NOT_CONFIGURED") && photoPreviewUrl) {
        // En entorno dev sin Cloudinary configurado, pasar photoPreviewUrl
        return photoPreviewUrl;
      }
      throw err;
    }
  }

  async function handleGenerate(event?: FormEvent) {
    if (event) event.preventDefault();

    const photoTarget = photoBlob || photoPreviewUrl;
    const validation = validateAvatarGenerationParams(
      photoTarget,
      selectedStyle,
      consentChecked
    );

    if (!validation.valid) {
      setErrorMessage(formatAvatarError(validation.error));
      return;
    }

    setErrorMessage(null);
    setStep("generating");
    startProgressSimulation();

    try {
      let finalPhotoUrl = photoPreviewUrl || "";
      if (photoBlob) {
        finalPhotoUrl = await uploadPhotoDirectly(photoBlob);
      }

      if (client && session) {
        const rpcRes = await client.rpc(session, "generate_avatar", {
          photoUrl: finalPhotoUrl,
          style: selectedStyle,
        });

        const resPayload =
          typeof rpcRes.payload === "string"
            ? JSON.parse(rpcRes.payload)
            : rpcRes.payload;

        const { avatarUrl, cached } = resPayload as {
          avatarUrl: string;
          cached?: boolean;
        };

        stopProgressSimulation(true);
        setGeneratedAvatarUrl(avatarUrl);
        setIsCached(Boolean(cached));
        setStep("result");
      } else {
        // Mock fallback for UI development without live Nakama backend
        await new Promise((resolve) => setTimeout(resolve, 2000));
        stopProgressSimulation(true);
        setGeneratedAvatarUrl(finalPhotoUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136");
        setIsCached(false);
        setStep("result");
      }
    } catch (err: unknown) {
      stopProgressSimulation(false);
      setErrorMessage(formatAvatarError(err));
      setStep("style_select");
    }
  }

  const currentStage = getGenerationStage(progress);
  const activeStyleCard = STYLE_CARDS[selectedStyle];

  return (
    <main style={styles.page}>
      <section aria-labelledby="studio-main-title" style={styles.card}>
        <header style={styles.header}>
          <div style={styles.topBadgeRow}>
            <span style={styles.eyebrow}>PUNCH AVATAR STUDIO</span>
            <span style={styles.stepIndicator}>
              {step === "upload" && "PASO 1 DE 3"}
              {step === "style_select" && "PASO 2 DE 3"}
              {step === "generating" && "GENERANDO..."}
              {step === "result" && "¡LISTO!"}
            </span>
          </div>
          <h1 id="studio-main-title" style={styles.title}>
            {step === "upload" && "Tu foto de combate"}
            {step === "style_select" && "Elegí tu estilo de ring"}
            {step === "generating" && "Transformando tu avatar"}
            {step === "result" && "Tu Avatar de Boxeador"}
          </h1>
          <p style={styles.subtitle}>
            {step === "upload" &&
              "Subí tu foto para fijar tus facciones en el avatar de IA."}
            {step === "style_select" &&
              "Seleccioná la estética visual con la que vas a subir al cuadrilátero."}
            {step === "generating" &&
              "Nuestra IA está forjando tu versión caricaturesca con guantes y short."}
            {step === "result" &&
              "Tu identidad está lista para el ring. Guardala para tus combates."}
          </p>
        </header>

        {/* ERROR GLOBAL BANNER */}
        {errorMessage && (
          <div role="alert" style={styles.errorBanner}>
            <span style={styles.errorIcon}>⚠️</span>
            <span style={styles.errorText}>{errorMessage}</span>
          </div>
        )}

        {/* PASO 1: SUBIR Y RECORTAR FOTO */}
        {step === "upload" && (
          <div style={styles.stepContainer}>
            <PhotoUpload
              onPhotoReady={handlePhotoReady}
              onCancel={onBack}
              initialPreviewUrl={photoPreviewUrl ?? undefined}
            />
          </div>
        )}

        {/* PASO 2: SELECTOR DE ESTILO + CONSENTIMIENTO */}
        {step === "style_select" && (
          <form onSubmit={handleGenerate} style={styles.stepContainer}>
            {/* Foto preview compacta */}
            {photoPreviewUrl && (
              <div style={styles.photoMiniBar}>
                <img
                  src={photoPreviewUrl}
                  alt="Tu rostro encuadrado"
                  style={styles.photoMiniThumb}
                />
                <div style={styles.photoMiniInfo}>
                  <p style={styles.photoMiniLabel}>ROSTRO SELECCIONADO</p>
                  <p style={styles.photoMiniStatus}>✓ Encuadre 1:1 confirmado</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  style={styles.linkButton}
                >
                  Cambiar foto
                </button>
              </div>
            )}

            {/* Grid de Cards de Estilos */}
            <div
              role="radiogroup"
              aria-label="Estilos de avatar disponibles"
              style={styles.styleGrid}
            >
              {AVATAR_STYLES.map((styleKey) => {
                const item = STYLE_CARDS[styleKey];
                const isSelected = selectedStyle === styleKey;
                return (
                  <div
                    key={item.id}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setSelectedStyle(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setSelectedStyle(item.id);
                      }
                    }}
                    style={{
                      ...styles.styleCard,
                      borderColor: isSelected ? item.accentColor : "#4a3b30",
                      background: isSelected ? "#2d221b" : "#1e1611",
                      transform: isSelected ? "translateY(-2px)" : "none",
                      boxShadow: isSelected
                        ? `0 6px 0 ${item.accentColor}`
                        : "0 2px 0 #000",
                    }}
                  >
                    <div style={styles.styleCardHeader}>
                      <div
                        style={{
                          ...styles.styleIconWrap,
                          background: item.previewBg,
                          borderColor: item.accentColor,
                        }}
                      >
                        <span style={styles.styleIcon}>{item.icon}</span>
                      </div>
                      <div style={styles.styleCardHeaderTitles}>
                        <div style={styles.styleTitleRow}>
                          <h3 style={styles.styleCardName}>{item.name}</h3>
                          <span
                            style={{
                              ...styles.styleBadge,
                              borderColor: item.accentColor,
                              color: item.accentColor,
                            }}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p style={styles.styleCardTagline}>{item.tagline}</p>
                      </div>
                    </div>
                    <p style={styles.styleCardDesc}>{item.description}</p>

                    <div style={styles.styleSelectIndicator}>
                      <span
                        style={{
                          ...styles.radioCircle,
                          borderColor: isSelected ? item.accentColor : "#786555",
                          background: isSelected ? item.accentColor : "transparent",
                        }}
                      >
                        {isSelected && <span style={styles.radioDot} />}
                      </span>
                      <span style={styles.selectText}>
                        {isSelected ? "Estilo Seleccionado" : "Seleccionar estilo"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Checkbox de Consentimiento Obligatorio */}
            <div style={styles.consentBox}>
              <label style={styles.consentLabel}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  style={styles.checkbox}
                  required
                />
                <span style={styles.consentText}>
                  <strong>Consentimiento obligatorio:</strong> Confirmo que la foto
                  subida es mía (o tengo autorización explícita) y acepto generar un
                  avatar caricaturesco identity-preserving con inteligencia artificial.
                </span>
              </label>
            </div>

            {/* Botonera de Acción */}
            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={() => setStep("upload")}
                style={styles.secondaryButton}
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={!consentChecked}
                style={{
                  ...styles.primaryButton,
                  opacity: consentChecked ? 1 : 0.5,
                  cursor: consentChecked ? "pointer" : "not-allowed",
                }}
              >
                Generar con estilo {activeStyleCard.name}
              </button>
            </div>
          </form>
        )}

        {/* PASO 3: LOADER DE GENERACIÓN */}
        {step === "generating" && (
          <div
            style={styles.generatingContainer}
            aria-live="polite"
            aria-busy="true"
          >
            <div style={styles.gloveAnimationWrap}>
              <div style={styles.animatedGlove}>🥊</div>
              <div style={styles.sparkleRing} />
            </div>

            <h2 style={styles.generatingTitle}>{currentStage.label}</h2>
            <p style={styles.generatingTip}>{currentStage.tip}</p>

            {/* Barra de progreso visual */}
            <div style={styles.progressTrack} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div
                style={{
                  ...styles.progressBar,
                  width: `${progress}%`,
                  background: activeStyleCard.accentColor,
                }}
              />
            </div>

            <div style={styles.progressMeta}>
              <span style={styles.progressPercent}>{progress}%</span>
              <span style={styles.progressTimer}>
                ⏱️ Tiempo transcurrido: {elapsedSeconds}s (aprox. 5-12s)
              </span>
            </div>

            <div style={styles.activeStyleCallout}>
              <span style={styles.activeStyleIcon}>{activeStyleCard.icon}</span>
              <span style={styles.activeStyleText}>
                Forjando look en estilo <strong>{activeStyleCard.name}</strong>
              </span>
            </div>
          </div>
        )}

        {/* PASO 4: RESULTADO FINAL */}
        {step === "result" && generatedAvatarUrl && (
          <div style={styles.resultContainer}>
            <div style={styles.resultBadgeRow}>
              <span style={styles.readyBadge}>✓ AVATAR GENERADO CON ÉXITO</span>
              {isCached && (
                <span style={styles.cachedBadge}>⚡ RECUPERADO DE CACHÉ</span>
              )}
            </div>

            <div style={styles.avatarShowcaseFrame}>
              <div
                style={{
                  ...styles.avatarGlow,
                  background: activeStyleCard.accentColor,
                }}
              />
              <img
                src={generatedAvatarUrl}
                alt={`Tu avatar de boxeador en estilo ${activeStyleCard.name}`}
                style={styles.avatarImage}
              />
              <div style={styles.avatarCornerLabel}>
                {activeStyleCard.name.toUpperCase()}
              </div>
            </div>

            <div style={styles.resultDetails}>
              <h2 style={styles.fighterTitle}>¡LISTO PARA EL CUADRILÁTERO!</h2>
              <p style={styles.fighterBio}>
                Este avatar se guardó en tu perfil y será tu identidad visual
                en los combates de Carrera PvE y Versus.
              </p>
            </div>

            <div style={styles.resultActions}>
              <button
                type="button"
                onClick={() => {
                  if (onAvatarSaved) {
                    onAvatarSaved(generatedAvatarUrl, selectedStyle);
                  }
                }}
                style={styles.primaryButton}
              >
                🥊 ¡Subir al Ring! Continuar
              </button>
              <button
                type="button"
                onClick={() => setStep("style_select")}
                style={styles.secondaryButton}
              >
                Probar otro estilo
              </button>
              <button
                type="button"
                onClick={() => setStep("upload")}
                style={styles.neutralButton}
              >
                Cambiar foto
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  page: {
    alignItems: "center",
    background: "#17120f",
    color: "#fff8e7",
    display: "flex",
    fontFamily: "Georgia, serif",
    justifyContent: "center",
    minHeight: "100dvh",
    padding: "clamp(12px, 3vw, 28px)",
    boxSizing: "border-box",
  },
  card: {
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "10px 10px 0 #ad2e24",
    boxSizing: "border-box",
    maxWidth: "680px",
    padding: "clamp(20px, 4vw, 36px)",
    width: "100%",
  },
  header: {
    borderBottom: "2px solid #382c23",
    marginBottom: "20px",
    paddingBottom: "16px",
    textAlign: "center",
  },
  topBadgeRow: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  eyebrow: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.15em",
    margin: 0,
  },
  stepIndicator: {
    background: "#382c23",
    border: "1px solid #f2c14e",
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.78rem",
    letterSpacing: "0.08em",
    padding: "3px 8px",
  },
  title: {
    fontSize: "clamp(1.8rem, 6vw, 2.8rem)",
    lineHeight: 0.96,
    margin: "0 0 10px",
    textTransform: "uppercase",
  },
  subtitle: {
    color: "#d8cbbb",
    fontSize: "0.95rem",
    lineHeight: 1.45,
    margin: 0,
  },
  stepContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  errorBanner: {
    alignItems: "center",
    background: "#450a0a",
    border: "2px solid #ef4444",
    boxSizing: "border-box",
    color: "#fecaca",
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
    padding: "12px 16px",
  },
  errorIcon: {
    fontSize: "1.2rem",
  },
  errorText: {
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  photoMiniBar: {
    alignItems: "center",
    background: "#18110c",
    border: "1px solid #5a4638",
    display: "flex",
    gap: "12px",
    padding: "10px 14px",
  },
  photoMiniThumb: {
    aspectRatio: "1/1",
    border: "1px solid #f2c14e",
    height: "44px",
    objectFit: "cover",
    width: "44px",
  },
  photoMiniInfo: {
    flex: 1,
  },
  photoMiniLabel: {
    color: "#a89b8d",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    margin: "0 0 2px",
  },
  photoMiniStatus: {
    color: "#86efac",
    fontSize: "0.85rem",
    margin: 0,
  },
  linkButton: {
    background: "transparent",
    border: 0,
    color: "#f2c14e",
    cursor: "pointer",
    fontSize: "0.85rem",
    textDecoration: "underline",
  },
  styleGrid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  },
  styleCard: {
    border: "2px solid #4a3b30",
    boxSizing: "border-box",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
  },
  styleCardHeader: {
    alignItems: "flex-start",
    display: "flex",
    gap: "12px",
  },
  styleIconWrap: {
    alignItems: "center",
    border: "2px solid #f2c14e",
    borderRadius: "6px",
    display: "flex",
    height: "48px",
    justifyContent: "center",
    minWidth: "48px",
    width: "48px",
  },
  styleIcon: {
    fontSize: "1.6rem",
  },
  styleCardHeaderTitles: {
    flex: 1,
  },
  styleTitleRow: {
    alignItems: "center",
    display: "flex",
    gap: "8px",
    justifyContent: "space-between",
  },
  styleCardName: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.2rem",
    letterSpacing: "0.04em",
    margin: 0,
    textTransform: "uppercase",
  },
  styleBadge: {
    border: "1px solid",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.7rem",
    letterSpacing: "0.08em",
    padding: "2px 6px",
  },
  styleCardTagline: {
    color: "#f2c14e",
    fontSize: "0.82rem",
    fontStyle: "italic",
    margin: "2px 0 0",
  },
  styleCardDesc: {
    color: "#d8cbbb",
    fontSize: "0.85rem",
    lineHeight: 1.4,
    margin: 0,
  },
  styleSelectIndicator: {
    alignItems: "center",
    borderTop: "1px dashed #382c23",
    display: "flex",
    gap: "8px",
    marginTop: "4px",
    paddingTop: "10px",
  },
  radioCircle: {
    alignItems: "center",
    borderRadius: "50%",
    borderWidth: "2px",
    borderStyle: "solid",
    display: "inline-flex",
    height: "16px",
    justifyContent: "center",
    width: "16px",
  },
  radioDot: {
    background: "#17120f",
    borderRadius: "50%",
    height: "6px",
    width: "6px",
  },
  selectText: {
    fontSize: "0.82rem",
    fontWeight: 700,
  },
  consentBox: {
    background: "#1c140f",
    border: "2px solid #ad2e24",
    boxSizing: "border-box",
    padding: "14px 16px",
  },
  consentLabel: {
    alignItems: "flex-start",
    cursor: "pointer",
    display: "flex",
    gap: "12px",
    userSelect: "none",
  },
  checkbox: {
    accentColor: "#e23b2e",
    height: "20px",
    marginTop: "2px",
    minWidth: "20px",
    width: "20px",
  },
  consentText: {
    color: "#d8cbbb",
    fontSize: "0.86rem",
    lineHeight: 1.45,
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  primaryButton: {
    background: "#e23b2e",
    border: "2px solid #ad2e24",
    color: "#ffffff",
    cursor: "pointer",
    flex: "1 1 200px",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.15rem",
    letterSpacing: "0.08em",
    minHeight: "48px",
    padding: "12px 20px",
    textTransform: "uppercase",
    transition: "opacity 0.2s",
  },
  secondaryButton: {
    background: "#382c23",
    border: "2px solid #f2c14e",
    color: "#fff8e7",
    cursor: "pointer",
    flex: "0 1 140px",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.1rem",
    letterSpacing: "0.08em",
    minHeight: "48px",
    padding: "12px 18px",
    textTransform: "uppercase",
  },
  neutralButton: {
    background: "transparent",
    border: "2px solid #786555",
    color: "#d8cbbb",
    cursor: "pointer",
    flex: "0 1 140px",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.08em",
    minHeight: "48px",
    padding: "12px 18px",
    textTransform: "uppercase",
  },
  generatingContainer: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "24px 16px",
    textAlign: "center",
  },
  gloveAnimationWrap: {
    alignItems: "center",
    display: "flex",
    height: "90px",
    justifyContent: "center",
    position: "relative",
    width: "90px",
  },
  animatedGlove: {
    fontSize: "3.5rem",
    zIndex: 2,
  },
  sparkleRing: {
    animation: "spin 3s linear infinite",
    border: "3px dashed #f2c14e",
    borderRadius: "50%",
    height: "80px",
    position: "absolute",
    width: "80px",
    zIndex: 1,
  },
  generatingTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.45rem",
    letterSpacing: "0.06em",
    margin: 0,
    textTransform: "uppercase",
  },
  generatingTip: {
    color: "#d8cbbb",
    fontSize: "0.92rem",
    margin: 0,
    maxWidth: "420px",
  },
  progressTrack: {
    background: "#140e0a",
    border: "2px solid #5a4638",
    height: "20px",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    transition: "width 0.4s ease-out",
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
  },
  progressPercent: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.1rem",
  },
  progressTimer: {
    color: "#a89b8d",
    fontSize: "0.85rem",
  },
  activeStyleCallout: {
    alignItems: "center",
    background: "#1e1611",
    border: "1px solid #5a4638",
    display: "flex",
    gap: "10px",
    marginTop: "8px",
    padding: "8px 16px",
  },
  activeStyleIcon: {
    fontSize: "1.4rem",
  },
  activeStyleText: {
    color: "#fff8e7",
    fontSize: "0.88rem",
  },
  resultContainer: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    textAlign: "center",
  },
  resultBadgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "center",
  },
  readyBadge: {
    background: "#14532d",
    border: "2px solid #22c55e",
    color: "#86efac",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.92rem",
    letterSpacing: "0.08em",
    padding: "6px 14px",
  },
  cachedBadge: {
    background: "#1e3a8a",
    border: "2px solid #60a5fa",
    color: "#bfdbfe",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.08em",
    padding: "6px 12px",
  },
  avatarShowcaseFrame: {
    border: "4px solid #f2c14e",
    boxShadow: "8px 8px 0 #ad2e24",
    maxHeight: "300px",
    maxWidth: "300px",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  avatarGlow: {
    filter: "blur(20px)",
    height: "100%",
    opacity: 0.15,
    position: "absolute",
    width: "100%",
  },
  avatarImage: {
    aspectRatio: "1/1",
    display: "block",
    height: "100%",
    objectFit: "cover",
    position: "relative",
    width: "100%",
    zIndex: 2,
  },
  avatarCornerLabel: {
    background: "#17120f",
    borderBottomRightRadius: "4px",
    borderRight: "1px solid #f2c14e",
    borderBottom: "1px solid #f2c14e",
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.75rem",
    left: 0,
    letterSpacing: "0.1em",
    padding: "4px 8px",
    position: "absolute",
    top: 0,
    zIndex: 3,
  },
  resultDetails: {
    maxWidth: "480px",
  },
  fighterTitle: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.6rem",
    letterSpacing: "0.06em",
    margin: "0 0 6px",
    textTransform: "uppercase",
  },
  fighterBio: {
    color: "#d8cbbb",
    fontSize: "0.92rem",
    lineHeight: 1.45,
    margin: 0,
  },
  resultActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "center",
    width: "100%",
  },
};
