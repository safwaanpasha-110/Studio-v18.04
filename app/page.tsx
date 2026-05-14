"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Navbar from "./_comps/navbar"

export default function Home() {
  const router = useRouter()

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-6">
        <div className="text-center space-y-8 max-w-2xl">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Image Enhancement Studio
            </h1>
            <p className="text-xl text-gray-300">
              Professional tools for image enhancement and facial recognition search
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              onClick={() => router.push("/editor")}
              size="lg"
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg"
            >
              Open Editor
            </Button>
            <Button
              disabled
              variant="outline"
              size="lg"
              className="border-gray-600 text-gray-600 px-8 py-6 text-lg cursor-not-allowed opacity-50"
              title="Coming soon"
            >
              N:N Search
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-8 text-sm text-gray-400">
            <div>✓ Brightness Control</div>
            <div>✓ Contrast Adjustment</div>
            <div>✓ Saturation Boost</div>
            <div>✓ Sharpness Filter</div>
            <div>✓ Blur & Denoise</div>
            <div>✓ Image Comparison</div>
          </div>
        </div>
      </main>
    </>
  )
}
