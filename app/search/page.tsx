"use client"

import Navbar from "@/app/_comps/navbar"
import SearchInterface from "@/app/_comps/search-interface"

export default function SearchPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-white">Facial Recognition Search</h1>
            <p className="text-gray-400">Upload an image to search for matching faces in the database</p>
          </div>

          <SearchInterface />
        </div>
      </main>
    </>
  )
}
