"use client"

import { useEditorStore } from "@/lib/editor-store"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { RotateCw, Undo2, Redo2, Wand2, BarChart3, Sparkles, Crop, ArrowUpCircle } from "lucide-react"
import { useState } from "react"

export default function EnhancementTools() {
  const {
    brightness,
    contrast,
    saturation,
    hue,
    sharpness,
    blur,
    histogramEQ,
    isCropMode,
    upscaleFactor,
    setBrightness,
    setContrast,
    setSaturation,
    setHue,
    setSharpness,
    setBlur,
    setHistogramEQ,
    autoEnhance,
    undo,
    redo,
    canUndo,
    canRedo,
    rotate,
    flip,
    reset,
    setIsCropMode,
    applyCrop,
    setUpscaleFactor,
    applyUpscale,
  } = useEditorStore()

  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [isDeblurring, setIsDeblurring] = useState(false)
  const [isAiEnhancing, setIsAiEnhancing] = useState(false)

  const handleAutoEnhance = () => {
    const canvas = document.querySelector("canvas")
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        autoEnhance(imageData)
      }
    }
  }

  const handleAiEnhance = async () => {
    setIsAiEnhancing(true)
    const canvas = document.querySelector("canvas") as HTMLCanvasElement
    if (!canvas) {
      setIsAiEnhancing(false)
      return
    }

    // Store original canvas dimensions
    const originalWidth = canvas.width
    const originalHeight = canvas.height

    try {
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.95)
      
      const response = await fetch('/api/ai-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      })

      if (!response.ok) throw new Error('AI enhancement failed')
      
      const data = await response.json()
      
      if (data.enhancedImage) {
        const img = new Image()
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Keep original canvas size, draw enhanced image scaled to fit
            canvas.width = originalWidth
            canvas.height = originalHeight
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, originalWidth, originalHeight)
          }
        }
        img.src = data.enhancedImage
      }
    } catch (error) {
      console.error('AI enhance error:', error)
      alert('AI enhancement failed. Using local auto-enhance.')
      handleAutoEnhance()
    } finally {
      setIsAiEnhancing(false)
    }
  }

  const handleDeblur = () => {
    setIsDeblurring(true)
    const canvas = document.querySelector("canvas") as HTMLCanvasElement
    if (!canvas) {
      setIsDeblurring(false)
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setIsDeblurring(false)
      return
    }

    // Apply unsharp mask filter for deblurring
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    // Create a temporary canvas for gaussian blur
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) {
      setIsDeblurring(false)
      return
    }

    // Copy original image
    tempCtx.putImageData(imageData, 0, 0)
    
    // Apply gaussian blur
    tempCtx.filter = 'blur(2px)'
    tempCtx.drawImage(tempCanvas, 0, 0)
    const blurredData = tempCtx.getImageData(0, 0, width, height).data

    // Unsharp mask: original + amount * (original - blurred)
    const amount = 2.0 // Sharpening amount
    const threshold = 0 // Threshold for change
    
    for (let i = 0; i < data.length; i += 4) {
      const diff = data[i] - blurredData[i]
      if (Math.abs(diff) > threshold) {
        data[i] = Math.min(255, Math.max(0, data[i] + amount * diff))
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + amount * (data[i + 1] - blurredData[i + 1])))
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + amount * (data[i + 2] - blurredData[i + 2])))
      }
    }

    ctx.putImageData(imageData, 0, 0)
    
    // Apply additional sharpening
    setSharpness(Math.min(100, sharpness + 30))
    
    setTimeout(() => setIsDeblurring(false), 500)
  }

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto space-y-6 h-[calc(100vh-80px)]">
      <div className="space-y-4">
        <h3 className="text-white font-semibold">Enhancement</h3>

        {/* Brightness */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Brightness: {brightness}</label>
          <Slider
            value={[brightness]}
            onValueChange={(val) => setBrightness(val[0])}
            min={-100}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Contrast: {contrast}</label>
          <Slider
            value={[contrast]}
            onValueChange={(val) => setContrast(val[0])}
            min={-100}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Saturation: {saturation}</label>
          <Slider
            value={[saturation]}
            onValueChange={(val) => setSaturation(val[0])}
            min={-100}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Hue */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Hue: {hue}</label>
          <Slider
            value={[hue]}
            onValueChange={(val) => setHue(val[0])}
            min={-180}
            max={180}
            step={1}
            className="w-full"
          />
        </div>

        {/* Sharpness */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Sharpness: {sharpness}</label>
          <Slider
            value={[sharpness]}
            onValueChange={(val) => setSharpness(val[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Blur */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Blur / Denoise: {blur}</label>
          <Slider
            value={[blur]}
            onValueChange={(val) => setBlur(val[0])}
            min={0}
            max={50}
            step={1}
            className="w-full"
          />
        </div>
      </div>

      <div className="border-t border-slate-700 pt-4 space-y-3">
        <h3 className="text-white font-semibold text-sm">Smart Enhance</h3>
        <Button
          onClick={handleAiEnhance}
          disabled={isAiEnhancing}
          variant="outline"
          className="w-full text-sm border-green-500 text-green-400 bg-transparent hover:bg-slate-700"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {isAiEnhancing ? 'AI Enhancing...' : 'AI Photo Enhance'}
        </Button>
        <Button
          onClick={handleDeblur}
          disabled={isDeblurring}
          variant="outline"
          className="w-full text-sm border-purple-500 text-purple-400 bg-transparent hover:bg-slate-700"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isDeblurring ? 'Deblurring...' : 'Deblur & Sharpen'}
        </Button>
        <Button
          onClick={handleAutoEnhance}
          variant="outline"
          className="w-full text-sm border-cyan-500 text-cyan-400 bg-transparent hover:bg-slate-700"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Auto Enhance
        </Button>
        <Button
          onClick={() => setHistogramEQ(!histogramEQ)}
          variant={histogramEQ ? "default" : "outline"}
          className="w-full text-sm"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Histogram EQ
        </Button>
      </div>

      <div className="border-t border-slate-700 pt-4 space-y-3">
        <h3 className="text-white font-semibold text-sm">Transform</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => rotate(90)} size="sm" variant="outline" className="text-xs">
            <RotateCw className="w-4 h-4 mr-1" />
            Rotate
          </Button>
          <Button onClick={() => flip()} size="sm" variant="outline" className="text-xs">
            Flip
          </Button>
        </div>
        
        {/* Crop Tool */}
        <div className="space-y-2">
          <Button
            onClick={() => setIsCropMode(!isCropMode)}
            variant={isCropMode ? "default" : "outline"}
            className="w-full text-sm"
          >
            <Crop className="w-4 h-4 mr-2" />
            {isCropMode ? 'Exit Crop' : 'Crop Image'}
          </Button>
          {isCropMode && (
            <Button
              onClick={applyCrop}
              size="sm"
              className="w-full bg-green-500 hover:bg-green-600 text-xs"
            >
              Apply Crop
            </Button>
          )}
        </div>

        {/* Upscale Tool */}
        <div className="space-y-2">
          <label className="text-xs text-gray-300">Upscale: {upscaleFactor}x</label>
          <Slider
            value={[upscaleFactor]}
            onValueChange={(val) => setUpscaleFactor(val[0])}
            min={1}
            max={4}
            step={0.5}
            className="w-full"
          />
          <Button
            onClick={applyUpscale}
            disabled={upscaleFactor <= 1}
            size="sm"
            variant="outline"
            className="w-full text-xs border-orange-500 text-orange-400 disabled:opacity-50"
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            Apply Upscale
          </Button>
        </div>
      </div>

      <div className="border-t border-slate-700 pt-4 space-y-3">
        <h3 className="text-white font-semibold text-sm">History</h3>
        <div className="flex gap-2">
          <Button
            onClick={undo}
            disabled={!canUndo}
            size="sm"
            variant="outline"
            className="flex-1 text-xs bg-transparent"
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Undo
          </Button>
          <Button
            onClick={redo}
            disabled={!canRedo}
            size="sm"
            variant="outline"
            className="flex-1 text-xs bg-transparent"
          >
            <Redo2 className="w-4 h-4 mr-1" />
            Redo
          </Button>
        </div>
      </div>

      <Button onClick={reset} variant="destructive" className="w-full mt-6">
        Reset All
      </Button>
    </div>
  )
}
