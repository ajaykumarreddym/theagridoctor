export type Farm = {
  id: string
  user_id: string
  name: string
  total_area_acres: number | null
  lat: number | null
  lng: number | null
  soil_type: string | null
  water_source: string | null
  created_at: string
}

export type CropCycle = {
  id: string
  farm_id: string
  crop_name: string
  variety: string | null
  sown_date: string | null
  expected_harvest_date: string | null
  growth_stage: 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'harvest' | 'harvested'
  status: 'active' | 'harvested' | 'failed'
  created_at: string
}
