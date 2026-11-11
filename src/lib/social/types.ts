export type SocialPlatform =
  | "telegram"
  | "bluesky"
  | "mastodon"
  | "facebook"
  | "x";

export interface PostPayload {
  caption: string;
  imageUrl?: string;    // remote URL
  imageBuffer?: Buffer; // raw bytes (preferred — avoids platform re-fetch)
}

export interface PostResult {
  ok: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}

export interface PlatformConfig {
  id: SocialPlatform;
  name: string;
  hint: string;
  fields: { key: string; label: string; placeholder: string; secret: boolean }[];
  requiresApproval: boolean;
  freeForMedia: boolean;
  maxCaptionLength: number;
  imageAspectHint: string;
}