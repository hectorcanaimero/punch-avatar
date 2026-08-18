# Punch Avatar — Documento de Diseño y Arquitectura

Juego "tonto" multijugador de boxeo estilo Punch-Out!!, donde cada jugador pelea con un avatar generado por IA a partir de su propia foto. Progresión persistente con cuenta básica (usuario + nombre), como en el modo carrera de Punch-Out.

Backend: **Nakama**. Programación: **opencode**. Este documento es la referencia de diseño y arquitectura para esa implementación — no contiene código.

---

## 0. Mi opinión sobre la decisión

Nakama es la elección correcta ahora que el requisito cambió a progresión persistente (usuario, nivel, historial de peleas). Un dato importante: **Nakama no es solo el backend de cuentas — también resuelve el multiplayer en tiempo real** vía sus "authoritative match handlers". Es decir, no necesitas Nakama para cuentas + otra librería (como Colyseus) para las peleas: todo vive en un solo backend, un solo despliegue (Docker + Postgres), una sola fuente de verdad para vida/golpes/bloqueo y para XP/rango al terminar el match.

Recomiendo escribir la lógica de servidor (match handler + RPCs) en el **runtime de TypeScript** de Nakama en vez de Lua o Go — mismo lenguaje que el cliente, y es el que mejor va a generar una herramienta como opencode sin cambiar de stack mental.

El único costo real de esta decisión es infraestructura: Nakama corre su propio servidor (contenedor Nakama + Postgres/CockroachDB), a diferencia de una librería embebible. Para un proyecto que sí quiere cuentas y progresión de verdad, ese costo está justificado.

---

## 1. Modos de juego

- **Carrera (PvE)**: el jugador sube una escalera de rivales controlados por IA con patrones de ataque telegrafiados, al estilo Punch-Out original. Aquí es donde vive la progresión.
- **Versus (PvP online)**: dos jugadores se enfrentan en tiempo real uniéndose con un código de sala corto. Más caótico, sin patrones fijos — golpe contra golpe.

Ambos modos comparten el mismo sistema de combate y alimentan la misma progresión de cuenta (XP, nivel, desbloqueos).

---

## 2. Mecánica de combate

### Vista y controles

Vista en primera persona frente al rival (el rival ocupa el centro de la pantalla, los guantes propios se ven abajo en las esquinas, como en Punch-Out).

Controles mínimos, pensados para aprenderse en 5 segundos:

| Acción | Tecla / botón | Efecto |
|---|---|---|
| Golpe izquierdo | `A` / botón izq. | 8 HP de daño si conecta |
| Golpe derecho | `D` / botón der. | 8 HP de daño si conecta |
| Bloqueo | mantener `S` / botón centro | Anula daño mientras se sostiene; no puedes golpear mientras bloqueas |
| Especial ("Golpe de la Suerte") | `Espacio` (solo con medidor lleno) | 30 HP de daño, **ignora bloqueo**, sacudida de cámara, texto cómic gigante |

- **Medidor de carga**: sube 10% por cada golpe conectado (propio o recibido, para que ambos jugadores tengan chance de especial). Se resetea al usar el especial.
- **Vida**: 100 HP por jugador. HP a 0 = K.O., termina el combate.
- **Round**: en Versus, un solo asalto directo a K.O. (partidas de ~1-2 min). En Carrera, cada rival puede tener 2-3 caídas antes del K.O. final, como en Punch-Out.

### Elementos "tontos" / caóticos

- Reacciones físicas exageradas: el avatar se tambalea, ojos en espiral al recibir golpe fuerte.
- Frase cómic aleatoria al conectar: "¡POW!", "¡BONK!", "¡ZAS!", "¡CATAPLUM!".
- ~5% de probabilidad de "golpe fallido cómico": el jugador se tropieza con su propio puño, animación graciosa, breve ventana de vulnerabilidad. Solo cosmético/riesgo menor, no rompe el balance.
- Sacudida de cámara y flash de pantalla en el especial.

### Modo Carrera: patrones telegrafiados

A diferencia del Versus (reactivo, jugador contra jugador), los rivales de IA en Carrera necesitan telegrafiar su ataque para que el jugador pueda leerlo y bloquear a tiempo — es el corazón del Punch-Out original:

1. El rival ilumina el guante que va a usar (glow visual + sonido de aviso).
2. Ventana de espera (400-800 ms, se acorta conforme sube la dificultad del rival).
3. El golpe llega; el jugador debe bloquear del lado correcto dentro de esa ventana.

