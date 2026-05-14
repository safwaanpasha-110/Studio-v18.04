import { NextRequest, NextResponse } from 'next/server'

const FRS_BASE_URL = process.env.NEXT_PUBLIC_FRS_BASE_URL || 'http://127.0.0.1:8000'
const FRS_TOKEN = `Token ${process.env.NEXT_PUBLIC_FRS_TOKEN || ''}`

export async function POST(request: NextRequest) {
  try {
    const { name, watchlistId, imageBase64, comment, lockerId, firstName, lastName, phoneNumber } = await request.json()

    console.log('📥 Received export request:', {
      name,
      watchlistId,
      hasImage: !!imageBase64
    })

    // Build card payload with optional fields
    const cardPayload: any = {
      name: name,
      watch_lists: [parseInt(watchlistId)],
      active: true
    }

    if (comment) cardPayload.comment = comment
    if (lockerId) cardPayload.locker_id = lockerId
    if (firstName) cardPayload.first_name = firstName
    if (lastName) cardPayload.last_name = lastName
    if (phoneNumber) cardPayload.phone_number = phoneNumber

    // Step 1: Create the card
    console.log('🔄 Creating card with payload:', cardPayload)
    
    const cardResponse = await fetch(`${FRS_BASE_URL}/cards/humans/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': FRS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cardPayload)
    })

    console.log('📊 Card response status:', cardResponse.status)
    const cardResponseText = await cardResponse.text()
    console.log('📄 Card response body:', cardResponseText)

    if (!cardResponse.ok) {
      console.error('❌ Card creation failed:', cardResponseText)
      return NextResponse.json(
        { error: 'Failed to create card', details: cardResponseText },
        { status: cardResponse.status }
      )
    }

    const cardData = JSON.parse(cardResponseText)
    const cardId = cardData.id
    console.log('✅ Card created with ID:', cardId)

    // Step 2: Convert base64 to blob and upload to /objects/faces/
    console.log('🔄 Uploading face photo...')
    const base64Data = imageBase64.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    
    const formData = new FormData()
    const blob = new Blob([buffer], { type: 'image/jpeg' })
    formData.append('source_photo', blob, 'enhanced-image.jpg')
    formData.append('card', cardId.toString())

    const uploadResponse = await fetch(`${FRS_BASE_URL}/objects/faces/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': FRS_TOKEN,
      },
      body: formData
    })

    console.log('📊 Face upload status:', uploadResponse.status)
    const uploadResponseText = await uploadResponse.text()
    console.log('📄 Face response body:', uploadResponseText)

    if (!uploadResponse.ok) {
      console.error('❌ Image upload failed:', uploadResponseText)
      return NextResponse.json(
        { error: 'Failed to upload image', details: uploadResponseText, cardId },
        { status: uploadResponse.status }
      )
    }

    const uploadData = JSON.parse(uploadResponseText)
    console.log('✅ Export completed successfully!')

    return NextResponse.json({
      success: true,
      cardId,
      uploadResult: uploadData,
      message: `Successfully created card "${name}" in watchlist`
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
