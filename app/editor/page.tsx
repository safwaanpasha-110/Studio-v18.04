"use client"

import { useState } from "react"
import Navbar from "@/app/_comps/navbar"
import EnhancementTools from "@/app/_comps/enhancement-tools"
import EditorCanvas from "@/app/_comps/editor-canvas"
import CompareTools from "@/app/_comps/compare-tools"
import ActionButtons from "@/app/_comps/action-buttons"

export default function EditorPage() {
  const [compareMode, setCompareMode] = useState<"none" | "side-by-side" | "overlay" | "before-after">("none")
  const [secondImageSrc, setSecondImageSrc] = useState<string | null>(null)
  const [transparency, setTransparency] = useState(50)
  const [sliderPosition, setSliderPosition] = useState(50)

  return (
    <>
      <Navbar />
      <div className="flex h-[calc(100vh-80px)]">
        <EnhancementTools />
        <EditorCanvas
          compareMode={compareMode}
          secondImageSrc={secondImageSrc}
          transparency={transparency}
          sliderPosition={sliderPosition}
        />
        <CompareTools
          onComparisonModeChange={setCompareMode}
          onSecondImageChange={setSecondImageSrc}
          onTransparencyChange={setTransparency}
          onSliderChange={setSliderPosition}
        />
      </div>
      <ActionButtons />
    </>
  )
}
