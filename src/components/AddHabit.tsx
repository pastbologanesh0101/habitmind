"use client";

import { useState } from "react";

const EMOJIS = ["✅", "🏋️", "📚", "🧘", "💧", "🏃", "📵", "✍️", "🥗", "😴", "💻", "🎸"];

export function AddHabit({ onAdd }: { onAdd: (name: string, emoji: string) => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onAdd(trimmed.slice(0, 60), emoji);
        setName("");
      }}
      className="flex gap-2"
    >
      <select
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        aria-label="Habit icon"
        className="rounded-lg border border-line bg-surface px-2 text-lg"
      >
        {EMOJIS.map((e) => (
          <option key={e}>{e}</option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New habit, e.g. Walk 8k steps"
        maxLength={60}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button className="rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-50" disabled={!name.trim()}>
        Add
      </button>
    </form>
  );
}
