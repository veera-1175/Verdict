import { useEffect, useRef, useState } from "react";
import { apiGet, type GitHubUserResult } from "../lib/api";

interface Props {
  value: string;
  onChange: (username: string) => void;
  onSelect: (user: GitHubUserResult) => void;
  disabled?: boolean;
}

export function GitHubUserSearch({ value, onChange, onSelect, disabled }: Props) {
  const [results, setResults] = useState<GitHubUserResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (disabled || value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      apiGet<GitHubUserResult[]>(`/api/admin/github/users?q=${encodeURIComponent(value.trim())}`)
        .then((users) => {
          setResults(users);
          setOpen(users.length > 0);
        })
        .catch(() => {
          setResults([]);
          setOpen(false);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value, disabled]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(user: GitHubUserResult) {
    skipSearchRef.current = true;
    onChange(user.login);
    onSelect(user);
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label className="mono-label mb-2 block">GitHub username</label>
      <input
        className="input-ink"
        placeholder="Start typing a GitHub username…"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && <p className="mt-1 text-[10px] text-ink-500">Searching GitHub…</p>}
      <p className="mt-1 text-[10px] text-ink-500">Click a result to autofill name and email.</p>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto border border-ink-700 bg-black shadow-xl">
          {results.map((user) => (
            <button
              key={user.login}
              type="button"
              disabled={user.has_login}
              onClick={() => pick(user)}
              className="flex w-full items-center gap-3 border-b border-ink-900 px-3 py-3 text-left hover:bg-ink-900 disabled:opacity-50"
            >
              <img src={user.avatar_url} alt="" className="h-9 w-9 border border-ink-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{user.name ?? user.login}</p>
                <p className="font-mono text-xs text-ink-400">@{user.login}</p>
                {user.email && <p className="truncate text-[10px] text-ink-500">{user.email}</p>}
              </div>
              {user.has_login ? (
                <span className="tag text-[9px]">Has login</span>
              ) : (
                <span className="text-[10px] text-ink-500">Select →</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
