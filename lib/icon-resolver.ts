import { icons, IconKey } from "@/constants/icons";

const KEYWORD_MAP: Record<string, IconKey> = {
    spotify: "spotify",
    notion: "notion",
    figma: "figma",
    github: "github",
    claude: "claude",
    canva: "canva",
    adobe: "adobe",
    dropbox: "dropbox",
    openai: "openai",
    chatgpt: "openai",
    medium: "medium",
};

export function resolveIconKey(name: string, explicit?: string | null): IconKey | null {
    if (explicit && explicit in icons) return explicit as IconKey;

    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;

    const match = Object.keys(KEYWORD_MAP).find((keyword) => normalized.includes(keyword));
    return match ? KEYWORD_MAP[match] : null;
}

/** First character by code point, so an emoji or non-BMP glyph isn't cut in half. */
function firstGlyph(word: string): string {
    return Array.from(word)[0] ?? "";
}

export function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";

    // `slice(0, 2)` would split a surrogate pair and render a replacement box for
    // names like "🎬" or scripts outside the basic plane.
    if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();

    return (firstGlyph(words[0]) + firstGlyph(words[1])).toUpperCase();
}

const AVATAR_PALETTE = ["#f5c542", "#e8def8", "#b8d4e3", "#b8e8d0", "#ff6b6b", "#95e1d3", "#8fd1bd", "#d4c4f5"];

export function getAvatarColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