El roster sugerido: 8-10 rivales con nombres tontos y patrones cada vez más rápidos/mezclados (ej. "Tito Cucharón", "El Bigotes", "Doña Fierro", "Máquina de Tamales"), terminando en un "campeón" con patrones combinados.

### Dificultad progresiva

La dificultad **no** es adaptativa (no depende de qué tan bien juegue el usuario) — sube de forma fija con cada rival de la escalera de Carrera, igual que en Punch-Out original. Es más fácil de balancear, de testear y de explicarle al jugador ("vas ganando, el siguiente es más difícil") que un sistema adaptativo. El progreso ya se guarda en `careerProgress` dentro del perfil (ver sección 5), así que el rival correcto se carga solo al volver a jugar.

Parámetros que escalan del rival 1 al rival 10 (valores de referencia, a ajustar con playtesting):

| Rival # | Ventana de telegraph | Probabilidad de feint* | Probabilidad de combo** | HP rival | Daño por golpe |
|---|---|---|---|---|---|
| 1-2 (fácil) | 800-700 ms | 0% | 0% | 80 | 5 |
| 3-5 (medio) | 650-500 ms | 10% | 15% | 100 | 7 |
| 6-8 (difícil) | 450-350 ms | 20% | 30% | 120 | 9 |
| 9-10 (campeón) | 300 ms | 25% | 40% + especial propio | 150 | 12 |

\* **Feint**: el rival ilumina el guante como si fuera a golpear, pero no llega el golpe — castiga a quien bloquea por reflejo. Obliga a leer el patrón real en vez de solo reaccionar al aviso.

\** **Combo**: dos golpes seguidos de lados distintos, con una ventana corta entre ambos — el jugador tiene que bloquear dos veces seguidas del lado correcto.

A partir del rival 6, el rival también puede usar su propio "golpe especial" (equivalente al del jugador): telegraph más largo y muy visible, pero si conecta ignora el bloqueo — el jugador debe usar su propio especial o retroceder (si se agrega esquiva) para evitarlo.

Con esto, la sensación de "se va poniendo más difícil conforme avanzo" viene de leer patrones más rápidos y más engañosos, no de que el rival tenga más vida o pegue absurdamente duro — se mantiene justo y legible, como el Punch-Out original.

---

## 3. Generación de avatar con IA

### Pipeline

1. El usuario sube una foto (selfie, recomendable buena luz frontal).
2. Preprocesamiento: detección y recorte de rostro (cliente o servidor) para asegurar que la cara quede centrada antes de mandarla al modelo.
3. Generación: modelo **identity-preserving image-to-image** — mantiene el parecido facial real mientras aplica un estilo de caricatura/boxeador. Esto es clave para que la gracia del juego funcione (que se reconozca a la persona/amigo en el ring).
4. El resultado se genera **una sola vez** (al crear cuenta o al cambiar de estilo) y se guarda en el perfil — no se regenera en cada partida, por costo y latencia.

### Modelo recomendado

Con investigación actualizada (agosto 2026): **InstantID** es la opción con mejor balance de fidelidad facial + editabilidad de estilo entre las disponibles vía API (Replicate). Variantes específicas para estilo caricaturesco: `tencentarc/photomaker-style` y `grandlineai/instant-id-artistic`, ambas mantienen identidad facial mientras aplican un estilo pintado/ilustrado.

Gemini (Google) tiene una función de avatar propia, pero según reportes recientes no "fija" tan bien la identidad ante cambios de luz/prompt — más pensado para clones realistas que para estilización consistente. Para este proyecto, InstantID (o sus variantes de estilo) es la apuesta más sólida.

Nota: esto cambia rápido — vale la pena revalidar el modelo elegido al momento de implementar, no solo confiar en este documento.

### Plantilla de prompt

Prompt positivo (junto con la foto de referencia como input del modelo):

```
a cartoon boxer character, {ESTILO} style, wearing brightly colored boxing
gloves and boxing shorts, exaggerated muscular cartoon body, standing in a
fighting stance, boxing ring background, vibrant colors, comic book
illustration, funny exaggerated expression, same facial identity as
reference photo, high detail face, digital illustration
```

Prompt negativo:

```
realistic photo, blurry, extra limbs, deformed hands, extra fingers, text,
watermark, low quality, distorted face
```

`{ESTILO}` como selector para el usuario (variedad de "elige tu look de luchador"):
- `Pixar 3D`
- `anime shonen`
- `comic americano retro`
- `chibi / super deformado`
- `pixel art 16-bit`

Parámetros sugeridos: peso de identidad (IP-Adapter/InstantID) alto (0.7-0.85) para que la cara siga siendo reconocible; peso de estilo moderado para no perder el parecido.

