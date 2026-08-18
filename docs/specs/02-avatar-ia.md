# Spec 02 — Generación de Avatar con IA

**Ref PRD:** §3 Generación de avatar.

## Objetivo
Convertir la foto del jugador en un avatar caricaturesco identity-preserving, generado una sola vez por estilo, guardado en el perfil.

## Alcance
- Endpoint de subida (multipart o presigned URL a bucket externo tipo Cloudinary/S3).
- Preprocesamiento: detección de rostro (client-side con `face-api.js` o server-side con provider), recorte 1:1 centrado.
- RPC `generate_avatar` (server-side):
  - Input: `{ photoUrl, style }` donde style ∈ `pixar_3d | anime_shonen | comic_retro | chibi | pixel_16bit`.
  - Llama Replicate (InstantID / photomaker-style / instant-id-artistic).
  - Aplica plantilla de prompt positivo + negativo del PRD §3.
  - Params: identity weight 0.7-0.85, style weight moderado.
  - Guarda `avatarUrl` + `avatarStyle` en perfil.
- Rechazo de foto sin rostro detectado.
- Consentimiento explícito antes de subir (checkbox obligatorio).
- API key de Replicate solo en env de Nakama, nunca expuesta al cliente.

## Fuera de alcance
Regeneración por partida, edición manual del avatar, múltiples avatares por perfil.

## Criterios de aceptación
- Foto sin rostro → error `NO_FACE_DETECTED`, sin cargo a la API.
- Avatar generado se sirve desde URL persistente (CDN o Nakama file server).
- Cambiar estilo re-genera y sobrescribe `avatarUrl`.
- Un flujo completo (upload → generación → guardado) < 15 segundos.

## Riesgos
- Costo Replicate (~USD 0.01-0.03 por generación) — mitigado por caché y regeneración explícita.
- Latencia variable — mostrar loader con progreso.
- Vigencia del modelo InstantID — revalidar al implementar.
