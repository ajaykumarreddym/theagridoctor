import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { aiVision } from '@/lib/ai'
import type { DiagnosisReport } from '@/types/diagnose'

const SYSTEM_PROMPT = `You are an expert agricultural pathologist. Analyze the crop image and return ONLY valid JSON with no markdown, no code fences, no explanation — just raw JSON.

The JSON must follow this exact schema:
{
  "disease_name": string,
  "is_diseased": boolean,
  "confidence_pct": number,
  "affected_part": "leaf" | "stem" | "fruit" | "root",
  "severity": "low" | "medium" | "high" | "critical",
  "cause": string,
  "symptoms": string[],
  "organic_treatment": string[],
  "chemical_treatment": [{"product": string, "dosage": string, "frequency": string}],
  "prevention_tips": string[],
  "estimated_yield_loss_pct_if_untreated": number,
  "urgency_days": number
}`

function parseReport(rawContent: string): DiagnosisReport {
  const cleaned = rawContent.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim()
  // Extract JSON object if any prose leaked in
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned
  const parsed = JSON.parse(jsonStr) as DiagnosisReport

  const required = ['disease_name', 'is_diseased', 'confidence_pct', 'severity']
  for (const field of required) {
    if (parsed[field as keyof DiagnosisReport] === undefined) {
      throw new Error(`AI response missing required field: ${field}`)
    }
  }
  return parsed
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { imageBase64Array, cropType } = body as { imageBase64Array: string[]; cropType: string }

    if (!imageBase64Array?.length || !cropType) {
      return NextResponse.json({ error: 'imageBase64Array and cropType are required' }, { status: 400 })
    }
    if (imageBase64Array.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 images allowed' }, { status: 400 })
    }

    const userText = `Analyze this ${cropType} crop image for diseases. Return only the JSON object, nothing else.`
    let rawContent: string
    try {
      rawContent = await aiVision(imageBase64Array, userText, SYSTEM_PROMPT, { maxTokens: 1500, temperature: 0.1 })
    } catch (err) {
      return NextResponse.json(
        { error: `AI providers all failed: ${err instanceof Error ? err.message : 'unknown'}` },
        { status: 502 }
      )
    }

    let report: DiagnosisReport
    try {
      report = parseReport(rawContent)
    } catch {
      // retry once
      try {
        rawContent = await aiVision(imageBase64Array, userText, SYSTEM_PROMPT, { maxTokens: 1500, temperature: 0.1 })
        report = parseReport(rawContent)
      } catch {
        return NextResponse.json(
          { error: 'AI returned invalid JSON after retry', raw: rawContent.slice(0, 500) },
          { status: 502 }
        )
      }
    }

    const imageUrls: string[] = body.imageUrls ?? []
    const { data: diagnosis, error: dbError } = await supabase
      .from('diagnoses')
      .insert({
        user_id: user.id,
        crop_type: cropType,
        image_urls: imageUrls,
        disease_name: report.disease_name,
        confidence_pct: report.confidence_pct,
        severity: report.severity,
        full_report_json: report,
        status: 'open',
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      return NextResponse.json({ report, diagnosisId: null, warning: 'Result not saved to database' })
    }
    return NextResponse.json({ report, diagnosisId: diagnosis.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/diagnose] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
