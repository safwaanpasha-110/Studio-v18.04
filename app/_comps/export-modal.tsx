"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
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
}

export default function ExportModal({ isOpen, onClose, onExport }: ExportModalProps) {
  const [name, setName] = useState("")
  const [watchlist, setWatchlist] = useState("")
  const [comment, setComment] = useState("")
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
      const response = await fetch('/api/frs/watchlists', {
        method: "GET",
        headers: {
          "Accept": "application/json",
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch watchlists: ${response.status}`)
      }

      const data = await response.json()
      const watchlistsData = (data.results || []).filter((wl: Watchlist) => wl.id !== -1)
      setWatchlists(watchlistsData)

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
      })
      setName("")
      setComment("")
      setWatchlist("")
    }
  }

  if (!isOpen || typeof window === "undefined") return null

  console.log("[ExportModal] rendering, isOpen=", isOpen)

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
    >
      <div
        style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          maxWidth: "28rem",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        className="space-y-4"
      >
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

        <div className="flex gap-3 pt-4">
          <Button onClick={onClose} variant="outline" className="flex-1 bg-transparent">
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            className="flex-1 bg-cyan-500 hover:bg-cyan-600"
            disabled={!name.trim() || !watchlist || loading}
          >
            Enroll
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
