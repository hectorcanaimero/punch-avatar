# Spec 01 — Autenticación y Perfil

**Ref PRD:** §4 Cuenta, §5 Storage.

## Objetivo
Registro sin fricción con username elegido por el jugador, perfil persistente en Storage Engine de Nakama.

## Alcance
- Auth flow: `authenticateCustom` con `customId` = username validado (alfanumérico, 3-20 chars, único).
- RPC `register_profile`: crea entrada en colección `profiles` con defaults (level 1, xp 0, wins/losses/kos 0, rankScore 1000, careerProgress 0, unlocks vacío).
- RPC `get_profile`: devuelve perfil por `userId`.
- RPC `update_display_name`: cambia nombre visible (username es inmutable).
- Cliente: pantalla de registro (input username, validación en vivo, botón "empezar").
- Manejo de conflicto: username duplicado → error claro al cliente.

## Fuera de alcance
Recuperación de cuenta (roadmap post-MVP), OAuth, email/password.

## Criterios de aceptación
- Registro completo en < 3 segundos end-to-end.
- Username duplicado devuelve error `USERNAME_TAKEN` sin crear cuenta.
- Perfil se recupera intacto tras cerrar sesión y volver a entrar con mismo username.
- Session token de Nakama se persiste en cliente (localStorage o equivalente).

## Riesgos
- Sin recovery: si el jugador pierde el username, pierde la cuenta. Aceptable para MVP con disclaimer.
