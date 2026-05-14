"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Search, X, Plus, Loader2, Database, User, RotateCcw } from "lucide-react"

interface SearchResult {
  probeImage: string
  probeFile: string
  matchedId: number
  matchedName: string
  matchScore: number
  matchStatus: string
  confidenceLevel: string
  remarks: string
  cardData: any
  faceIndex?: number
  totalFacesInImage?: number
  bbox?: { x: number; y: number; width: number; height: number } | null
  croppedProbeImage?: string | null
  probeImageId?: string
  probeBase64?: string
}

interface EventMatch {
  episode: number
  matchedCard: number
  createdDate: string
  thumbnail: string
  fullframe: string
  confidence: number
  cameraGroupName: string
  watchlistNames: string[]
  matchedCardName: string
  cardMeta: {
    phone: string
    lastname: string
    lockerid: string
    firstname: string
  }
}

interface EventSearchResult {
  probeImage: string
  probeFile: string
  probeBase64: string
  faceIndex: number
  totalFacesInImage: number
  bbox: { x: number; y: number; width: number; height: number } | null
  events: EventMatch[]
  totalEvents: number
}

// Component to display cropped face image
const CroppedFaceImage: React.FC<{ 
  imageBase64: string, 
  bbox: { x: number; y: number; width: number; height: number } | null | undefined,
  alt: string 
}> = ({ imageBase64, bbox, alt }) => {
  const [croppedSrc, setCroppedSrc] = useState<string>(imageBase64)

  useEffect(() => {
    console.log('CroppedFaceImage rendering:', { 
      hasImage: !!imageBase64, 
      imageLength: imageBase64?.length,
      bbox,
      hasBbox: !!bbox 
    })

    if (!bbox || !imageBase64 || bbox.x === undefined || bbox.x === null) {
      console.log('Using original image (no valid bbox)')
      setCroppedSrc(imageBase64)
      return
    }

    console.log('Attempting to crop with bbox:', bbox)

    const img = new Image()
    img.onload = () => {
      console.log('Image loaded, dimensions:', img.width, 'x', img.height)
      const canvas = document.createElement('canvas')
      canvas.width = bbox.width
      canvas.height = bbox.height
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        console.error('Failed to get canvas context')
        setCroppedSrc(imageBase64)
        return
      }

      // Draw only the bbox area
      ctx.drawImage(
        img,
        bbox.x, bbox.y, bbox.width, bbox.height,
        0, 0, bbox.width, bbox.height
      )

      const cropped = canvas.toDataURL()
      console.log('Cropping successful, cropped image length:', cropped.length)
      setCroppedSrc(cropped)
    }
    img.onerror = (e) => {
      console.error('Image load error:', e)
      setCroppedSrc(imageBase64)
    }
    img.src = imageBase64
  }, [imageBase64, bbox])

  return (
    <img
      src={croppedSrc}
      alt={alt}
      className="w-full h-full object-cover"
    />
  )
}

interface UploadedImage {
  id: string
  src: string
  name: string
  base64?: string
}

