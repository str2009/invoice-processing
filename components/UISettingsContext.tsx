"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useTheme } from "next-themes"

// Types
type Density = "comfortable" | "compact"
type UIScale = "90" | "100" | "110" | "120" | "130"
type TextIntensity = "normal" | "medium" | "high"

interface UISettingsContextType {
  // Theme (synced with next-themes)
  theme: string | undefined
  setTheme: (theme: string) => void
  
  // Density
  density: Density
  setDensity: (density: Density) => void
  
  // UI Scale
  uiScale: UIScale
  setUIScale: (scale: UIScale) => void
  
  // Text Intensity
  textIntensity: TextIntensity
  setTextIntensity: (intensity: TextIntensity) => void
  
  // Loading state
  settingsLoaded: boolean
}

const UISettingsContext = createContext<UISettingsContextType>({
  theme: "dark",
  setTheme: () => {},
  density: "comfortable",
  setDensity: () => {},
  uiScale: "100",
  setUIScale: () => {},
  textIntensity: "normal",
  setTextIntensity: () => {},
  settingsLoaded: false,
})

export function useUISettings() {
  return useContext(UISettingsContext)
}

// LocalStorage keys (unified)
const STORAGE_KEYS = {
  density: "ui_density",
  scale: "ui_scale",
  textIntensity: "ui_text_intensity",
}

interface UISettingsProviderProps {
  children: ReactNode
}

export function UISettingsProvider({ children }: UISettingsProviderProps) {
  const { theme, setTheme: setNextTheme } = useTheme()
  
  const [density, setDensityState] = useState<Density>("comfortable")
  const [uiScale, setUIScaleState] = useState<UIScale>("100")
  const [textIntensity, setTextIntensityState] = useState<TextIntensity>("normal")
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedDensity = localStorage.getItem(STORAGE_KEYS.density)
    const savedScale = localStorage.getItem(STORAGE_KEYS.scale)
    const savedTextIntensity = localStorage.getItem(STORAGE_KEYS.textIntensity)

    if (savedDensity === "comfortable" || savedDensity === "compact") {
      setDensityState(savedDensity)
    }
    if (savedScale === "90" || savedScale === "100" || savedScale === "110" || savedScale === "120" || savedScale === "130") {
      setUIScaleState(savedScale)
    }
    if (savedTextIntensity === "normal" || savedTextIntensity === "medium" || savedTextIntensity === "high") {
      setTextIntensityState(savedTextIntensity)
    }

    setSettingsLoaded(true)
  }, [])

  // Apply density to document
  useEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])

  // Apply UI scale to document
  useEffect(() => {
    const scaleMap: Record<UIScale, string> = {
      "90": "90%",
      "100": "100%",
      "110": "110%",
      "120": "120%",
      "130": "130%",
    }
    document.documentElement.style.fontSize = scaleMap[uiScale]
  }, [uiScale])

  // Apply text intensity to document
  useEffect(() => {
    document.documentElement.classList.remove("text-intensity-normal", "text-intensity-medium", "text-intensity-high")
    document.documentElement.classList.add(`text-intensity-${textIntensity}`)
    document.documentElement.dataset.text = textIntensity
  }, [textIntensity])

  // Setters with localStorage persistence
  const setDensity = useCallback((value: Density) => {
    setDensityState(value)
    localStorage.setItem(STORAGE_KEYS.density, value)
  }, [])

  const setUIScale = useCallback((value: UIScale) => {
    setUIScaleState(value)
    localStorage.setItem(STORAGE_KEYS.scale, value)
  }, [])

  const setTextIntensity = useCallback((value: TextIntensity) => {
    setTextIntensityState(value)
    localStorage.setItem(STORAGE_KEYS.textIntensity, value)
  }, [])

  // Theme setter (wraps next-themes)
  const setTheme = useCallback((value: string) => {
    setNextTheme(value)
  }, [setNextTheme])

  return (
    <UISettingsContext.Provider
      value={{
        theme,
        setTheme,
        density,
        setDensity,
        uiScale,
        setUIScale,
        textIntensity,
        setTextIntensity,
        settingsLoaded,
      }}
    >
      {children}
    </UISettingsContext.Provider>
  )
}
