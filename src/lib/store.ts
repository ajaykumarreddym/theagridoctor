import { create } from 'zustand'
import type { Farm } from '@/types/farm'

// ─── Auth Store ────────────────────────────────────────────────────────────────
interface AuthState {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null
  setUser: (user: AuthState['user']) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}))

// ─── Chat UI Store ─────────────────────────────────────────────────────────────
interface ChatState {
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),
}))

// ─── Farm UI Store ─────────────────────────────────────────────────────────────
interface FarmState {
  selectedFarm: Farm | null
  setSelectedFarm: (farm: Farm | null) => void
}

export const useFarmStore = create<FarmState>((set) => ({
  selectedFarm: null,
  setSelectedFarm: (farm) => set({ selectedFarm: farm }),
}))
