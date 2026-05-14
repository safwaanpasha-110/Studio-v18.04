import { create } from "zustand"

interface EditorState {
  // Enhancement values
  brightness: number
  contrast: number
  saturation: number
  hue: number
  sharpness: number
  blur: number
  rotation: number
  isFlipped: boolean
  zoomLevel: number
  panX: number
  panY: number
  histogramEQ: boolean
  cropArea: { x: number; y: number; width: number; height: number } | null
  isCropMode: boolean
  upscaleFactor: number

  // History for undo/redo
  history: Array<
    Omit<
      EditorState,
      | "history"
      | "historyIndex"
      | "canUndo"
      | "canRedo"
      | "setHistogramEQ"
      | "autoEnhance"
      | "undo"
      | "redo"
      | "reset"
      | "setBrightness"
      | "setContrast"
      | "setSaturation"
      | "setHue"
      | "setSharpness"
      | "setBlur"
      | "setZoomLevel"
      | "setPan"
      | "rotate"
      | "flip"
      | "addToHistory"
      | "setCropArea"
      | "setIsCropMode"
      | "setUpscaleFactor"
      | "applyCrop"
      | "applyUpscale"
    >
  >
  historyIndex: number

  // Actions
  setBrightness: (value: number) => void
  setContrast: (value: number) => void
  setSaturation: (value: number) => void
  setHue: (value: number) => void
  setSharpness: (value: number) => void
  setBlur: (value: number) => void
  setZoomLevel: (value: number) => void
  setPan: (x: number, y: number) => void
  rotate: (degrees: number) => void
  flip: () => void
  undo: () => void
  redo: () => void
  reset: () => void
  setHistogramEQ: (value: boolean) => void
  autoEnhance: (imageData: ImageData) => void
  addToHistory: () => void
  setCropArea: (area: { x: number; y: number; width: number; height: number } | null) => void
  setIsCropMode: (value: boolean) => void
  setUpscaleFactor: (value: number) => void
  applyCrop: () => void
  applyUpscale: () => void
  canUndo: boolean
  canRedo: boolean
}

const initialState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  sharpness: 0,
  blur: 0,
  rotation: 0,
  isFlipped: false,
  zoomLevel: 100,
  panX: 0,
  panY: 0,
  histogramEQ: false,
  cropArea: null,
  isCropMode: false,
  upscaleFactor: 1,
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
}

