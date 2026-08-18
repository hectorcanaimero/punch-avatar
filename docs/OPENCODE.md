# OpenCode Models — Zen & Go

> Fuente: [docs Zen](https://opencode.ai/docs/zen/) · [docs Go](https://opencode.ai/docs/go/) · API: `https://opencode.ai/zen/v1/models`  
> Actualizado: 2026-08-18

---

## Resumen

| | **Zen** | **Go** |
|--|---------|--------|
| Cobro | Pay-as-you-go | Sub: $5 primer mes → $10/mes |
| Prefijo config | `opencode/<model-id>` | `opencode-go/<model-id>` |
| Enfoque | Curated full stack (Claude, GPT, Gemini, open, free) | Open models baratos + acceso global estable |
| Límites | Créditos + auto-reload | $12 / 5h · $30 / semana · $60 / mes |

En el TUI: `/models` · Connect: `/connect`

---

## OpenCode Zen

### OpenAI / GPT

| Modelo | Model ID |
|--------|----------|
| GPT 5.6 Sol | `gpt-5.6-sol` |
| GPT 5.6 Terra | `gpt-5.6-terra` |
| GPT 5.6 Luna | `gpt-5.6-luna` |
| GPT 5.5 | `gpt-5.5` |
| GPT 5.5 Pro | `gpt-5.5-pro` |
| GPT 5.4 | `gpt-5.4` |
| GPT 5.4 Pro | `gpt-5.4-pro` |
| GPT 5.4 Mini | `gpt-5.4-mini` |
| GPT 5.4 Nano | `gpt-5.4-nano` |
| GPT 5.3 Codex | `gpt-5.3-codex` |
| GPT 5.3 Codex Spark | `gpt-5.3-codex-spark` |
| GPT 5.2 | `gpt-5.2` |
| GPT 5.2 Codex | `gpt-5.2-codex` |
| GPT 5.1 | `gpt-5.1` |
| GPT 5.1 Codex | `gpt-5.1-codex` |
| GPT 5.1 Codex Max | `gpt-5.1-codex-max` |
| GPT 5.1 Codex Mini | `gpt-5.1-codex-mini` |
| GPT 5 | `gpt-5` |
| GPT 5 Codex | `gpt-5-codex` |
| GPT 5 Nano | `gpt-5-nano` |

**Ejemplo config:** `opencode/gpt-5.5`

### Anthropic / Claude

| Modelo | Model ID |
|--------|----------|
| Claude Fable 5 | `claude-fable-5` |
| Claude Opus 5 | `claude-opus-5` |
| Claude Opus 4.8 | `claude-opus-4-8` |
| Claude Opus 4.7 | `claude-opus-4-7` |
| Claude Opus 4.6 | `claude-opus-4-6` |
| Claude Opus 4.5 | `claude-opus-4-5` |
| Claude Sonnet 5 | `claude-sonnet-5` |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Claude Sonnet 4.5 | `claude-sonnet-4-5` |
| Claude Haiku 4.5 | `claude-haiku-4-5` |

### Google / Gemini

| Modelo | Model ID |
|--------|----------|
| Gemini 3.7 Flash | `gemini-3.7-flash` |
| Gemini 3.6 Flash | `gemini-3.6-flash` |
| Gemini 3.5 Flash | `gemini-3.5-flash` |
| Gemini 3.5 Flash Lite | `gemini-3.5-flash-lite` |
| Gemini 3.1 Pro | `gemini-3.1-pro` |
| Gemini 3 Flash | `gemini-3-flash` |

### xAI / Grok + Muse

| Modelo | Model ID |
|--------|----------|
| Grok 4.6 | `grok-4.6` |
| Grok 4.5 | `grok-4.5` |
| Grok Build 0.1 | `grok-build-0.1` |
| Muse Spark 1.2 | `muse-spark-1.2` |

### Qwen / DeepSeek / MiniMax / GLM / Kimi

| Modelo | Model ID |
|--------|----------|
| Qwen3.7 Max | `qwen3.7-max` |
| Qwen3.7 Plus | `qwen3.7-plus` |
| Qwen3.6 Plus | `qwen3.6-plus` |
| Qwen3.5 Plus | `qwen3.5-plus` |
| DeepSeek V4 Pro | `deepseek-v4-pro` |
| DeepSeek V4 Flash | `deepseek-v4-flash` |
| MiniMax M3 | `minimax-m3` |
| MiniMax M2.7 | `minimax-m2.7` |
| MiniMax M2.5 | `minimax-m2.5` |
| GLM 5.2 | `glm-5.2` |
| GLM 5.1 | `glm-5.1` |
| GLM 5 | `glm-5` |
| Kimi K3 | `kimi-k3` |
| Kimi K2.7 Code | `kimi-k2.7-code` |
| Kimi K2.6 | `kimi-k2.6` |
| Kimi K2.5 | `kimi-k2.5` |

### Free (limitados / trial)

| Modelo | Model ID |
|--------|----------|
| Big Pickle | `big-pickle` |
| MiMo-V2.5 Free | `mimo-v2.5-free` |
| Hy3 Free | `hy3-free` |
| Laguna S 2.1 Free | `laguna-s-2.1-free` |
| Nemotron 3 Ultra Free | `nemotron-3-ultra-free` |
| Nemotron 3.5 Lightning Free | `nemotron-3.5-lightning-free` |
| DeepSeek V4 Flash Free | `deepseek-v4-flash-free` |

> Los free pueden usar datos para mejorar el modelo durante el trial. Revisá privacy en la docs.

---

## OpenCode Go

**Ejemplo config:** `opencode-go/kimi-k3`

| Modelo | Model ID |
|--------|----------|
| Grok 4.5 | `grok-4.5` |
| GPT 5.6 Luna | `gpt-5.6-luna` |
| GLM-5.3 | `glm-5.3` |
| GLM-5.2 | `glm-5.2` |
| GLM-5.1 | `glm-5.1` |
| Kimi K3 | `kimi-k3` |
| Kimi K2.7 Code | `kimi-k2.7-code` |
| Kimi K2.6 | `kimi-k2.6` |
| MiMo-V2.5 | `mimo-v2.5` |
| MiMo-V2.5-Pro | `mimo-v2.5-pro` |
| MiniMax M3 | `minimax-m3` |
| MiniMax M2.7 | `minimax-m2.7` |
| MiniMax M2.5 | `minimax-m2.5` |
| Qwen3.8 Max | `qwen3.8-max` |
| Qwen3.7 Max | `qwen3.7-max` |
| Qwen3.7 Plus | `qwen3.7-plus` |
| Qwen3.6 Plus | `qwen3.6-plus` |
| DeepSeek V4 Pro | `deepseek-v4-pro` |
| DeepSeek V4 Flash | `deepseek-v4-flash` |
| Hy3 | `hy3` |

### Límites de uso (Go)

| Ventana | Límite |
|---------|--------|
| 5 horas | $12 |
| Semanal | $30 |
| Mensual | $60 |

Si tenés balance Zen, podés habilitar **Use balance** para seguir después del tope.

---

## Config rápida

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/gpt-5.5"
}
```

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode-go/grok-4.5"
}
```

---

## Links

- Auth / billing: https://opencode.ai/auth  
- Zen docs: https://opencode.ai/docs/zen/  
- Go docs: https://opencode.ai/docs/go/  
- Models config: https://opencode.ai/docs/models/  
- Zen models API: https://opencode.ai/zen/v1/models  
- Go models API: https://opencode.ai/zen/go/v1/models  
