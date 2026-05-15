export type DiagnosisReport = {
  disease_name: string
  is_diseased: boolean
  confidence_pct: number
  affected_part: 'leaf' | 'stem' | 'fruit' | 'root'
  severity: 'low' | 'medium' | 'high' | 'critical'
  cause: string
  symptoms: string[]
  organic_treatment: string[]
  chemical_treatment: {
    product: string
    dosage: string
    frequency: string
  }[]
  prevention_tips: string[]
  estimated_yield_loss_pct_if_untreated: number
  urgency_days: number
}

export type Diagnosis = {
  id: string
  user_id: string
  crop_type: string
  image_urls: string[]
  disease_name: string | null
  confidence_pct: number | null
  severity: 'low' | 'medium' | 'high' | 'critical' | null
  full_report_json: DiagnosisReport | null
  status: 'open' | 'resolved'
  created_at: string
}