export default function SearchInterface() {
  const [probeImages, setProbeImages] = useState<UploadedImage[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [eventSearchResults, setEventSearchResults] = useState<EventSearchResult[]>([])
  const [searchMode, setSearchMode] = useState<'database' | 'events'>('database')
  const [threshold, setThreshold] = useState(0.7)
  const [searchProgress, setSearchProgress] = useState<string>("")
  const [filterStatus, setFilterStatus] = useState<'all' | 'match' | 'no-match'>('all')
  const [selectedFullframe, setSelectedFullframe] = useState<string | null>(null)
  const probeFileInputRef = useRef<HTMLInputElement>(null)

  const handleReset = () => {
    setProbeImages([])
    setSearchResults([])
    setEventSearchResults([])
    setSearchProgress("")
    setFilterStatus('all')
    setSelectedFullframe(null)
    if (probeFileInputRef.current) {
      probeFileInputRef.current.value = ""
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setProbeImages((prev) => [...prev, newImage])
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

  const handleDrop = (e: React.DragEvent) => {
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
            setProbeImages((prev) => [...prev, newImage])
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }

  const removeImage = (id: string) => {
    setProbeImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleSearch = async () => {
    if (probeImages.length === 0) {
      alert('Please upload at least one image to search')
      return
    }

    setIsSearching(true)
    setSearchProgress('Preparing images...')
    setSearchResults([])

    try {
      setSearchProgress(`Searching ${probeImages.length} image(s)...`)
      
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
          threshold: threshold,
          pageSize: 100
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data = await response.json()
      
      setSearchProgress('Processing results...')
      console.log('API Response:', data)
      
      // Flatten results from N:N format to individual match cards
      const flatResults: SearchResult[] = []
      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((probeResult: any) => {
          const faceIndex = probeResult.faceIndex || 1
          const totalFaces = probeResult.totalFacesInImage || 1
          const bbox = probeResult.bbox
          const probeImageBase64 = probeResult.probeBase64
          const probeImageId = probeResult.probeImage
          
          console.log('Result:', {
            file: probeResult.probeFile,
            faceIndex,
            bbox,
            hasBase64: !!probeImageBase64
          })
          
          // If there are matches, add them
          if (probeResult.matches && Array.isArray(probeResult.matches) && probeResult.matches.length > 0) {
            probeResult.matches.forEach((match: any) => {
              flatResults.push({
                probeImage: probeImageId,
                probeBase64: probeImageBase64,
                probeFile: probeResult.probeFile,
                matchedId: match.id,
                matchedName: match.name,
                matchScore: match.confidence,
                matchStatus: 'Match',
                confidenceLevel: match.confidence >= 90 ? 'High' : (match.confidence >= 70 ? 'Medium' : 'Low'),
                remarks: match.confidence >= 90 ? 'Strong match' : (match.confidence >= 70 ? 'Possible match' : ''),
                cardData: match,
                faceIndex: faceIndex,
                totalFacesInImage: totalFaces,
                bbox: bbox
              })
            })
          } else {
            // No matches found for this probe image/face
            flatResults.push({
              probeImage: probeImageId,
              probeBase64: probeImageBase64,
              probeFile: probeResult.probeFile,
              matchedId: 0,
              matchedName: '',
              matchScore: 0,
              matchStatus: 'No Match',
              confidenceLevel: 'None',
              remarks: totalFaces === 0 ? 'No face detected' : 'No match found',
              cardData: null,
              faceIndex: faceIndex,
              totalFacesInImage: totalFaces,
              bbox: bbox
            })
          }
        })
      }
      
      setSearchResults(flatResults)
      setSearchProgress('Search complete!')
      console.log('Search results:', data, 'Flat results:', flatResults)
      
    } catch (error) {
      console.error('Search error:', error)
      alert(error instanceof Error ? error.message : 'Search failed')
      setSearchProgress('')
    } finally {
      setIsSearching(false)
    }
  }

  const handleEventSearch = async () => {
    if (probeImages.length === 0) {
      alert('Please upload at least one image to search')
      return
    }

    setIsSearching(true)
    setSearchProgress('Preparing images...')
    setEventSearchResults([])
    setSearchMode('events')

    try {
      setSearchProgress(`Searching events for ${probeImages.length} image(s)...`)
      
      const response = await fetch('/api/frs/event-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          probeImages: probeImages.map(img => ({
            id: img.id,
            name: img.name,
            base64: img.base64
          }))
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Event search failed')
      }

      const data = await response.json()
      
      setSearchProgress('Processing event results...')
      console.log('Event API Response:', data)
      
      setEventSearchResults(data.results || [])
      setSearchProgress('Event search complete!')
      console.log('Event search results:', data.results)
      
    } catch (error) {
      console.error('Event search error:', error)
      alert(error instanceof Error ? error.message : 'Event search failed')
      setSearchProgress('')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Facial Recognition Search</h1>
        <p className="text-gray-400">Upload images to search against the database of registered faces</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Zone */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Images to Search
              </CardTitle>
              <p className="text-sm text-gray-400">These images will be searched against the database</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={probeFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-slate-700 transition"
                onClick={() => probeFileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-300 font-medium text-lg mb-2">Drag and drop images here</p>
                <p className="text-sm text-gray-400 mb-4">or click to browse from your computer</p>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    probeFileInputRef.current?.click()
                  }}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Browse Files
                </Button>
              </div>

              {probeImages.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">Uploaded Images ({probeImages.length})</h3>
                  <div className="grid grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                    {probeImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.src || "/placeholder.svg"}
                          alt={img.name}
                          className="w-full h-24 object-cover rounded-lg border border-slate-600"
                        />
                        <button
                          onClick={() => removeImage(img.id)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                        <p className="text-xs text-gray-400 mt-1 truncate">{img.name}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => probeFileInputRef.current?.click()}
                    variant="outline"
                    className="w-full text-sm border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add More Images
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Search Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">Similarity Threshold</label>
                <div className="flex items-center justify-between">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-cyan-400 ml-3">{(threshold * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-gray-400">Only show matches above {(threshold * 100).toFixed(0)}% confidence</p>
              </div>

              {/* Search Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    setSearchMode('database')
                    handleSearch()
                  }}
                  disabled={probeImages.length === 0 || isSearching}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white h-12 font-semibold disabled:bg-slate-600"
                >
                  {isSearching && searchMode === 'database' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Database className="w-5 h-5 mr-2" />
                      Search in Database
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleEventSearch}
                  disabled={probeImages.length === 0 || isSearching}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white h-12 font-semibold disabled:bg-slate-600"
                >
                  {isSearching && searchMode === 'events' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Search in Events
                    </>
                  )}
                </Button>
              </div>

              <Button
                onClick={handleReset}
                disabled={isSearching}
                variant="outline"
                className="w-full h-10 mt-2 border-slate-600 text-gray-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All
              </Button>

              {isSearching && searchProgress && (
                <div className="bg-slate-700 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                    <p className="text-xs text-gray-300">{searchProgress}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-xs">
              <div>
                <p className="font-semibold text-white mb-1">1. Upload Images</p>
                <p>Add one or more face images to search</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">2. Set Threshold</p>
                <p>Adjust minimum confidence for matches</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">3. Search Database</p>
                <p>System searches against all registered faces</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">4. View Matches</p>
                <p>See all matching records with confidence scores</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Section */}
      {searchResults.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Results ({searchResults.filter(r => 
                  filterStatus === 'all' ? true : 
                  filterStatus === 'match' ? r.matchStatus === 'Match' : 
                  r.matchStatus === 'No Match'
                ).length} {filterStatus === 'all' ? 'total' : filterStatus === 'match' ? 'matches' : 'no matches'})
              </CardTitle>
              
              {/* Filter Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilterStatus('all')}
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className={filterStatus === 'all' 
                    ? 'bg-cyan-500 hover:bg-cyan-600 text-white' 
                    : 'border-slate-600 text-gray-400 hover:bg-slate-700'}
                >
                  All ({searchResults.length})
                </Button>
                <Button
                  onClick={() => setFilterStatus('match')}
                  variant={filterStatus === 'match' ? 'default' : 'outline'}
                  size="sm"
                  className={filterStatus === 'match' 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'border-slate-600 text-gray-400 hover:bg-slate-700'}
                >
                  Match ({searchResults.filter(r => r.matchStatus === 'Match').length})
                </Button>
                <Button
                  onClick={() => setFilterStatus('no-match')}
                  variant={filterStatus === 'no-match' ? 'default' : 'outline'}
                  size="sm"
                  className={filterStatus === 'no-match' 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'border-slate-600 text-gray-400 hover:bg-slate-700'}
                >
                  No Match ({searchResults.filter(r => r.matchStatus === 'No Match').length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchResults
                .filter(r => 
                  filterStatus === 'all' ? true : 
                  filterStatus === 'match' ? r.matchStatus === 'Match' : 
                  r.matchStatus === 'No Match'
                )
                .map((result, index) => (
                <div
                  key={index}
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-cyan-400 transition"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    {/* Probe Image */}
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-gray-400 font-semibold">Query Image</p>
                      <div className="w-24 h-24 bg-slate-600 rounded-lg overflow-hidden border-2 border-cyan-500">
                        {result.probeBase64 ? (
                          <CroppedFaceImage 
                            imageBase64={result.probeBase64}
                            bbox={result.bbox}
                            alt={result.probeFile}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 truncate max-w-full">{result.probeFile}</p>
                      {result.totalFacesInImage && result.totalFacesInImage > 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          Face {result.faceIndex} of {result.totalFacesInImage}
                        </span>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <Database className="w-8 h-8 text-cyan-400" />
                        <p className="text-xs text-gray-400">{result.matchStatus === 'Match' ? 'matched in' : 'searched in'}</p>
                        <p className="text-xs text-cyan-400 font-semibold">Database</p>
                      </div>
                    </div>

                    {/* Matched Record or No Match */}
                    {result.matchStatus === 'Match' ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-400 font-semibold">Matched Record</p>
                        <div className="w-24 h-24 bg-slate-600 rounded-lg overflow-hidden border-2 border-green-500 flex items-center justify-center">
                          {result.cardData?.faceImages && result.cardData.faceImages.length > 0 ? (
                            <img
                              src={result.cardData.faceImages[0].thumbnail}
                              alt={result.matchedName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-12 h-12 text-gray-400" />
                          )}
                        </div>
                        <p className="text-xs text-cyan-400 font-semibold truncate max-w-full">{result.matchedName}</p>
                        <p className="text-xs text-gray-400">ID: {result.matchedId}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-400 font-semibold">Result</p>
                        <div className="w-24 h-24 bg-slate-600 rounded-lg overflow-hidden border-2 border-red-500 flex items-center justify-center">
                          <X className="w-12 h-12 text-red-400" />
                        </div>
                        <p className="text-xs text-red-400 font-semibold">No Match Found</p>
                        <p className="text-xs text-gray-400">-</p>
                      </div>
                    )}

                    {/* Match Score or No Match Info */}
                    {result.matchStatus === 'Match' ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-400 font-semibold">Confidence</p>
                        <p className="text-3xl font-bold text-cyan-400">{result.matchScore.toFixed(1)}%</p>
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
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-400 font-semibold">Confidence</p>
                        <p className="text-3xl font-bold text-red-400">0%</p>
                        <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: '0%' }} />
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                          None
                        </span>
                      </div>
                    )}

                    {/* Status & Details */}
                    <div className="flex flex-col items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        result.matchStatus === 'Match' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {result.matchStatus}
                      </span>
                      {result.remarks && (
                        <p className="text-xs text-gray-400 text-center">{result.remarks}</p>
                      )}
                      {result.matchStatus === 'Match' && result.cardData?.watchlistNames && result.cardData.watchlistNames.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-gray-500 font-semibold">Watchlists:</p>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {result.cardData.watchlistNames.map((wlName: string, idx: number) => (
                              <span 
                                key={idx}
                                className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              >
                                {wlName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Search Results */}
      {eventSearchResults.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="w-5 h-5" />
              Event Search Results ({eventSearchResults.reduce((sum, r) => sum + r.totalEvents, 0)} events found)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {eventSearchResults.map((result, resultIdx) => (
                <div key={resultIdx} className="space-y-3">
                  {/* Probe Image Header */}
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-600">
                    <div className="w-16 h-16 bg-slate-600 rounded-lg overflow-hidden border-2 border-purple-500">
                      {result.probeBase64 && result.bbox ? (
                        <CroppedFaceImage 
                          imageBase64={result.probeBase64}
                          bbox={result.bbox}
                          alt={result.probeFile}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{result.probeFile}</p>
                      {result.totalFacesInImage > 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          Face {result.faceIndex} of {result.totalFacesInImage}
                        </span>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {result.totalEvents} event{result.totalEvents !== 1 ? 's' : ''} found
                      </p>
                    </div>
                  </div>

                  {/* Events Grid */}
                  {result.events.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {result.events.map((event, eventIdx) => (
                        <div
                          key={eventIdx}
                          className="bg-slate-700 rounded-lg border border-slate-600 hover:border-purple-400 transition overflow-hidden cursor-pointer"
                          onClick={() => setSelectedFullframe(event.fullframe)}
                        >
                          {/* Event Thumbnail */}
                          <div className="relative aspect-square">
                            <img
                              src={event.thumbnail}
                              alt={`Event ${event.episode}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-green-400 font-semibold">
                              {event.confidence.toFixed(1)}%
                            </div>
                          </div>

                          {/* Event Details */}
                          <div className="p-3 space-y-2">
                            <div>
                              <p className="text-xs text-gray-400">Matched Card</p>
                              <p className="text-sm font-semibold text-cyan-400">{event.matchedCardName}</p>
                              <p className="text-xs text-gray-500">ID: {event.matchedCard}</p>
                            </div>

                            {event.cardMeta && (event.cardMeta.firstname || event.cardMeta.lastname) && (
                              <div>
                                <p className="text-xs text-gray-400">Name</p>
                                <p className="text-xs text-white">
                                  {event.cardMeta.firstname} {event.cardMeta.lastname}
                                </p>
                              </div>
                            )}

                            <div>
                              <p className="text-xs text-gray-400">Camera Group</p>
                              <p className="text-xs text-white">{event.cameraGroupName}</p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-400">Date</p>
                              <p className="text-xs text-white">
                                {new Date(event.createdDate).toLocaleString()}
                              </p>
                            </div>

                            {event.watchlistNames && event.watchlistNames.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Watchlists</p>
                                <div className="flex flex-wrap gap-1">
                                  {event.watchlistNames.map((wlName, idx) => (
                                    <span 
                                      key={idx}
                                      className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                    >
                                      {wlName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <p className="text-xs text-gray-400">Episode ID</p>
                              <p className="text-xs text-gray-500">{event.episode}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-700 rounded-lg p-6 text-center">
                      <X className="w-12 h-12 mx-auto text-red-400 mb-2" />
                      <p className="text-red-400 font-semibold">No events found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {result.totalFacesInImage === 0 ? 'No face detected in this image' : 'No matching events in the system'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fullframe Modal */}
      {selectedFullframe && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedFullframe(null)}
        >
          <div className="relative max-w-6xl max-h-[90vh]">
            <button
              onClick={() => setSelectedFullframe(null)}
              className="absolute -top-12 right-0 bg-red-500 hover:bg-red-600 p-2 rounded-full"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={selectedFullframe}
              alt="Full frame"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isSearching && probeImages.length === 0 && searchResults.length === 0 && eventSearchResults.length === 0 && (
        <Card className="bg-slate-700 border-slate-600 text-center py-12">
          <Database className="w-16 h-16 mx-auto text-gray-400 mb-4 opacity-50" />
          <p className="text-gray-400 text-lg font-semibold">Upload images to search</p>
          <p className="text-gray-500 text-sm mt-2">Search in database or events</p>
        </Card>
      )}
    </div>
  )
}
