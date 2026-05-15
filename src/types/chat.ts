export type ChatSession = {
  id: string
  user_id: string
  title: string
  created_at: string
}

export type ChatMessage = {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