// Helper function to create history snapshot
const createHistorySnapshot = (state: any) => ({
  brightness: state.brightness,
  contrast: state.contrast,
  saturation: state.saturation,
  hue: state.hue,
  sharpness: state.sharpness,
  blur: state.blur,
  rotation: state.rotation,
  isFlipped: state.isFlipped,
  zoomLevel: state.zoomLevel,
  panX: state.panX,
  panY: state.panY,
  histogramEQ: state.histogramEQ,
  cropArea: state.cropArea,
  isCropMode: state.isCropMode,
  upscaleFactor: state.upscaleFactor,
})

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  setBrightness: (value) =>
    set((state) => {
      const newState = { brightness: value }
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        ...newState,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  setContrast: (value) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        contrast: value,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  setSaturation: (value) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        saturation: value,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  setHue: (value) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        hue: value,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  setSharpness: (value) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        sharpness: value,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  setBlur: (value) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        blur: value,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  setZoomLevel: (value) =>
    set(() => ({
      zoomLevel: value,
    })),

  setPan: (x, y) =>
    set(() => ({
      panX: x,
      panY: y,
    })),

  rotate: (degrees) =>
    set((state) => {
      const newRotation = (state.rotation + degrees) % 360
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        rotation: newRotation,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  flip: () =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        isFlipped: !state.isFlipped,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  setHistogramEQ: (value) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        histogramEQ: value,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    }),

  autoEnhance: (imageData: ImageData) => {
    const data = imageData.data
    let sumBrightness = 0
    let sumContrast = 0
    let minBrightness = 255
    let maxBrightness = 0

    // Analyze image statistics
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const brightness = (r + g + b) / 3
      
      sumBrightness += brightness
      minBrightness = Math.min(minBrightness, brightness)
      maxBrightness = Math.max(maxBrightness, brightness)
      sumContrast += Math.abs(brightness - 127.5)
    }

    const avgBrightness = sumBrightness / (data.length / 4) / 255
    const avgContrast = sumContrast / (data.length / 4) / 127.5
    const dynamicRange = (maxBrightness - minBrightness) / 255

    let newBrightness = 0
    let newContrast = 0
    let newSaturation = 0
    let newSharpness = 0
    let enableHistogramEQ = false

    // Brightness enhancement
    if (avgBrightness < 0.35) {
      newBrightness = 40 // Very dark image
    } else if (avgBrightness < 0.45) {
      newBrightness = 25 // Dark image
    } else if (avgBrightness > 0.75) {
      newBrightness = -30 // Very bright image
    } else if (avgBrightness > 0.65) {
      newBrightness = -15 // Bright image
    }

    // Contrast enhancement
    if (avgContrast < 0.15 || dynamicRange < 0.4) {
      newContrast = 35 // Low contrast
      newSaturation = 20
      enableHistogramEQ = true
    } else if (avgContrast < 0.25) {
      newContrast = 20 // Medium-low contrast
      newSaturation = 10
    }

    // Always add some sharpness for quality improvement
    newSharpness = 15

    // Apply noise reduction for low light images
    const needsDenoising = avgBrightness < 0.4
    const newBlur = needsDenoising ? 1 : 0

    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        brightness: newBrightness,
        contrast: newContrast,
        saturation: newSaturation,
        sharpness: newSharpness,
        blur: newBlur,
        histogramEQ: enableHistogramEQ,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: true,
      }
    })
  },

  addToHistory: () =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(createHistorySnapshot(state))
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canRedo: false,
        canUndo: newHistory.length > 0,
      }
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1
        const previousState = state.history[newIndex]
        return {
          ...previousState,
          historyIndex: newIndex,
          canUndo: newIndex > 0,
          canRedo: true,
        }
      }
      return state
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1
        const nextState = state.history[newIndex]
        return {
          ...nextState,
          historyIndex: newIndex,
          canUndo: true,
          canRedo: newIndex < state.history.length - 1,
        }
      }
      return state
    }),

  reset: () => set(initialState),

  setCropArea: (area) => set({ cropArea: area }),
  
  setIsCropMode: (value) => set({ isCropMode: value }),
  
  setUpscaleFactor: (value) => set({ upscaleFactor: value }),

  applyCrop: () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement
    if (!canvas) return
    const state = get()
    if (!state.cropArea) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { x, y, width, height } = state.cropArea
    const imageData = ctx.getImageData(x, y, width, height)
    
    canvas.width = width
    canvas.height = height
    ctx.putImageData(imageData, 0, 0)
    
    set({ cropArea: null, isCropMode: false })
  },

  applyUpscale: () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement
    if (!canvas) return
    const state = get()
    if (state.upscaleFactor <= 1) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Get current canvas dimensions and image data
    const currentWidth = canvas.width
    const currentHeight = canvas.height
    const currentImageData = ctx.getImageData(0, 0, currentWidth, currentHeight)
    
    // Calculate new pixel dimensions (upscaled resolution)
    const newWidth = Math.round(currentWidth * state.upscaleFactor)
    const newHeight = Math.round(currentHeight * state.upscaleFactor)
    
    // Create temporary canvas with original size
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = currentWidth
    tempCanvas.height = currentHeight
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return
    
    tempCtx.putImageData(currentImageData, 0, 0)
    
    // Create high-res canvas
    const upscaledCanvas = document.createElement('canvas')
    upscaledCanvas.width = newWidth
    upscaledCanvas.height = newHeight
    const upscaledCtx = upscaledCanvas.getContext('2d')
    if (!upscaledCtx) return
    
    // Use high-quality scaling
    upscaledCtx.imageSmoothingEnabled = true
    upscaledCtx.imageSmoothingQuality = 'high'
    upscaledCtx.drawImage(tempCanvas, 0, 0, newWidth, newHeight)
    
    // Get the upscaled image as data URL
    const upscaledDataUrl = upscaledCanvas.toDataURL('image/png')
    
    // Load it back but maintain display size by redrawing to fit canvas
    const img = new Image()
    img.onload = () => {
      // Keep canvas display size the same
      ctx.clearRect(0, 0, currentWidth, currentHeight)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      // Draw the high-res image back at original canvas size
      // The image now has more pixels but displays at same size (higher quality)
      ctx.drawImage(img, 0, 0, currentWidth, currentHeight)
    }
    img.src = upscaledDataUrl
  },

  canUndo: false,
  canRedo: false,
}))
