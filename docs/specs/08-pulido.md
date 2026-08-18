# Spec 08 — Pulido (Cámara, Sonido, Animaciones, Balance)

**Ref PRD:** §2 elementos tontos, §7 roadmap paso 7.

## Objetivo
Elevar la sensación del juego de "funciona" a "se siente rico": impactos con peso, humor visible, balance final.

## Alcance
- **Cámara**:
  - Screen shake al recibir golpe (intensidad proporcional al daño).
  - Zoom + shake fuerte al especial.
  - Freeze frame 100ms en K.O.
- **Sonido**:
  - SFX por acción: pow, whoosh, block, special, ko.
  - Música lobby + música combate (loops).
  - Locutor cómico dice frases al conectar especial ("¡SE ARMÓ!").
- **Animaciones**:
  - Guantes propios se levantan/bajan al presionar.
  - Rival: idle bob, telegraph glow, hurt reaction, KO (caída con ojos en espiral).
  - Golpe fallido cómico: tropieza con su propio puño.
- **Texto cómic**:
  - Overlay tipo POW/BONK/ZAS con font grande, aparece 300ms al conectar.
  - Aleatorio del pool desbloqueado (spec 06).
- **Flash de pantalla**: en especial y en K.O.
- **Balance**:
  - Sesión de playtesting con 3-5 jugadores.
  - Ajustar ventanas de telegraph rival por rival.
  - Ajustar carga del especial si se usa muy seguido / muy poco.
- **Accesibilidad mínima**: subtítulos para audio, opción de reducir shake.

## Fuera de alcance
Sistema de partículas complejo, motion capture, doblaje de calidad estudio.

## Criterios de aceptación
- Un jugador nuevo entiende qué pasó en el combate solo mirando (sin explicación).
- Ningún efecto oculta información crítica (bloqueo/hp/telegraph siempre legible).
- Opción "reduce motion" respetada.

## Riesgos
- Shake excesivo → náuseas. Cap absoluto en intensidad + toggle.
