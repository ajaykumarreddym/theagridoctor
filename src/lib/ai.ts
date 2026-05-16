// // Unified AI text/vision helpers with automatic fallback:
// //   Primary:   OpenRouter (nvidia/nemotron-3-super-120b-a12b:free → llama-3.3-70b:free)
// //   Fallback:  Google Gemini (gemini-2.0-flash / gemini-1.5-flash)
// //
// // All helpers are non-streaming JSON-style. Advisor streaming lives in /api/chat.

// type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

// const OPENROUTER_TEXT_MODELS = [
//   'nvidia/nemotron-3-super-120b-a12b:free',
//   'meta-llama/llama-3.3-70b-instruct:free',
// ]

// const OPENROUTER_VISION_MODELS = [
//   'google/gemma-3-27b-it:free',
//   'qwen/qwen2.5-vl-72b-instruct:free',
//   'meta-llama/llama-3.2-11b-vision-instruct:free',
// ]

// const GEMINI_MODEL = 'gemini-2.5-flash'
// // ─── OpenRouter (chat completions) ────────────────────────────────────────────
// async function callOpenRouterText(messages: Msg[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
//   const apiKey = process.env.OPENROUTER_API_KEY
//   if (!apiKey) throw new Error('OPENROUTER_API_KEY missing')

//   let lastErr: Error | null = null
//   for (const model of OPENROUTER_TEXT_MODELS) {
//     try {
//       const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${apiKey}`,
//           'Content-Type': 'application/json',
//           'HTTP-Referer': 'https://theagridoctor.app',
//           'X-Title': 'TheAgriDoctor',
//         },
//         body: JSON.stringify({
//           model,
//           messages,
//           max_tokens: opts.maxTokens ?? 800,
//           temperature: opts.temperature ?? 0.4,
//         }),
//       })
//       if (!res.ok) {
//         lastErr = new Error(`OpenRouter ${model} → ${res.status}`)
//         if (res.status === 429 || res.status >= 500) continue
//         throw lastErr
//       }
//       const json = await res.json()
//       const content = json?.choices?.[0]?.message?.content?.trim()
//       if (content) return content
//       lastErr = new Error(`OpenRouter ${model} → empty`)
//     } catch (e) {
//       lastErr = e instanceof Error ? e : new Error(String(e))
//     }
//   }
//   throw lastErr ?? new Error('OpenRouter all models failed')
// }

// // ─── Google Gemini (text + vision unified) ────────────────────────────────────
// type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

// async function callGemini(parts: GeminiPart[], systemPrompt?: string, opts: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
//   const apiKey = process.env.GEMINI_API_KEY
//   if (!apiKey) throw new Error('GEMINI_API_KEY missing')

//   const body: Record<string, unknown> = {
//     contents: [{ role: 'user', parts }],
//     generationConfig: {
//       maxOutputTokens: opts.maxTokens ?? 1500,
//       temperature: opts.temperature ?? 0.3,
//     },
//   }
//   if (systemPrompt) {
//     body.systemInstruction = { parts: [{ text: systemPrompt }] }
//   }

//   const res = await fetch(
//     `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
//     {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(body),
//     }
//   )
//   if (!res.ok) {
//     const err = await res.text()
//     throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`)
//   }
//   const json = await res.json()
//   const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
//   if (!text.trim()) throw new Error('Gemini returned empty content')
//   return text.trim()
// }

// // ─── Public API ───────────────────────────────────────────────────────────────

// /** Text completion: tries OpenRouter (nemotron → llama) then Gemini. */
// export async function aiText(messages: Msg[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
//   try {
//     return await callOpenRouterText(messages, opts)
//   } catch (err) {
//     console.warn('[ai] OpenRouter text failed, falling back to Gemini:', err instanceof Error ? err.message : err)
//     const sys = messages.find((m) => m.role === 'system')?.content
//     const userText = messages
//       .filter((m) => m.role !== 'system')
//       .map((m) => (m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`))
//       .join('\n\n')
//     return callGemini([{ text: userText }], sys, opts)
//   }
// }

// /**
//  * Vision completion for diagnose. Accepts base64 data URLs (data:image/...;base64,...).
//  * Tries OpenRouter vision models first, then Gemini 2.0 Flash.
//  */
// export async function aiVision(
//   imageBase64DataUrls: string[],
//   userText: string,
//   systemPrompt: string,
//   opts: { maxTokens?: number; temperature?: number } = {}
// ): Promise<string> {
//   const apiKey = process.env.OPENROUTER_API_KEY

//   // Try each OpenRouter vision model in sequence
//   if (apiKey) {
//     for (const model of OPENROUTER_VISION_MODELS) {
//       try {
//         const imageContent = imageBase64DataUrls.map((b64) => ({
//           type: 'image_url' as const,
//           image_url: { url: b64 },
//         }))
//         const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
//           method: 'POST',
//           headers: {
//             Authorization: `Bearer ${apiKey}`,
//             'Content-Type': 'application/json',
//             'HTTP-Referer': 'https://theagridoctor.app',
//             'X-Title': 'TheAgriDoctor',
//           },
//           body: JSON.stringify({
//             model,
//             messages: [
//               { role: 'system', content: systemPrompt },
//               { role: 'user', content: [...imageContent, { type: 'text', text: userText }] },
//             ],
//             max_tokens: opts.maxTokens ?? 1500,
//             temperature: opts.temperature ?? 0.1,
//           }),
//         })
//         if (!res.ok) continue
//         const json = await res.json()
//         const content = json?.choices?.[0]?.message?.content?.trim()
//         if (content) return content
//       } catch {
//         // try next
//       }
//     }
//   }