### Moderación y privacidad

- Rechazar la foto si no se detecta un rostro humano claro.
- Disclaimer/consentimiento explícito: el usuario debe subir su propia foto o tener permiso de la persona fotografiada.
- Apoyarse en los filtros de seguridad que ya trae el proveedor de imagen (la mayoría de APIs de este tipo incluyen moderación de contenido).
- La llamada a la API de imagen debe hacerse **server-side** (RPC de Nakama), nunca desde el cliente, para no exponer la API key.

---

## 4. Gamificación y progresión

### Cuenta

Cuenta ligera para bajar fricción (nada de email/password obligatorio):
- `authenticateCustom` de Nakama con un **username elegido por el jugador**, o `authenticateDevice` + reclamar nombre después.
- Perfil: nombre, avatar generado, estilo elegido, nivel, XP, récord (victorias/derrotas/KOs), progreso de carrera.

### Progresión

- **XP**: +50 por victoria, +10 por participación en derrota, +20 bonus por K.O. limpio, +100 bonus la primera vez que se vence a un rival nuevo de la Carrera.
- **Niveles**: desbloquean cosas cosméticas — nuevos guantes/skins, nuevos estilos de avatar, nuevas frases cómicas al golpear. Deliberadamente **no** afectan el balance de combate (nada de pay-to-win ni grind-to-win; el juego se mantiene "tonto" y parejo).
- **Rango PvP**: sistema simple de tiers (Bronce / Plata / Oro / Leyenda Tonta) sobre un leaderboard de Nakama.
- **Logros**: modelados como objetos en Nakama Storage (Nakama no trae achievements nativos). Ejemplos: "Primera Sangre" (primer K.O.), "Cara de Piedra" (ganar sin recibir un golpe), "Remontada" (ganar con menos de 10 HP).

### Leaderboards

Usar la API de Leaderboards de Nakama, con al menos dos tablas globales: "más K.O.s" y "racha de victorias actual".

---

## 5. Arquitectura técnica (Nakama)

- **Servidor**: Nakama OSS self-hosted vía Docker Compose (contenedor Nakama + Postgres/CockroachDB).
- **Runtime del servidor**: TypeScript (motor Goja de Nakama) para el match handler y los RPCs custom — mismo lenguaje que el cliente, más fácil de generar y mantener con opencode que Lua o Go.
- **Auth**: `authenticateCustom` con username propio del jugador (evita pedir email/password).
- **Storage**: colección `profiles` en el Storage Engine de Nakama:
  `{ displayName, avatarUrl, avatarStyle, level, xp, wins, losses, kos, careerProgress, unlocks[] }`.
- **RPC `generate_avatar`**: recibe la foto (o su URL si ya se subió a un storage externo tipo S3/Cloudinary), llama server-side al modelo de imagen (InstantID/variantes vía Replicate), guarda el resultado en el perfil.
- **Matchmaking**:
  - *Versus*: dos flujos — amistoso por código (`nk.matchCreate` + `matchJoin`) y ranked por matchmaker automático (`matchmakerAdd`). Detalle completo en la sección 6.
  - *Carrera*: no necesita multiplayer real — puede resolverse con RPCs, o (para reusar la misma lógica de combate) con un match de "1 jugador + bot" manejado por el mismo match handler.
- **Match handler (autoritativo)**: implementa las funciones estándar de Nakama (`matchInit`, `matchJoin`, `matchJoinAttempt`, `matchLeave`, `matchLoop`, `matchTerminate`, `matchSignal`). Aquí vive el estado de la pelea (vida, bloqueo, carga) y se valida cada golpe en el servidor (anti-trampas).
- **Al terminar un match**: `matchTerminate` (o un RPC posterior) actualiza Storage (stats del perfil) y los leaderboards.

### Modelo de datos (resumen)

**Profile** (Storage): `userId, displayName, avatarUrl, avatarStyle, level, xp, wins, losses, kos, careerProgress (índice del rival actual), unlocks[]`

**Match state** (en memoria, dentro del match handler): `players { sessionId: { userId, avatarUrl, health, blocking, charge } }, status, winner`

---

## 6. Modo Versus: matchmaking y sistema de rango

Dos formas de jugar Versus, con propósitos distintos:

### Amistoso (código de sala)

Ya definido en la arquitectura (sección 5): un jugador crea sala, comparte un código corto, el otro se une. **No afecta el rango ni los leaderboards** — es el modo para jugar con amigos sin presión, y también sirve para probar el juego sin necesidad de encontrar rival.

### Ranked (matchmaker automático)

