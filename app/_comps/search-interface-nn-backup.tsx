"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Search, X, Plus, Loader2, ArrowRight } from "lucide-react"

interface SearchResult {
  probeImage: string
  probeFile: string
  targetImage: string
  targetFile: string
  matchScore: number
  matchStatus: string
  confidenceLevel: string
  remarks: string
}

interface UploadedImage {
  id: string
  src: string
  name: string
  base64?: string
}

export default function SearchInterface() {
  const [probeImages, setProbeImages] = useState<UploadedImage[]>([])
  const [targetImages, setTargetImages] = useState<UploadedImage[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [threshold, setThreshold] = useState(80)
  const [searchProgress, setSearchProgress] = useState<string>("")
  const probeFileInputRef = useRef<HTMLInputElement>(null)
  const targetFileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'probe' | 'target') => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const base64 = event.target?.result as string
          const newImage: UploadedImage = {
            id: Math.random().toString(36).substr(2, 9),
            src: base64,
            name: file.name,
            base64: base64,
          }
          if (type === 'probe') {
            setProbeImages((prev) => [...prev, newImage])
          } else {
            setTargetImages((prev) => [...prev, newImage])
          }
        }
        reader.readAsDataURL(file)
      })
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

  const handleDrop = (e: React.DragEvent, type: 'probe' | 'target') => {
    e.preventDefault()
    e.currentTarget.classList.remove("border-cyan-400", "bg-slate-700")
    const files = e.dataTransfer.files
    if (files) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const base64 = event.target?.result as string
            const newImage: UploadedImage = {
              id: Math.random().toString(36).substr(2, 9),
              src: base64,
              name: file.name,
              base64: base64,
            }
            if (type === 'probe') {
              setProbeImages((prev) => [...prev, newImage])
            } else {
              setTargetImages((prev) => [...prev, newImage])
            }
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }

  const removeImage = (id: string, type: 'probe' | 'target') => {
    if (type === 'probe') {
      setProbeImages((prev) => prev.filter((img) => img.id !== id))
    } else {
      setTargetImages((prev) => prev.filter((img) => img.id !== id))
    }
  }

  const handleSearch = async () => {
    if (probeImages.length === 0 || targetImages.length === 0) {
      alert('Please upload both probe and target images')
      return
    }

    setIsSearching(true)
    setSearchProgress('Preparing images...')
    setSearchResults([])

    try {
      setSearchProgress(`Detecting faces in ${probeImages.length} probe images...`)
      
      const response = await fetch('/api/frs/nn-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          probeImages: probeImages.map(img => ({
            id: img.id,
            name: img.name,
            base64: img.base64
          })),
          targetImages: targetImages.map(img => ({
            id: img.id,
            name: img.name,
            base64: img.base64
          })),
          threshold: threshold
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data = await response.json()
      
      setSearchProgress('Search complete!')
      setSearchResults(data.results || [])
      
      console.log('Search results:', data)
      
    } catch (error) {
      console.error('Search error:', error)
      alert(error instanceof Error ? error.message : 'Search failed')
      setSearchProgress('')
    } finally {
      setIsSearching(false)
    }
  }

  const renderUploadZone = (type: 'probe' | 'target') => {
    const images = type === 'probe' ? probeImages : targetImages
    const fileInputRef = type === 'probe' ? probeFileInputRef : targetFileInputRef
    const title = type === 'probe' ? 'Probe Images (Set A)' : 'Target Images (Set B)'
    const description = type === 'probe' 
      ? 'Upload images to search for' 
      : 'Upload images to search against'

    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {title}
          </CardTitle>
          <p className="text-sm text-gray-400">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleImageUpload(e, type)}
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, type)}
            className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-slate-700 transition"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-300 font-medium">Drag and drop images here</p>
            <p className="text-sm text-gray-400 mb-4">or click to browse</p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              Browse Files
            </Button>
          </div>

          {images.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-300">Uploaded ({images.length})</h3>
              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.src || "/placeholder.svg"}
                      alt={img.name}
                      className="w-full h-20 object-cover rounded-lg border border-slate-600"
                    />
                    <button
                      onClick={() => removeImage(img.id, type)}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    <p className="text-xs text-gray-400 mt-1 truncate">{img.name}</p>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full text-sm border-cyan-500 text-cyan-400"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">N:N Facial Recognition Search</h1>
        <p className="text-gray-400">Upload probe and target images to perform comprehensive face matching</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Probe Upload Zone */}
        <div className="lg:col-span-1">
          {renderUploadZone('probe')}
        </div>

        {/* Center Arrow */}
        <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <ArrowRight className="w-12 h-12 text-cyan-400" />
            <p className="text-sm text-gray-400 text-center">
              {probeImages.length} × {targetImages.length} = {probeImages.length * targetImages.length} comparisons
            </p>
          </div>
        </div>

        {/* Target Upload Zone */}
        <div className="lg:col-span-1">
          {renderUploadZone('target')}
        </div>
      </div>

      {/* Settings and Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Search Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">Similarity Threshold</label>
                  <div className="flex items-center justify-between">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-semibold text-cyan-400 ml-3">{threshold}%</span>
                  </div>
                  <p className="text-xs text-gray-400">Only show matches above {threshold}% confidence</p>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleSearch}
                    disabled={probeImages.length === 0 || targetImages.length === 0 || isSearching}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white h-12 font-semibold disabled:bg-slate-600"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        Start N:N Search
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {isSearching && searchProgress && (
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    <p className="text-sm text-gray-300">{searchProgress}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-xs">
              <div>
                <p className="font-semibold text-white mb-1">1. Upload Sets</p>
                <p>Add probe images (A) and target images (B)</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">2. Set Threshold</p>
                <p>Adjust minimum confidence for matches</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">3. Compare All</p>
                <p>System compares every A against every B</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">4. View Results</p>
                <p>See matching pairs with confidence scores</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Section */}
      {searchResults.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">
              Search Results ({searchResults.length} matches found above {threshold}%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-cyan-400 transition"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    {/* Probe Image */}
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-gray-400">Probe</p>
                      <div className="w-20 h-20 bg-slate-600 rounded-lg overflow-hidden">
                        {probeImages.find(img => img.id === result.probeImage) && (
                          <img
                            src={probeImages.find(img => img.id === result.probeImage)?.src}
                            alt={result.probeFile}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-300 truncate max-w-full">{result.probeFile}</p>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                      <ArrowRight className="w-6 h-6 text-cyan-400" />
                    </div>

                    {/* Target Image */}
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-gray-400">Target</p>
                      <div className="w-20 h-20 bg-slate-600 rounded-lg overflow-hidden">
                        {targetImages.find(img => img.id === result.targetImage) && (
                          <img
                            src={targetImages.find(img => img.id === result.targetImage)?.src}
                            alt={result.targetFile}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-300 truncate max-w-full">{result.targetFile}</p>
                    </div>

                    {/* Match Score */}
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-2xl font-bold text-cyan-400">{result.matchScore.toFixed(1)}%</p>
                      <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500"
                          style={{ width: `${result.matchScore}%` }}
                        />
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        result.confidenceLevel === 'High' ? 'bg-green-500/20 text-green-400' :
                        result.confidenceLevel === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {result.confidenceLevel}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        result.matchStatus === 'Match' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {result.matchStatus}
                      </span>
                      {result.remarks && (
                        <p className="text-xs text-gray-400 text-center">{result.remarks}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isSearching && probeImages.length === 0 && targetImages.length === 0 && searchResults.length === 0 && (
        <Card className="bg-slate-700 border-slate-600 text-center py-12">
          <Search className="w-16 h-16 mx-auto text-gray-400 mb-4 opacity-50" />
          <p className="text-gray-400 text-lg">Upload probe and target images to start N:N search</p>
          <p className="text-gray-500 text-sm mt-2">Compare multiple faces against multiple faces simultaneously</p>
        </Card>
      )}
    </div>
  )
}
