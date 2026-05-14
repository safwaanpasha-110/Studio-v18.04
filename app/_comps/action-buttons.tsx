"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useRef } from "react"
import { useEditorStore } from "@/lib/editor-store"

export default function ActionButtons() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { reset } = useEditorStore()

  const handleApply = async () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement
    if (!canvas) {
      console.error("Canvas not found")
      alert("No image found. Please upload an image first.")
      return
    }
    
    try {
      const base64 = canvas.toDataURL("image/png")
      if (!base64 || base64 === "data:,") {
        console.error("Canvas is empty")
        alert("Canvas is empty. Please upload an image first.")
        return
      }
      
      // Store in sessionStorage instead of URL to avoid 431 error
      sessionStorage.setItem("enhancedImage", base64)
      router.push("/final")
    } catch (error) {
      console.error("Error converting canvas to base64:", error)
      alert("Failed to process image. Please try again.")
    }
  }

  const handleReset = () => {
    // Reset all editor values
    reset()
    
    // Clear the canvas
    const canvas = document.querySelector("canvas") as HTMLCanvasElement
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    
    // Clear sessionStorage
    sessionStorage.removeItem("uploadedImage")
    sessionStorage.removeItem("enhancedImage")
    
    // Reload the page to fully reset
    window.location.reload()
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className="bg-slate-800 border-t border-slate-700 px-6 py-4 flex gap-4 justify-end">
      <Button onClick={handleCancel} variant="outline" className="text-gray-300 bg-transparent">
        Cancel
      </Button>
      <Button onClick={handleReset} variant="secondary">
        Reset
      </Button>
      <Button onClick={handleApply} className="bg-cyan-500 hover:bg-cyan-600">
        Apply Changes
      </Button>
    </div>
  )
}
