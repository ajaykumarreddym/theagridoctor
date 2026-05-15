import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

type ChatMsg = { role: string; content: string }

async function tryOpenRouterStream(messages: ChatMsg[]): Promise<Response | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  for (const model of OPENROUTER_MODELS) {
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
          stream: true,
          max_tokens: 1000,
          temperature: 0.7,
        }),
      })
      if (res.ok && res.body) return res
      console.warn(`[chat] OpenRouter ${model} → ${res.status}, trying next`)
    } catch (err) {
      console.warn(`[chat] OpenRouter ${model} error:`, err instanceof Error ? err.message : err)
    }
  }
  return null
}

async function callGeminiText(systemPrompt: string, messages: ChatMsg[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const userText = messages
      .map((m) => (m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`))
      .join('\n\n')
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    )
    if (!res.ok) {
      console.warn('[chat] Gemini fallback failed:', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    return text.trim() || null
  } catch (err) {
    console.warn('[chat] Gemini error:', err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Build dynamic system prompt from user context ─────────────────────────────
async function buildSystemPrompt(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, district, state, preferred_language')
    .eq('id', userId)
    .single()

  const { data: farms } = await supabase
    .from('farms')
    .select('name, total_area_acres, soil_type, water_source, crop_cycles(crop_name, variety, growth_stage, status)')
    .eq('user_id', userId)
    .limit(5)

  const { data: lastDiag } = await supabase
    .from('diagnoses')
    .select('crop_type, disease_name, severity, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const farmerName = profile?.full_name ?? 'Farmer'
  const location = [profile?.district, profile?.state].filter(Boolean).join(', ') || 'India'
  const language = profile?.preferred_language ?? 'English'

  const cropContext = farms
    ?.flatMap((f) =>
      ((f.crop_cycles as { crop_name: string; variety: string | null; growth_stage: string; status: string }[]) ?? [])
        .filter((c) => c.status === 'active')
        .map((c) => `${c.crop_name}${c.variety ? ` (${c.variety})` : ''} — ${c.growth_stage} stage on ${f.name}`)
    )
    .join('\n  ') || 'No active crops recorded'

  const farmContext = farms
    ?.map((f) => `• ${f.name}: ${f.total_area_acres ?? '?'} acres, Soil: ${f.soil_type ?? 'unknown'}, Water: ${f.water_source ?? 'unknown'}`)
    .join('\n') || 'No farms registered'

  const diagContext = lastDiag
    ? `${lastDiag.disease_name ?? 'Unknown'} on ${lastDiag.crop_type} (${lastDiag.severity} severity, ${new Date(lastDiag.created_at).toLocaleDateString()})`
    : 'No recent diagnoses'

  return `You are AgriDoctor, an expert agricultural advisor for Indian farming.

## Farmer Profile
- Name: ${farmerName}
- Location: ${location}
- Preferred language: ${language}

## Farm Overview
${farmContext}

## Active Crops
  ${cropContext}

## Latest Disease Detection
${diagContext}

## Instructions
- Respond primarily in ${language}. Match the language the farmer uses.
- Give practical, specific advice. Reference their actual crop data.
- When recommending chemicals, always include dosage, frequency, and timing.
- Flag urgent situations clearly (e.g., "⚠️ Act within 48 hours").
- Be warm, concise, and use bullet points for lists.`
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message, sessionId } = await req.json() as { message: string; sessionId: string }
    if (!message?.trim() || !sessionId) {
      return NextResponse.json({ error: 'message and sessionId required' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id, title')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20)

    await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: message })

    if (session.title === 'New Conversation') {
      const title = message.length > 60 ? message.slice(0, 60) + '…' : message
      await supabase.from('chat_sessions').update({ title }).eq('id', sessionId)
    }

    const systemPrompt = await buildSystemPrompt(supabase, user.id)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const openRouterRes = await tryOpenRouterStream(messages)

    if (!openRouterRes || !openRouterRes.ok || !openRouterRes.body) {
      // Fallback: non-streaming Gemini
      const geminiText = await callGeminiText(systemPrompt, messages.filter((m) => m.role !== 'system'))
      if (geminiText) {
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: geminiText,
        })
        return new Response(geminiText, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
      throw new Error(`All AI providers failed`)
    }

    let fullContent = ''
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openRouterRes.body!.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                const token: string = parsed.choices?.[0]?.delta?.content ?? ''
                if (token) {
                  fullContent += token
                  controller.enqueue(encoder.encode(token))
                }
              } catch { /* skip malformed chunks */ }
            }
          }
        } finally {
          reader.releaseLock()
          controller.close()
          if (fullContent.trim()) {
            await supabase.from('chat_messages').insert({
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
            })
          }
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/chat]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
