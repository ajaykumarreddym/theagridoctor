import { aiText } from '@/lib/ai'

export type TaskCategory = 'irrigation' | 'fertilization' | 'pest' | 'weeding' | 'monitoring' | 'harvest' | 'other'
export type TaskPriority = 'low' | 'medium' | 'high'

export type GeneratedTask = {
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  due_offset_days: number // days from today
}

export type GenerateTasksInput = {
  crop_name: string
  variety?: string | null
  growth_stage?: string | null
  sown_date?: string | null
  expected_harvest_date?: string | null
  soil_type?: string | null
  water_source?: string | null
  location?: string | null
  language?: string | null
}

const SYSTEM_PROMPT = `You are an expert Indian agronomist. Given a crop cycle, generate a prioritized, actionable
task checklist that the farmer should complete in the next 14 days. Keep each task specific, concise, and grounded
in Indian smallholder-farming practice. Use locally-relevant inputs and measurements (kg/acre, litres, °C).

CRITICAL RULES:
1. You MUST respond with ONLY a valid JSON object. No explanatory text, markdown, or code fences.
2. Keep descriptions SHORT (max 120 characters). Be concise!
3. Your entire response must be parseable as JSON.

Return this exact JSON structure:
{
  "tasks": [
    {
      "title": "short action title (max 60 chars)",
      "description": "one brief sentence only (max 120 chars)",
      "category": "irrigation" | "fertilization" | "pest" | "weeding" | "monitoring" | "harvest" | "other",
      "priority": "low" | "medium" | "high",
      "due_offset_days": 0-30
    }
  ]
}

Generate 4 to 6 tasks. Sort by urgency. Remember: ONLY return the JSON object, keep descriptions very short.`

export async function generateTasks(input: GenerateTasksInput): Promise<GeneratedTask[]> {
  const userMsg = [
    `Crop: ${input.crop_name}${input.variety ? ` (${input.variety})` : ''}`,
    input.growth_stage ? `Growth stage: ${input.growth_stage}` : null,
    input.sown_date ? `Sown on: ${input.sown_date}` : null,
    input.expected_harvest_date ? `Expected harvest: ${input.expected_harvest_date}` : null,
    input.soil_type ? `Soil: ${input.soil_type}` : null,
    input.water_source ? `Water source: ${input.water_source}` : null,
    input.location ? `Location: ${input.location}` : null,
    input.language && input.language !== 'English'
      ? `Reply titles & descriptions in ${input.language} language (English task field names).`
      : null,
    '',
    'Produce the JSON now.',
  ]
    .filter(Boolean)
    .join('\n')

  let raw: string
  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      raw = await aiText(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        { maxTokens: 1500, temperature: retryCount > 0 ? 0.2 : 0.35 },
      )

      // Extract JSON — be tolerant of code fences
      const cleaned = raw
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim()

      // Check if response looks truncated (doesn't end with })
      if (!cleaned.endsWith('}') && !cleaned.endsWith('}]')) {
        console.error('[crop-tasks] Response appears truncated:', cleaned.slice(-100))
        if (retryCount >= maxRetries) {
          throw new Error('AI response was truncated. Please try again.')
        }
        retryCount++
        continue
      }

      let parsed: unknown
      try {
        // find first { and last }
        const first = cleaned.indexOf('{')
        const last = cleaned.lastIndexOf('}')
        const slice = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned
        parsed = JSON.parse(slice)
      } catch (err) {
        console.error('[crop-tasks] AI returned invalid JSON (attempt ' + (retryCount + 1) + '):', cleaned.slice(0, 500))
        console.error('[crop-tasks] Parse error:', err)
        
        if (retryCount >= maxRetries) {
          throw new Error('AI returned invalid JSON after multiple attempts. Please try again.')
        }
        retryCount++
        continue
      }

      const tasks = (parsed as { tasks?: unknown })?.tasks
      if (!Array.isArray(tasks)) {
        console.error('[crop-tasks] AI response missing tasks array')
        if (retryCount >= maxRetries) {
          throw new Error('AI response missing tasks array')
        }
        retryCount++
        continue
      }

      const CATS: TaskCategory[] = ['irrigation', 'fertilization', 'pest', 'weeding', 'monitoring', 'harvest', 'other']
      const PRI: TaskPriority[] = ['low', 'medium', 'high']

      const out: GeneratedTask[] = []
      for (const t of tasks) {
        if (!t || typeof t !== 'object') continue
        const r = t as Record<string, unknown>
        const title = typeof r.title === 'string' ? r.title.trim().slice(0, 120) : null
        if (!title) continue
        const description = typeof r.description === 'string' ? r.description.trim().slice(0, 400) : ''
        const category = (CATS as string[]).includes(r.category as string) ? (r.category as TaskCategory) : 'other'
        const priority = (PRI as string[]).includes(r.priority as string) ? (r.priority as TaskPriority) : 'medium'
        const rawDue = Number(r.due_offset_days)
        const due_offset_days = Number.isFinite(rawDue) ? Math.max(0, Math.min(30, Math.round(rawDue))) : 0
        out.push({ title, description, category, priority, due_offset_days })
      }

      out.sort((a, b) => a.due_offset_days - b.due_offset_days)
      return out.slice(0, 8)
    } catch (err) {
      if (retryCount >= maxRetries) {
        throw err
      }
      retryCount++
    }
  }

  throw new Error('Failed to generate tasks after multiple attempts')
}

export function dueDateFromOffset(offsetDays: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