//   // Fallback: Gemini vision
//   const geminiParts: GeminiPart[] = imageBase64DataUrls.map((url) => {
//     const match = url.match(/^data:([^;]+);base64,(.+)$/)
//     if (!match) throw new Error('aiVision: invalid base64 data URL')
//     return { inline_data: { mime_type: match[1], data: match[2] } }
//   })
//   geminiParts.push({ text: userText })
//   return callGemini(geminiParts, systemPrompt, opts)
// }


// Unified AI text/vision helpers with automatic fallback:
//   Primary:   OpenRouter (nvidia/nemotron-3-super-120b-a12b:free → llama-3.3-70b:free)
//   Fallback:  Google Gemini (gemini-2.5-flash → gemini-2.5-flash-lite)
//
// All helpers are non-streaming JSON-style. Advisor streaming lives in /api/chat.

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

const OPENROUTER_TEXT_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

const OPENROUTER_VISION_MODELS = [
  'google/gemma-3-27b-it:free',
  'qwen/qwen2.5-vl-72b-instruct:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
]

// FIX 1: Use an array so callGemini can try fallback models on failure,
// mirroring the same pattern used by callOpenRouterText.
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite', // cheaper/faster fallback in the same family
]

// ─── OpenRouter (chat completions) ────────────────────────────────────────────
async function callOpenRouterText(
  messages: Msg[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing')

  let lastErr: Error | null = null
  for (const model of OPENROUTER_TEXT_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://theagridoctor.app',
          'X-Title': 'TheAgriDoctor',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens ?? 800,
          temperature: opts.temperature ?? 0.4,
        }),
      })
      if (!res.ok) {
        lastErr = new Error(`OpenRouter ${model} → ${res.status}`)
        if (res.status === 429 || res.status >= 500) continue
        throw lastErr
      }
      const json = await res.json()
      const content = json?.choices?.[0]?.message?.content?.trim()
      if (content) return content
      lastErr = new Error(`OpenRouter ${model} → empty`)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr ?? new Error('OpenRouter all models failed')
}

// ─── Google Gemini (text + vision unified) ────────────────────────────────────
type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

async function callGemini(
  parts: GeminiPart[],
  systemPrompt?: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY missing')

  // FIX 1: Iterate over models instead of calling a single one.
  let lastErr: Error | null = null
  for (const model of GEMINI_MODELS) {
    try {
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 1500,
          temperature: opts.temperature ?? 0.3,
          // FIX 2: gemini-2.5-flash has thinking enabled by default.
          // Thinking tokens silently consume from maxOutputTokens, which
          // at 1500 can exhaust the budget before any visible text is
          // produced, returning an empty response. Disable thinking here
          // since these helpers do structured/functional tasks, not
          // deep reasoning. Remove this line if you want thinking enabled.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }
      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] }
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const errBody = await res.text()
        lastErr = new Error(`Gemini ${model} ${res.status}: ${errBody.slice(0, 300)}`)
        // 429 = rate limit, 5xx = server error → try next model
        if (res.status === 429 || res.status >= 500) continue
        // 4xx (e.g. 400 bad request, 403 auth) → no point retrying other models
        throw lastErr
      }

      const json = await res.json()
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? '')
          .join('') ?? ''

      // FIX 3: Don't throw on empty — continue to the next model instead.
      if (!text.trim()) {
        lastErr = new Error(`Gemini ${model} → empty response`)
        continue
      }

      return text.trim()
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastErr ?? new Error('Gemini all models failed')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Text completion: tries OpenRouter (nemotron → llama) then Gemini. */
export async function aiText(
  messages: Msg[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  try {
    return await callOpenRouterText(messages, opts)
  } catch (err) {
    console.warn(
      '[ai] OpenRouter text failed, falling back to Gemini:',
      err instanceof Error ? err.message : err
    )
    const sys = messages.find((m) => m.role === 'system')?.content
    const userText = messages
      .filter((m) => m.role !== 'system')
      .map((m) => (m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`))
      .join('\n\n')
    return callGemini([{ text: userText }], sys, opts)
  }
}

/**
 * Vision completion for diagnose. Accepts base64 data URLs (data:image/...;base64,...).
 * Tries OpenRouter vision models first, then Gemini 2.5 Flash.
 */
export async function aiVision(
  imageBase64DataUrls: string[],
  userText: string,
  systemPrompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY

  // Try each OpenRouter vision model in sequence
  if (apiKey) {
    for (const model of OPENROUTER_VISION_MODELS) {
      try {
        const imageContent = imageBase64DataUrls.map((b64) => ({
          type: 'image_url' as const,
          image_url: { url: b64 },
        }))
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://theagridoctor.app',
            'X-Title': 'TheAgriDoctor',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: [...imageContent, { type: 'text', text: userText }] },
            ],
            max_tokens: opts.maxTokens ?? 1500,
            temperature: opts.temperature ?? 0.1,
          }),
        })
        if (!res.ok) continue
        const json = await res.json()
        const content = json?.choices?.[0]?.message?.content?.trim()
        if (content) return content
      } catch {
        // try next
      }
    }
  }

  // Fallback: Gemini vision (callGemini now handles model fallback internally)
  const geminiParts: GeminiPart[] = imageBase64DataUrls.map((url) => {
    const match = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('aiVision: invalid base64 data URL')
    return { inline_data: { mime_type: match[1], data: match[2] } }
  })
  geminiParts.push({ text: userText })
  return callGemini(geminiParts, systemPrompt, opts)
}