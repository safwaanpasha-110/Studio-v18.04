import { NextRequest, NextResponse } from 'next/server'

const FRS_BASE_URL = process.env.NEXT_PUBLIC_FRS_BASE_URL
const FRS_TOKEN = `Token ${process.env.NEXT_PUBLIC_FRS_TOKEN || ''}`

// Configuration for concurrent processing
const MAX_CONCURRENT_WORKERS = 10

interface DetectedFace {
  id: string
  bbox: {
    left: number
    top: number
    right: number
    bottom: number
  }
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
  bbox: {
    x: number
    y: number
    width: number
    height: number
  } | null
  events: EventMatch[]
  totalEvents: number
}

/**
 * Detect faces in image
 */
async function detectFaces(imageBase64: string, filename: string): Promise<DetectedFace[]> {
  try {
    const base64Data = imageBase64.split(',')[1] || imageBase64
    const buffer = Buffer.from(base64Data, 'base64')
    
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' })
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
      return []
    }
    
    const result = await response.json()
    
    const faces: DetectedFace[] = []
    if (result.objects?.face && result.objects.face.length > 0) {
      result.objects.face.forEach((face: any) => {
        faces.push({
          id: face.id,
          bbox: face.bbox || { left: 0, top: 0, right: 0, bottom: 0 }
        })
      })
    }
    
    return faces
  } catch (error) {
    console.error(`Error detecting faces in ${filename}:`, error)
    return []
  }
}

/**
 * Search for events using detection ID
 */
async function searchEvents(detectionId: string): Promise<EventMatch[]> {
  try {
    const response = await fetch(
      `${FRS_BASE_URL}/events/faces/?looks_like=detection%3A${detectionId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': FRS_TOKEN,
        }
      }
    )
    
    if (!response.ok) {
      console.error(`Failed to search events for detection ${detectionId}:`, response.statusText)
      return []
    }
    
    const result = await response.json()
    
    if (!result.results || result.results.length === 0) {
      return []
    }
    
    return result.results.map((event: any) => ({
      episode: event.episode,
      matchedCard: event.matched_card,
      createdDate: event.created_date,
      thumbnail: event.thumbnail,
      fullframe: event.fullframe,
      confidence: (event.looks_like_confidence || event.confidence || 0) * 100,
      cameraGroupName: event.verbose_camera_group?.name || 'Unknown',
      watchlistNames: event.verbose_matched_lists?.map((list: any) => list.name) || [],
      matchedCardName: event.verbose_matched_card?.name || 'Unknown',
      cardMeta: event.verbose_matched_card?.meta || {
        phone: '',
        lastname: '',
        lockerid: '',
        firstname: ''
      }
    }))
  } catch (error) {
    console.error('Error searching events:', error)
    return []
  }
}

/**
 * Process a single probe image
 */
async function processProbeImage(
  probeImage: any,
  index: number,
  totalCount: number
): Promise<EventSearchResult[]> {
  const { id, name, base64 } = probeImage
  
  console.log(`  [${index + 1}/${totalCount}] Processing: ${name}`)
  
  // Detect faces
  const faces = await detectFaces(base64, name)
  
  if (faces.length === 0) {
    console.log(`    ✗ No faces detected in ${name}`)
    return [{
      probeImage: id,
      probeFile: name,
      probeBase64: base64,
      faceIndex: 0,
      totalFacesInImage: 0,
      bbox: null,
      events: [],
      totalEvents: 0
    }]
  }
  
  console.log(`    ✓ Detected ${faces.length} face(s) in ${name}`)
  
  const allResults: EventSearchResult[] = []
  
  for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
    const face = faces[faceIdx]
    console.log(`      [Face ${faceIdx + 1}/${faces.length}] Detection ID: ${face.id.substring(0, 16)}...`)
    
    // Search for events
    const events = await searchEvents(face.id)
    
    if (events.length === 0) {
      console.log(`        ✗ No events found`)
    } else {
      console.log(`        ✓ Found ${events.length} event(s)`)
    }
    
    allResults.push({
      probeImage: id,
      probeFile: name,
      probeBase64: base64,
      faceIndex: faceIdx + 1,
      totalFacesInImage: faces.length,
      bbox: {
        x: face.bbox.left,
        y: face.bbox.top,
        width: face.bbox.right - face.bbox.left,
        height: face.bbox.bottom - face.bbox.top
      },
      events: events,
      totalEvents: events.length
    })
  }
  
  return allResults
}

/**
 * Process multiple images concurrently
 */
async function processConcurrently(
  images: any[],
  maxWorkers: number
): Promise<EventSearchResult[]> {
  const results: EventSearchResult[] = []
  const activeWorkers: Promise<void>[] = []
  
  for (let i = 0; i < images.length; i++) {
    const worker = processProbeImage(images[i], i, images.length).then((result) => {
      results.push(...result)
      console.log(`📊 Progress: ${i + 1}/${images.length} images processed`)
    })
    
    activeWorkers.push(worker)
    
    if (activeWorkers.length >= maxWorkers) {
      await Promise.race(activeWorkers)
      activeWorkers.splice(
        activeWorkers.findIndex((p) => p === worker),
        1
      )
    }
  }
  
  await Promise.all(activeWorkers)
  
  return results
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { probeImages } = body
    
    if (!probeImages || !Array.isArray(probeImages) || probeImages.length === 0) {
      return NextResponse.json(
        { error: 'No probe images provided' },
        { status: 400 }
      )
    }
    
    console.log('📥 Event Search request received:', {
      probeCount: probeImages.length
    })
    
    console.log('🔍 Starting event search...')
    console.log(`   Probe images: ${probeImages.length}`)
    console.log(`   Max workers: ${MAX_CONCURRENT_WORKERS}`)
    
    const startTime = Date.now()
    
    console.log(`🔄 Starting concurrent processing with ${MAX_CONCURRENT_WORKERS} workers`)
    const results = await processConcurrently(probeImages, MAX_CONCURRENT_WORKERS)
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    const stats = {
      totalFacesDetected: results.reduce((sum, r) => sum + (r.totalFacesInImage || 0), 0),
      facesWithEvents: results.filter(r => r.totalEvents > 0).length,
      facesWithoutEvents: results.filter(r => r.totalEvents === 0 && r.totalFacesInImage > 0).length,
      imagesWithNoFaces: results.filter(r => r.totalFacesInImage === 0).length,
      totalEventsFound: results.reduce((sum, r) => sum + r.totalEvents, 0)
    }
    
    console.log('✅ Event search completed in ' + duration + 's')
    console.log('   Processed:', probeImages.length, 'images')
    console.log('   Total faces detected:', stats.totalFacesDetected)
    console.log('   Faces with events:', stats.facesWithEvents)
    console.log('   Faces without events:', stats.facesWithoutEvents)
    console.log('   Images with no faces:', stats.imagesWithNoFaces)
    console.log('   Total events found:', stats.totalEventsFound)
    console.log('   Average rate:', (probeImages.length / parseFloat(duration)).toFixed(2), 'images/sec')
    
    return NextResponse.json({
      success: true,
      results: results,
      stats: stats,
      processingTime: duration
    })
  } catch (error) {
    console.error('❌ Event search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
