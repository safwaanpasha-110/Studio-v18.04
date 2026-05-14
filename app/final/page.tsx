"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Navbar from "@/app/_comps/navbar"
import ExportModal from "@/app/_comps/export-modal"
import { Download } from "lucide-react"

export default function FinalPage() {
  const router = useRouter()
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [imgData, setImgData] = useState<string | null>(null)

  useEffect(() => {
    // Get image from sessionStorage
    const storedImage = sessionStorage.getItem("enhancedImage")
    if (storedImage) {
      setImgData(storedImage)
    } else {
      // If no image, redirect back to editor
      router.push("/editor")
    }
  }, [])

  const handleDownload = (format: "png" | "jpeg") => {
    if (!imgData) return

    const link = document.createElement("a")
    link.href = imgData
    link.download = `enhanced-image.${format}`
    link.click()
  }

  const handleExport = async (exportData: {
    name: string
    watchlistId: string
    comment?: string
  }) => {
    if (!imgData) return

    setIsExportModalOpen(false)

    try {
      console.log("Exporting to FRS:", exportData)

      const response = await fetch('/api/frs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: exportData.name,
          watchlistId: exportData.watchlistId,
          imageBase64: imgData,
          comment: exportData.comment,
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("Upload failed:", result)
        throw new Error(result.error || 'Upload failed')
      }

      console.log("Upload success:", result)
      alert(`Successfully exported "${exportData.name}" to FRS!\nCard ID: ${result.cardId}`)
      
    } catch (error) {
      console.error("Export error:", error)
      alert(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Enhanced Image</h1>
            <p className="text-gray-400">Your image has been successfully enhanced</p>
          </div>

          {imgData && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 flex justify-center">
              <img
                src={imgData || "/placeholder.svg"}
                alt="Enhanced"
                className="max-w-full max-h-96 rounded-lg border border-slate-600"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button onClick={() => handleDownload("png")} className="bg-cyan-500 hover:bg-cyan-600 text-white">
              <Download className="w-4 h-4 mr-2" />
              PNG
            </Button>
            <Button onClick={() => handleDownload("jpeg")} className="bg-cyan-500 hover:bg-cyan-600 text-white">
              <Download className="w-4 h-4 mr-2" />
              JPEG
            </Button>
            <Button
              onClick={() => setIsExportModalOpen(true)}
              variant="outline"
              className="border-cyan-500 text-cyan-400 hover:bg-slate-700"
            >
              Enroll
            </Button>
            <Button onClick={() => router.push("/editor")} variant="outline" className="border-gray-600 text-gray-300">
              Back to Editor
            </Button>
          </div>
        </div>
      </main>

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={handleExport} />
    </>
  )
}
