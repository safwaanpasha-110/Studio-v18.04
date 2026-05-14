import { NextRequest, NextResponse } from 'next/server'

const FRS_BASE_URL = process.env.NEXT_PUBLIC_FRS_BASE_URL || 'http://127.0.0.1:8000'
const FRS_TOKEN = `Token ${process.env.NEXT_PUBLIC_FRS_TOKEN || ''}`

// Configuration for concurrent processing
const MAX_CONCURRENT_WORKERS = 10

interface DetectionResult {
  filename: string
  sourceId: string
  detectionId: string | null
  index: number
}

interface FaceDetection {
  id: string
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
}

interface MultiFaceDetectionResult {
  filename: string
  sourceId: string
  faces: FaceDetection[]
  totalFaces: number
}

interface FaceObject {
  id: number
  thumbnail: string
  card: number
}

interface Watchlist {
  id: number
  name: string
}

interface FRSMatch {
  id: number
  name: string
  confidence: number
  created_date: string
  watch_lists: number[]
  watchlistNames: string[]
  face_objects: number
  faceImages: FaceObject[]
  meta: {
    phone: string
    lastname: string
    lockerid: string
    firstname: string
  }
}

interface SearchResult {
  probeImage: string
  probeFile: string
  probeBase64: string
  faceIndex: number
  totalFacesInImage: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  } | null
  matches: FRSMatch[]
  totalMatches: number
}

/**
 * Crop image to bbox coordinates
 * Returns base64 cropped image of just the face
 */
function cropImageToBbox(imageBase64: string, bbox: { x: number; y: number; width: number; height: number }): string | null {
  try {
    // For server-side, we'll return the bbox info and let frontend handle cropping
    // Or use a library like sharp for server-side image processing
    // For now, return null and we'll crop on frontend
    return null
  } catch (error) {
    console.error('Error cropping image:', error)
    return null
  }
}

/**
 * Detect ALL faces in a single image
 * Step 1: POST /detect with image - Returns all faces with bounding boxes
 */
async function detectAllFaces(imageBase64: string, filename: string): Promise<MultiFaceDetectionResult> {
  try {
    // Convert base64 to buffer
    const base64Data = imageBase64.split(',')[1] || imageBase64
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Create form data
    const formData = new FormData()
    const blob = new Blob([buffer], { type: 'image/jpeg' })
    formData.append('photo', blob, filename)
    formData.append('attributes', JSON.stringify({ 
      face: { 
        age: false, 
        beard: false,
        emotions: false,
        glasses: false,
        gender: false,
        medmask: false,
        headpose: false
      } 
    }))
    
    // Call FRS detect endpoint
    const response = await fetch(`${FRS_BASE_URL}/detect`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': FRS_TOKEN,
      },
      body: formData
    })
    
    if (!response.ok) {
      console.error(`Failed to detect faces in ${filename}:`, response.statusText)
      return {
        filename,
        sourceId: '',
        faces: [],
        totalFaces: 0
      }
    }
    
    const result = await response.json()
    
    console.log('Raw detect API response:', JSON.stringify(result.objects?.face?.[0], null, 2))
    
    const faces: FaceDetection[] = []
    if (result.objects?.face && result.objects.face.length > 0) {
      result.objects.face.forEach((face: any) => {
        // bbox comes as object {left, top, right, bottom} from API, not array!
        const bboxObj = face.bbox || { left: 0, top: 0, right: 0, bottom: 0 }
        console.log('Converting bbox object:', bboxObj, 'to our format')
        const convertedBbox = {
          x: bboxObj.left,
          y: bboxObj.top,
          width: bboxObj.right - bboxObj.left,
          height: bboxObj.bottom - bboxObj.top
        }
        console.log('Converted bbox:', convertedBbox)
        faces.push({
          id: face.id,
          bbox: convertedBbox,
          confidence: face.confidence || 0
        })
      })
    }
    
    return {
      filename,
      sourceId: '',
      faces,
      totalFaces: faces.length
    }
  } catch (error) {
    console.error(`Error detecting faces in ${filename}:`, error)
    return {
      filename,
      sourceId: '',
      faces: [],
      totalFaces: 0
    }
  }
}

