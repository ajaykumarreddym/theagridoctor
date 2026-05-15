import { createClient } from '@/lib/supabase/client'

const BUCKET = 'diagnosis-images'

/**
 * Uploads a File to Supabase Storage under the user's folder.
 * Returns the signed URL (valid 1 hour) for AI processing.
 */
export async function uploadDiagnosisImage(
  file: File,
  userId: string
): Promise<string> {
  const supabase = createClient()

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Get a signed URL valid for 1 hour for the AI to access
  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filename, 3600)

  if (urlError || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${urlError?.message}`)
  }

  return data.signedUrl
}

/**
 * Converts a File to a base64 data URL for inline AI vision calls
 * (used as fallback when signed URLs aren't available)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
