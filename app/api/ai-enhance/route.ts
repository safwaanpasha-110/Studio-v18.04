import { NextRequest, NextResponse } from 'next/server'

// DeepAI API key for image enhancement
const DEEPAI_API_KEY = process.env.NEXT_PUBLIC_DEEPAI_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Use DeepAI torch-srgan for AI image enhancement
    console.log('🤖 Calling DeepAI torch-srgan API for image enhancement...')
    
    try {
      const formData = new FormData()
      const blob = new Blob([buffer], { type: 'image/jpeg' })
      formData.append('image', blob, 'image.jpg')

      const response = await fetch('https://api.deepai.org/api/torch-srgan', {
        method: 'POST',
        headers: {
          'api-key': DEEPAI_API_KEY,
        },
        body: formData
      })

      console.log('DeepAI response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('DeepAI result:', result)
        
        if (result.output_url) {
          console.log('✅ DeepAI enhancement successful, fetching enhanced image...')
          
          // Fetch the enhanced image from DeepAI's URL
          const imageResponse = await fetch(result.output_url)
          const imageBuffer = await imageResponse.arrayBuffer()
          const enhancedBase64 = `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}`
          
          console.log('✅ Enhanced image fetched successfully')
          return NextResponse.json({ 
            enhancedImage: enhancedBase64,
            message: 'Image enhanced using DeepAI torch-srgan'
          })
        }
      } else {
        const errorText = await response.text()
        console.error('DeepAI API error response:', errorText)
      }
    } catch (error) {
      console.error('DeepAI API error:', error)
    }

    // Fallback: Return original image if API fails
    console.log('⚠️ DeepAI API failed, returning original image')
    return NextResponse.json({ 
      enhancedImage: image,
      message: 'AI enhancement unavailable, returning original image'
    })

  } catch (error) {
    console.error('AI enhance error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enhancement failed' },
      { status: 500 }
    )
  }
}