/**
 * Legacy function for backward compatibility
 * Detect face in a single image
 * Step 1: POST /detect with image
 */
async function detectFace(imageBase64: string, filename: string): Promise<string | null> {
  try {
    // Convert base64 to buffer
    const base64Data = imageBase64.split(',')[1] || imageBase64
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Create form data
    const formData = new FormData()
    const blob = new Blob([buffer], { type: 'image/jpeg' })
    formData.append('photo', blob, filename)
    formData.append('attributes', JSON.stringify({ 
      face: { 
        age: false, 
        beard: false,
        emotions: false,
        glasses: false,
        gender: false,
        medmask: false,
        headpose: false
      } 
    }))
    
    // Call FRS detect endpoint
    const response = await fetch(`${FRS_BASE_URL}/detect`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': FRS_TOKEN,
      },
      body: formData
    })
    
    if (!response.ok) {
      console.error(`Failed to detect face in ${filename}:`, response.statusText)
      return null
    }
    
    const result = await response.json()
    
    if (result.objects?.face && result.objects.face.length > 0) {
      return result.objects.face[0].id
    }
    
    return null
  } catch (error) {
    console.error(`Error detecting face in ${filename}:`, error)
    return null
  }
}

/**
 * Search for matches in FRS database using detection ID
 * Step 2: GET /cards/humans/?looks_like=detection:<id>&threshold=<value>
 */
async function searchInDatabase(detectionId: string, threshold: number, pageSize: number = 100): Promise<any[]> {
  try {
    const searchResponse = await fetch(
      `${FRS_BASE_URL}/cards/humans/?looks_like=detection:${detectionId}&threshold=${threshold}&page_size=${pageSize}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': FRS_TOKEN,
        }
      }
    )
    
    if (!searchResponse.ok) {
      console.error('Search failed:', searchResponse.statusText)
      return []
    }
    
    const searchResult = await searchResponse.json()
    
    if (searchResult.results && searchResult.results.length > 0) {
      return searchResult.results
    }
    
    return []
  } catch (error) {
    console.error('Error searching database:', error)
    return []
  }
}

/**
 * Fetch face object images for a card
 * Step 3: GET /objects/faces/?card=<id>
 */
async function getFaceObjects(cardId: number): Promise<FaceObject[]> {
  try {
    const response = await fetch(
      `${FRS_BASE_URL}/objects/faces/?card=${cardId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': FRS_TOKEN,
        }
      }
    )
    
    if (!response.ok) {
      console.error(`Failed to fetch face objects for card ${cardId}:`, response.statusText)
      return []
    }
    
    const result = await response.json()
    
    if (result.results && result.results.length > 0) {
      return result.results.map((face: any) => ({
        id: face.id,
        thumbnail: face.thumbnail || '',
        card: face.card
      }))
    }
    
    return []
  } catch (error) {
    console.error(`Error fetching face objects for card ${cardId}:`, error)
    return []
  }
}

/**
 * Fetch all watchlists from the system
 * GET /permissions/watch-lists/
 */
async function fetchWatchlists(): Promise<Map<number, string>> {
  try {
    const response = await fetch(
      `${FRS_BASE_URL}/permissions/watch-lists/`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': FRS_TOKEN.replace('Token ', 'token '),
        }
      }
    )
    
    if (!response.ok) {
      console.error('Failed to fetch watchlists:', response.statusText)
      return new Map()
    }
    
    const result = await response.json()
    const watchlistMap = new Map<number, string>()
    
    if (result.results && result.results.length > 0) {
      result.results.forEach((wl: Watchlist) => {
        watchlistMap.set(wl.id, wl.name)
      })
    }
    
    return watchlistMap
  } catch (error) {
    console.error('Error fetching watchlists:', error)
    return new Map()
  }
}


/**
 * Process a single probe image through the complete pipeline
 * Now handles multiple faces per image
 * If detectedFaces are provided from preprocessing, use them directly
 */