Usa el `Matchmaker` nativo de Nakama (`matchmakerAdd`) para emparejar jugadores de nivel similar sin que se conozcan entre sí:

- Cada perfil tiene un `rankScore` (empieza en 1000).
- Al buscar partida, el cliente llama `matchmakerAdd` con `rankScore` como propiedad numérica y una query que busca oponentes dentro de `rankScore ± 150`.
- Si no aparece rival en ~10s, la búsqueda se amplía automáticamente (`± 250`, luego `± 400`) para no dejar a nadie esperando eternamente.
- Si no hay rival tras ~30s, se ofrece la alternativa de pelear contra un bot (reutilizando la lógica de rivales de Carrera) o volver a intentar más tarde.

**Cálculo de rango tras cada partida** (estilo Elo simplificado, calculado en el servidor dentro de `matchTerminate` — nunca confiado del cliente):

```
esperado_A = 1 / (1 + 10 ^ ((rankScore_B - rankScore_A) / 400))
nuevo_rankScore_A = rankScore_A + K * (resultado_A - esperado_A)
```

- `resultado_A` = 1 si ganó, 0 si perdió.
- `K = 24` (ganancia/pérdida moderada — como el resto del juego, no queremos que se sienta punitivo).
- Un K.O. limpio (sin recibir daño) suma +5 puntos extra de rango, para premiar dominar la pelea y no solo ganarla por poco.

**Tiers** (mismos nombres que en la sección 4, con rangos de puntos):

| Tier | Rango de puntos |
|---|---|
| Bronce | 0 – 999 |
| Plata | 1000 – 1399 |
| Oro | 1400 – 1799 |
| Leyenda Tonta | 1800+ |

**Abandonos**: si un jugador se desconecta después de que el match ya empezó (no en la fase de espera), `matchLeave`/`matchTerminate` lo registra como derrota automática — evita que salir a medio combate sea una forma de evitar perder rango.

**Anti-trampas**: como el match handler es autoritativo (valida cada golpe server-side, ver sección 5), no hay forma de manipular el resultado desde el cliente para inflar el rango.

Opcional para más adelante (no MVP): decaimiento suave de rango tras semanas de inactividad, para que la tabla no se llene de cuentas viejas estancadas arriba.

---

## 7. Roadmap sugerido para opencode

1. Levantar Nakama local (docker-compose) + auth básica + pantalla de registro con nombre.
2. RPC de generación de avatar (subida de foto + llamada al modelo de imagen + guardado en perfil).
3. Match handler del modo Versus amistoso (código de sala, golpe/bloqueo/especial, K.O.).
4. Modo Carrera: roster de rivales IA con patrones telegrafiados y dificultad progresiva.
5. Gamificación: XP, niveles, desbloqueos cosméticos, leaderboards, logros.
6. Versus ranked: matchmaker automático + cálculo de rango.
7. Pulido: animaciones, sonido, cámara, textos cómic, balance de dificultad.

---

## 8. Riesgos y consideraciones abiertas

- **Costo/latencia de generación de imagen**: mitigado generando una sola vez por estilo y cacheando en el perfil.
- **Privacidad**: fotos de terceros — requiere disclaimer/consentimiento explícito en el flujo de subida.
- **Infraestructura**: Nakama exige más setup que una librería embebible (Docker + base de datos), a cambio de cuentas y progresión reales.
- **Balance del modo Carrera**: los tiempos de telegraph/ventana de bloqueo van a necesitar playtesting iterativo para que se sienta justo y no frustrante.
- **Vigencia del modelo de IA elegido**: el panorama de modelos identity-preserving cambia rápido; revalidar InstantID/alternativas al momento de implementar.

---

### Fuentes consultadas

- [Best AI Image Editing Models With Reference Images (2026)](https://magichour.ai/blog/best-ai-image-editing-models-with-reference-images)
- [Run AI face generation models via API — Replicate](https://replicate.com/collections/ai-face-generator)
- [InstantID](https://instantid.github.io/)
- [InstantID — GitHub](https://github.com/instantX-research/InstantID)
- [zsxkib/instant-id — Replicate](https://replicate.com/zsxkib/instant-id)
- [How to Make Gemini Not Change Your Face](https://www.media.io/ai-image-generator/fix-gemini-face-change.html)
- [Nakama — Authoritative Multiplayer](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/)
- [Nakama — Match Handler API (TypeScript runtime)](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/function-reference/match-handler/)
- [Nakama — Code Samples (TypeScript runtime)](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/code-samples/)
- [Nakama — GitHub](https://github.com/heroiclabs/nakama)
