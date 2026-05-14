"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import { useEditorStore } from "@/lib/editor-store"
import { Button } from "@/components/ui/button"

interface EditorCanvasProps {
  compareMode?: "none" | "side-by-side" | "overlay" | "before-after"
  secondImageSrc?: string | null
  transparency?: number
  sliderPosition?: number
}

export default function EditorCanvas({
  compareMode = "none",
  secondImageSrc = null,
  transparency = 50,
  sliderPosition = 50,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null)
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null)
  const {
    brightness,
    contrast,
    saturation,
    hue,
    sharpness,
    blur,
    rotation,
    isFlipped,
    zoomLevel,
    panX,
    panY,
    histogramEQ,
    isCropMode,
    setCropArea,
  } = useEditorStore()

  useEffect(() => {
    if (!canvasRef.current || !imageSrc) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Use window dimensions to ensure large canvas
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      
      // Calculate available space (between left and right sidebars ~256px each)
      const availableWidth = Math.max(windowWidth - 520, 600)
      const availableHeight = Math.max(windowHeight - 150, 500)
      
      const aspectRatio = img.width / img.height

      let canvasWidth = availableWidth
      let canvasHeight = canvasWidth / aspectRatio

      if (canvasHeight > availableHeight) {
        canvasHeight = availableHeight
        canvasWidth = canvasHeight * aspectRatio
      }

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      // Calculate base size to fit image in canvas at 100% zoom
      let baseWidth = canvasWidth
      let baseHeight = canvasWidth / aspectRatio
      
      if (baseHeight > canvasHeight) {
        baseHeight = canvasHeight
        baseWidth = canvasHeight * aspectRatio
      }

      // Apply zoom to the fitted size
      const displayWidth = (baseWidth * zoomLevel) / 100
      const displayHeight = (baseHeight * zoomLevel) / 100

      // Apply filters
      let filterString = `
        brightness(${1 + brightness / 100})
        contrast(${1 + contrast / 100})
        saturate(${1 + saturation / 100})
        hue-rotate(${hue}deg)
      `

      if (blur > 0) {
        filterString += ` blur(${blur}px)`
      }

      if (sharpness > 0) {
        filterString += ` contrast(${1 + sharpness / 50})`
      }

      if (histogramEQ) {
        filterString += " contrast(1.3)"
      }

      ctx.filter = filterString

      // Center and draw the image
      let x = (canvasWidth - displayWidth) / 2 + panX
      let y = (canvasHeight - displayHeight) / 2 + panY
      let drawWidth = displayWidth
      let drawHeight = displayHeight

      // Adjust for side-by-side comparison - scale images to fit in half width
      if (compareMode === "side-by-side" && secondImageSrc) {
        const halfWidth = canvasWidth / 2
        
        // Scale down if image is too wide for half
        if (displayWidth > halfWidth) {
          const scale = halfWidth / displayWidth
          drawWidth = displayWidth * scale
          drawHeight = displayHeight * scale
        }
        
        // Center in left half
        x = (halfWidth - drawWidth) / 2 + panX
        y = (canvasHeight - drawHeight) / 2 + panY
      }

      ctx.save()
      ctx.translate(canvasWidth / 2, canvasHeight / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      if (isFlipped) ctx.scale(-1, 1)
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2)

      ctx.drawImage(img, x, y, drawWidth, drawHeight)
      ctx.restore()

      // Handle comparison modes
      if (compareMode === "side-by-side" && secondImageSrc) {
        const img2 = new Image()
        img2.crossOrigin = "anonymous"
        img2.onload = () => {
          const halfWidth = canvasWidth / 2
          const dividerX = halfWidth

          // Draw divider line
          ctx.strokeStyle = "#06b6d4"
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(dividerX, 0)
          ctx.lineTo(dividerX, canvasHeight)
          ctx.stroke()

          // Use same zoom and dimensions as first image for sync zoom
          let img2Width = drawWidth
          let img2Height = drawHeight
          
          // Center the second image in the right half
          const img2X = dividerX + (halfWidth - img2Width) / 2 + panX
          const img2Y = (canvasHeight - img2Height) / 2 + panY
          
          ctx.save()
          ctx.filter = "none"
          ctx.drawImage(img2, img2X, img2Y, img2Width, img2Height)
          ctx.restore()

          // Labels
          ctx.fillStyle = "#06b6d4"
          ctx.font = "14px sans-serif"
          ctx.fillText("Edited", 10, 25)
          ctx.fillText("Original", dividerX + 10, 25)
        }
        img2.src = secondImageSrc
      } else if (compareMode === "before-after" && originalImageSrc) {
        const img2 = new Image()
        img2.crossOrigin = "anonymous"
        img2.onload = () => {
          const sliderX = (sliderPosition / 100) * canvasWidth

          // Save current edited state
          const editedImageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
          
          // Draw original image on the right side (after slider position)
          ctx.save()
          ctx.beginPath()
          ctx.rect(sliderX, 0, canvasWidth - sliderX, canvasHeight)
          ctx.clip()
          // Draw original image without filters
          ctx.filter = "none"
          ctx.clearRect(sliderX, 0, canvasWidth - sliderX, canvasHeight)
          ctx.drawImage(img2, x, y, displayWidth, displayHeight)
          ctx.restore()

          // Draw slider line
          ctx.strokeStyle = "#06b6d4"
          ctx.lineWidth = 3
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(sliderX, 0)
          ctx.lineTo(sliderX, canvasHeight)
          ctx.stroke()

          // Draw slider handle
          ctx.fillStyle = "#06b6d4"
          ctx.beginPath()
          ctx.arc(sliderX, canvasHeight / 2, 15, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = "#fff"
          ctx.font = "bold 12px sans-serif"
          ctx.textAlign = "center"
          ctx.fillText("◄►", sliderX, canvasHeight / 2 + 4)

          // Labels
          ctx.fillStyle = "#06b6d4"
          ctx.font = "14px sans-serif"
          ctx.textAlign = "left"
          ctx.fillText("Edited", 10, 25)
          ctx.textAlign = "right"
          ctx.fillText("Original", canvasWidth - 10, 25)
        }
        img2.src = originalImageSrc
      } else if (compareMode === "overlay" && secondImageSrc) {
        const img2 = new Image()
        img2.crossOrigin = "anonymous"
        img2.onload = () => {
          ctx.globalAlpha = transparency / 100
          ctx.filter = "none"
          ctx.drawImage(img2, x, y, displayWidth, displayHeight)
          ctx.globalAlpha = 1
        }
        img2.src = secondImageSrc
      }
    }
    img.src = imageSrc
  }, [
    imageSrc,
    originalImageSrc,
    brightness,
    contrast,
    saturation,
    hue,
    sharpness,
    blur,
    rotation,
    isFlipped,
    zoomLevel,
    panX,
    panY,
    histogramEQ,
    compareMode,
    secondImageSrc,
    transparency,
    sliderPosition,
  ])

  // Crop mode handlers
  useEffect(() => {
    if (!isCropMode || !canvasRef.current) return

    const canvas = canvasRef.current
    let startX = 0, startY = 0, endX = 0, endY = 0
    let isDrawing = false

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      startX = e.clientX - rect.left
      startY = e.clientY - rect.top
      isDrawing = true
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return
      const rect = canvas.getBoundingClientRect()
      endX = e.clientX - rect.left
      endY = e.clientY - rect.top

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Redraw image
      const img = new Image()
      img.src = imageSrc || ''
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Draw crop rectangle
        ctx.strokeStyle = '#06b6d4'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(startX, startY, endX - startX, endY - startY)
      }
    }

    const handleMouseUp = () => {
      if (!isDrawing) return
      isDrawing = false

      const x = Math.min(startX, endX)
      const y = Math.min(startY, endY)
      const width = Math.abs(endX - startX)
      const height = Math.abs(endY - startY)

      if (width > 10 && height > 10) {
        setCropArea({ x, y, width, height })
      }
    }

    canvas.style.cursor = 'crosshair'
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)

    return () => {
      canvas.style.cursor = 'default'
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isCropMode, imageSrc, setCropArea])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const src = event.target?.result as string
        setImageSrc(src)
        setOriginalImageSrc(src)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex-1 bg-slate-900 border-l border-r border-slate-700 flex flex-col items-center justify-center" style={{ minWidth: '600px', minHeight: '500px' }}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

      {!imageSrc ? (
        <div className="text-center space-y-4">
          <p className="text-gray-400 text-lg">No image loaded</p>
          <Button onClick={() => fileInputRef.current?.click()} className="bg-cyan-500 hover:bg-cyan-600">
            Upload Image
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="relative">
            <canvas ref={canvasRef} className="border border-slate-600 rounded-lg shadow-lg max-w-full" />
            {isCropMode && (
              <div className="absolute top-2 left-2 bg-cyan-500 text-white px-3 py-1 rounded text-sm">
                Click and drag to select crop area
              </div>
            )}
          </div>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
            Change Image
          </Button>
        </div>
      )}
    </div>
  )
}