async function processProbeImage(
  probeImage: any,
  index: number,
  totalCount: number,
  threshold: number,
  pageSize: number,
  watchlistMap: Map<number, string>
): Promise<SearchResult[]> {
  const { id, name, base64, detectedFaces } = probeImage
  
  console.log(`  [${index + 1}/${totalCount}] Processing: ${name}`)
  
  let detectionResult: MultiFaceDetectionResult
  
  // If faces were already detected during preprocessing, use them
  if (detectedFaces && detectedFaces.length > 0) {
    console.log(`    ✓ Using ${detectedFaces.length} pre-detected face(s)`)
    detectionResult = {
      filename: name,
      sourceId: id,
      faces: detectedFaces.map((f: any) => ({
        id: f.detectionId,
        bbox: f.bbox,
        confidence: 1.0
      })),
      totalFaces: detectedFaces.length
    }
  } else {
    // Step 1: Detect ALL faces in the image
    detectionResult = await detectAllFaces(base64, name)
    detectionResult.sourceId = id
    
    if (detectionResult.totalFaces === 0) {
      console.log(`    ✗ No faces detected in ${name}`)
      return [{
        probeImage: id,
        probeFile: name,
        probeBase64: base64,
        faceIndex: 0,
        totalFacesInImage: 0,
        bbox: null,
        matches: [],
        totalMatches: 0
      }]
    }
    
    console.log(`    ✓ Detected ${detectionResult.totalFaces} face(s) in ${name}`)
  }
  
  // Step 2 & 3: For each detected face, search and fetch face objects
  const allResults: SearchResult[] = []
  
  for (let faceIdx = 0; faceIdx < detectionResult.faces.length; faceIdx++) {
    const face = detectionResult.faces[faceIdx]
    console.log(`      [Face ${faceIdx + 1}/${detectionResult.totalFaces}] Detection ID: ${face.id.substring(0, 16)}...`)
    console.log(`      Bbox for this face:`, face.bbox)
    
    // Step 2: Search for matches
    const searchResults = await searchInDatabase(face.id, threshold, pageSize)
    
    if (searchResults.length === 0) {
      console.log(`        ✗ No matches found above threshold ${threshold}`)
      const noMatchResult = {
        probeImage: id,
        probeFile: name,
        probeBase64: base64,
        faceIndex: faceIdx + 1,
        totalFacesInImage: detectionResult.totalFaces,
        bbox: face.bbox,
        matches: [],
        totalMatches: 0
      }
      console.log('No match result bbox:', JSON.stringify(noMatchResult.bbox))
      allResults.push(noMatchResult)
      continue
    }
    
    console.log(`        ✓ Found ${searchResults.length} potential matches`)
    
    // Step 3: Fetch face objects for each match concurrently
    const matchesWithFaces = await Promise.all(
      searchResults.map(async (match: any) => {
        const faceImages = await getFaceObjects(match.id)
        
        // Map watchlist IDs to names
        const watchlistIds = match.watch_lists || []
        const watchlistNames = watchlistIds
          .map((id: number) => watchlistMap.get(id) || `Watchlist ${id}`)
          .filter((name: string) => name !== undefined)
        
        return {
          id: match.id,
          name: match.name,
          confidence: (match.looks_like_confidence || 0) * 100,
          created_date: match.created_date,
          watch_lists: watchlistIds,
          watchlistNames: watchlistNames,
          face_objects: match.face_objects || 0,
          faceImages: faceImages,
          meta: match.meta || {
            phone: '',
            lastname: '',
            lockerid: '',
            firstname: ''
          }
        }
      })
    )
    
    console.log(`        ✓ Fetched face objects for ${matchesWithFaces.length} matches`)
    
    const resultToPush = {
      probeImage: id,
      probeFile: name,
      probeBase64: base64,
      faceIndex: faceIdx + 1,
      totalFacesInImage: detectionResult.totalFaces,
      bbox: face.bbox,
      matches: matchesWithFaces,
      totalMatches: matchesWithFaces.length
    }
    
    console.log('Result object bbox before push:', JSON.stringify(resultToPush.bbox))
    
    allResults.push(resultToPush)
  }
  
  return allResults
}

