"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <nav className="bg-slate-900 text-white shadow-lg border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="w-8" />

        <div className="flex gap-6 items-center">
          <Link
            href="/"
            className={`transition ${isActive("/") ? "text-cyan-400 border-b-2 border-cyan-400" : "hover:text-cyan-300"}`}
          >
            Home
          </Link>
          <Link
            href="/editor"
            className={`transition ${isActive("/editor") ? "text-cyan-400 border-b-2 border-cyan-400" : "hover:text-cyan-300"}`}
          >
            Editor
          </Link>
        </div>
      </div>
    </nav>
  )
}
