"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useEditorStore } from "@/lib/editor-store"
import { Lock } from "lucide-react"

interface CompareToolsProps {
  onComparisonModeChange?: (mode: "none" | "side-by-side" | "overlay" | "before-after") => void
  onSecondImageChange?: (src: string | null) => void
  onTransparencyChange?: (value: number) => void
  onSliderChange?: (value: number) => void
}

export default function CompareTools({
  onComparisonModeChange,
  onSecondImageChange,
  onTransparencyChange,
  onSliderChange,
}: CompareToolsProps) {
  const [compareMode, setCompareMode] = useState<"none" | "side-by-side" | "overlay" | "before-after">("none")
  const [transparency, setTransparency] = useState(50)
  const [secondImageSrc, setSecondImageSrc] = useState<string | null>(null)
  const [syncZoom, setSyncZoom] = useState(true)
  const [sliderPosition, setSliderPosition] = useState(50)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { zoomLevel, panX, panY } = useEditorStore()

  const handleCompareModeChange = (mode: "none" | "side-by-side" | "overlay" | "before-after") => {
    setCompareMode(mode)
    onComparisonModeChange?.(mode)
  }

  const handleTransparencyChange = (val: number) => {
    setTransparency(val)
    onTransparencyChange?.(val)
  }

  const handleSliderChange = (val: number) => {
    setSliderPosition(val)
    onSliderChange?.(val)
  }

  const handleLoadSecondImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const src = event.target?.result as string
        setSecondImageSrc(src)
        onSecondImageChange?.(src)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add("border-cyan-400", "bg-slate-700")
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove("border-cyan-400", "bg-slate-700")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove("border-cyan-400", "bg-slate-700")
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const src = event.target?.result as string
        setSecondImageSrc(src)
        onSecondImageChange?.(src)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="w-72 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto space-y-6 h-[calc(100vh-80px)]">
      {/* Comparison Mode Section */}
      <div className="space-y-3">
        <h3 className="text-white font-semibold">Comparison Mode</h3>
        <div className="space-y-2">
          <Button
            onClick={() => handleCompareModeChange("none")}
            variant={compareMode === "none" ? "default" : "outline"}
            className="w-full text-sm"
          >
            None
          </Button>
          <Button
            onClick={() => handleCompareModeChange("side-by-side")}
            variant={compareMode === "side-by-side" ? "default" : "outline"}
            className="w-full text-sm"
          >
            Side-by-Side
          </Button>
          <Button
            onClick={() => handleCompareModeChange("before-after")}
            variant={compareMode === "before-after" ? "default" : "outline"}
            className="w-full text-sm"
          >
            Before-After
          </Button>
          <Button
            onClick={() => handleCompareModeChange("overlay")}
            variant={compareMode === "overlay" ? "default" : "outline"}
            className="w-full text-sm"
          >
            Overlay
          </Button>
        </div>
      </div>

      {/* Overlay Transparency */}
      {compareMode === "overlay" && (
        <div className="space-y-3 border-t border-slate-700 pt-4">
          <label className="text-sm text-gray-300">Blend: {transparency}%</label>
          <Slider
            value={[transparency]}
            onValueChange={(val) => handleTransparencyChange(val[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Before-After Slider */}
      {compareMode === "before-after" && (
        <div className="space-y-3 border-t border-slate-700 pt-4">
          <label className="text-sm text-gray-300">Reveal: {sliderPosition}%</label>
          <Slider
            value={[sliderPosition]}
            onValueChange={(val) => handleSliderChange(val[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Zoom & Pan Section */}
      <div className="border-t border-slate-700 pt-4 space-y-3">
        <h3 className="text-white font-semibold text-sm">Zoom & Pan</h3>
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Zoom: {zoomLevel}%</label>
          <Slider
            value={[zoomLevel]}
            onValueChange={(val) => {
              useEditorStore.setState({ zoomLevel: val[0] })
            }}
            min={50}
            max={300}
            step={10}
            className="w-full"
          />
        </div>

        <div className="space-y-3 pt-4">
          <label className="text-sm text-gray-300 block">Pan Controls</label>
          <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
            {/* Up button */}
            <Button
              onClick={() => useEditorStore.setState({ panY: panY + 20 })}
              size="sm"
              variant="outline"
              className="text-lg col-start-2"
            >
              ↑
            </Button>
            {/* Left button */}
            <Button
              onClick={() => useEditorStore.setState({ panX: panX - 20 })}
              size="sm"
              variant="outline"
              className="text-lg"
            >
              ←
            </Button>
            {/* Right button */}
            <Button
              onClick={() => useEditorStore.setState({ panX: panX + 20 })}
              size="sm"
              variant="outline"
              className="text-lg"
            >
              →
            </Button>
            {/* Down button */}
            <Button
              onClick={() => useEditorStore.setState({ panY: panY - 20 })}
              size="sm"
              variant="outline"
              className="text-lg col-start-2"
            >
              ↓
            </Button>
          </div>
        </div>
      </div>

      {/* Load Comparison Image Section */}
      <div className="border-t border-slate-700 pt-4 space-y-3">
        <h3 className="text-white font-semibold text-sm">Load Comparison Image</h3>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLoadSecondImage} className="hidden" />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-cyan-400 transition"
        >
          <p className="text-xs text-gray-400 mb-2">Drag & drop or</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full text-xs">
            Browse
          </Button>
        </div>

        {secondImageSrc && <p className="text-xs text-cyan-400 text-center font-semibold">✓ Image loaded</p>}
      </div>

      {/* Zoom Synced Status */}
      {syncZoom && (
        <div className="bg-slate-700 border border-cyan-500 rounded p-3 text-xs text-cyan-400 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          <span>Zoom synced</span>
        </div>
      )}
    </div>
  )
}