/**
 * Process images concurrently with a worker pool
 */
async function processImagesConcurrently(
  probeImages: any[],
  threshold: number,
  pageSize: number,
  watchlistMap: Map<number, string>
): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const totalCount = probeImages.length
  
  console.log(`🔄 Starting concurrent processing with ${MAX_CONCURRENT_WORKERS} workers`)
  
  // Process in batches to limit concurrent requests
  for (let i = 0; i < probeImages.length; i += MAX_CONCURRENT_WORKERS) {
    const batch = probeImages.slice(i, i + MAX_CONCURRENT_WORKERS)
    const batchPromises = batch.map((img, batchIndex) => 
      processProbeImage(img, i + batchIndex, totalCount, threshold, pageSize, watchlistMap)
    )
    
    const batchResults = await Promise.all(batchPromises)
    // Flatten results since each image can now return multiple face results
    batchResults.forEach(imageResults => {
      results.push(...imageResults)
    })
    
    console.log(`📊 Progress: ${Math.min(i + MAX_CONCURRENT_WORKERS, totalCount)}/${totalCount} images processed`)
  }
  
  return results
}

export async function POST(request: NextRequest) {
  try {
    const { probeImages, threshold, pageSize = 100 } = await request.json()
    
    console.log('📥 N:N Search request received:', {
      probeCount: probeImages?.length || 0,
      threshold,
      pageSize
    })
    
    if (!probeImages || probeImages.length === 0) {
      return NextResponse.json(
        { error: 'Probe images are required' },
        { status: 400 }
      )
    }
    
    // Validate threshold (should be 0-1 now)
    if (threshold < 0 || threshold > 1) {
      return NextResponse.json(
        { error: 'Threshold must be between 0 and 1' },
        { status: 400 }
      )
    }
    
    console.log('🔍 Starting N:N facial recognition search...')
    console.log(`   Probe images: ${probeImages.length}`)
    console.log(`   Threshold: ${threshold} (${(threshold * 100).toFixed(0)}%)`)
    console.log(`   Max workers: ${MAX_CONCURRENT_WORKERS}`)
    
    const startTime = Date.now()
    
    // Fetch watchlists first
    console.log('📋 Fetching watchlists...')
    const watchlistMap = await fetchWatchlists()
    console.log(`   ✓ Loaded ${watchlistMap.size} watchlists`)
    
    // Process all probe images concurrently
    const results = await processImagesConcurrently(probeImages, threshold, pageSize, watchlistMap)
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    // Calculate statistics
    const totalFaceResults = results.length
    const totalMatches = results.reduce((sum, r) => sum + r.totalMatches, 0)
    const totalFacesDetected = results.filter(r => r.totalFacesInImage > 0).reduce((sum, r) => sum + 1, 0)
    const matchedFaces = results.filter(r => r.totalMatches > 0).length
    const unmatchedFaces = results.filter(r => r.totalMatches === 0 && r.totalFacesInImage > 0).length
    const noFaceDetected = results.filter(r => r.totalFacesInImage === 0).length
    
    console.log(`✅ N:N search completed in ${duration}s`)
    console.log(`   Processed: ${probeImages.length} images`)
    console.log(`   Total faces detected: ${totalFacesDetected}`)
    console.log(`   Faces with matches: ${matchedFaces}`)
    console.log(`   Faces without matches: ${unmatchedFaces}`)
    console.log(`   Images with no faces: ${noFaceDetected}`)
    console.log(`   Total matches found: ${totalMatches}`)
    console.log(`   Average rate: ${(probeImages.length / parseFloat(duration)).toFixed(2)} images/sec`)
    
    return NextResponse.json({
      success: true,
      threshold,
      thresholdPercent: (threshold * 100).toFixed(0) + '%',
      probeProcessed: probeImages.length,
      totalFacesDetected,
      matchedFaces,
      unmatchedFaces,
      noFaceDetected,
      totalMatches,
      totalResults: totalFaceResults,
      processingTime: duration + 's',
      results
    })
    
  } catch (error) {
    console.error('❌ N:N Search error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
