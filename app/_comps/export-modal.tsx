"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (data: ExportData) => void
}

interface Watchlist {
  id: number
  name: string
}

interface ExportData {
  name: string
  watchlistId: string
  comment?: string
  lockerId?: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
}

export default function ExportModal({ isOpen, onClose, onExport }: ExportModalProps) {
  const [name, setName] = useState("")
  const [watchlist, setWatchlist] = useState("")
  const [comment, setComment] = useState("")
  const [lockerId, setLockerId] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (isOpen) {
      fetchWatchlists()
    }
  }, [isOpen])

  const fetchWatchlists = async () => {
    setLoading(true)
    setError("")
    
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_FRS_BASE_URL || 'http://127.0.0.1:8000'
      const TOKEN = process.env.NEXT_PUBLIC_FRS_TOKEN || ''
      
      const response = await fetch(`${BASE_URL}/permissions/watch-lists/`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `token ${TOKEN}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch watchlists: ${response.status}`)
      }

      const data = await response.json()
      // API returns data in a "results" array
      // Filter out "Unmatched" watchlist (ID: -1) as it cannot be used for cards
      const watchlistsData = (data.results || []).filter((wl: Watchlist) => wl.id !== -1)
      setWatchlists(watchlistsData)
      
      // Set first watchlist as default if available
      if (watchlistsData.length > 0 && !watchlist) {
        setWatchlist(watchlistsData[0].id.toString())
      }
    } catch (err) {
      console.error("Error fetching watchlists:", err)
      setError("Failed to load watchlists. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (name.trim() && watchlist) {
      onExport({
        name,
        watchlistId: watchlist,
        comment: comment.trim() || undefined,
        lockerId: lockerId.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined
      })
      // Reset form
      setName("")
      setComment("")
      setLockerId("")
      setFirstName("")
      setLastName("")
      setPhoneNumber("")
      setWatchlist("")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-white font-bold text-lg">Enroll</h2>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">
            Record name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter record name"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">
            Watch lists <span className="text-red-500">*</span>
          </label>
          {loading ? (
            <div className="bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-gray-400 text-sm">
              Loading watchlists...
            </div>
          ) : error ? (
            <div className="space-y-2">
              <div className="bg-red-900/20 border border-red-500 rounded-md px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
              <Button onClick={fetchWatchlists} variant="outline" size="sm" className="w-full">
                Retry
              </Button>
            </div>
          ) : watchlists.length > 0 ? (
            <Select value={watchlist} onValueChange={setWatchlist}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Select a watchlist" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {watchlists.map((wl) => (
                  <SelectItem key={wl.id} value={wl.id.toString()}>
                    {wl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-gray-400 text-sm">
              No watchlists available
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">Comment</label>
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter comment (optional)"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">Locker ID</label>
          <Input
            value={lockerId}
            onChange={(e) => setLockerId(e.target.value)}
            placeholder="Enter locker ID (optional)"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">First Name</label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter first name (optional)"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">Last Name</label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter last name (optional)"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">Phone Number</label>
          <Input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter phone number (optional)"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={onClose} variant="outline" className="flex-1 bg-transparent">
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            className="flex-1 bg-cyan-500 hover:bg-cyan-600"
            disabled={!name.trim() || !watchlist || loading}
          >
            Export
          </Button>
        </div>
      </div>
    </div>
  )
}
