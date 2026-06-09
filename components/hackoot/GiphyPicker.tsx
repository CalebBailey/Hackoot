"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";

interface GifResult {
  id: string;
  title: string;
  images: {
    fixed_height_small: { url: string };
    fixed_height: { url: string };
  };
}

interface GiphyPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

// Module-level cache: avoids re-fetching the same query within a session.
// The selected GIF URL is stored in the quiz JSON and loaded directly from
// Giphy's CDN by all players - it never counts against the API rate limit.
const searchCache = new Map<string, GifResult[]>();

export function GiphyPicker({ onSelect, onClose }: GiphyPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }

    if (searchCache.has(trimmed)) {
      setResults(searchCache.get(trimmed)!);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/giphy/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setError("Failed to load GIFs. Please try again.");
        setResults([]);
        return;
      }
      const data = await res.json();
      const gifs: GifResult[] = data.data ?? [];
      searchCache.set(trimmed, gifs);
      setResults(gifs);
    } catch {
      setError("Failed to load GIFs. Please check your connection.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 500);
  };

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-[#1a1025]/95 backdrop-blur-sm shadow-2xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search Giphy..."
            maxLength={50}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]/50 focus:border-[var(--color-action)] transition-all"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-[var(--text-secondary)]"
          aria-label="Close Giphy search"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading && (
        <p className="text-center text-sm text-[var(--text-secondary)] py-4">Searching...</p>
      )}

      {error && (
        <p className="text-center text-sm text-rose-400 py-4">{error}</p>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto">
          {results.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => onSelect(gif.images.fixed_height.url)}
              className="rounded-lg overflow-hidden border border-white/10 hover:border-[var(--color-action)] transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-action)]"
              aria-label={gif.title || "Select GIF"}
            >
              <img
                src={gif.images.fixed_height_small.url}
                alt={gif.title || "GIF"}
                className="w-full h-16 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {!loading && !error && query.trim() && results.length === 0 && (
        <p className="text-center text-sm text-[var(--text-secondary)] py-4">
          No GIFs found for &ldquo;{query}&rdquo;
        </p>
      )}

      {!query.trim() && (
        <p className="text-center text-sm text-[var(--text-secondary)]/60 py-2">
          Type to search for GIFs
        </p>
      )}

      <p className="text-center text-xs text-[var(--text-secondary)]/40">
        Powered by GIPHY
      </p>
    </div>
  );
}
