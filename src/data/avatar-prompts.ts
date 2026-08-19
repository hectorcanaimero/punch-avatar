export type AvatarStyle =
  | "pixar_3d"
  | "anime_shonen"
  | "comic_retro"
  | "chibi"
  | "pixel_16bit";

export interface AvatarPromptTemplate {
  style: AvatarStyle;
  label: string;
  positive: string;
  negative: string;
  identityWeight: number;
  styleWeight: number;
}

const NEGATIVE_PROMPT =
  "realistic photo, blurry, extra limbs, deformed hands, extra fingers, text, watermark, low quality, distorted face";

const buildPositive = (styleLabel: string): string =>
  `a cartoon boxer character, ${styleLabel} style, wearing brightly colored boxing gloves and boxing shorts, exaggerated muscular cartoon body, standing in a fighting stance, boxing ring background, vibrant colors, comic book illustration, funny exaggerated expression, same facial identity as reference photo, high detail face, digital illustration`;

export const AVATAR_PROMPTS: Record<AvatarStyle, AvatarPromptTemplate> = {
  pixar_3d: {
    style: "pixar_3d",
    label: "Pixar 3D",
    positive: buildPositive("Pixar 3D"),
    negative: NEGATIVE_PROMPT,
    identityWeight: 0.8,
    styleWeight: 0.6,
  },
  anime_shonen: {
    style: "anime_shonen",
    label: "anime shonen",
    positive: buildPositive("anime shonen"),
    negative: NEGATIVE_PROMPT,
    identityWeight: 0.8,
    styleWeight: 0.65,
  },
  comic_retro: {
    style: "comic_retro",
    label: "comic americano retro",
    positive: buildPositive("comic americano retro"),
    negative: NEGATIVE_PROMPT,
    identityWeight: 0.78,
    styleWeight: 0.6,
  },
  chibi: {
    style: "chibi",
    label: "chibi / super deformado",
    positive: buildPositive("chibi / super deformado"),
    negative: NEGATIVE_PROMPT,
    identityWeight: 0.75,
    styleWeight: 0.7,
  },
  pixel_16bit: {
    style: "pixel_16bit",
    label: "pixel art 16-bit",
    positive: buildPositive("pixel art 16-bit"),
    negative: NEGATIVE_PROMPT,
    identityWeight: 0.7,
    styleWeight: 0.7,
  },
};

export const AVATAR_STYLES: AvatarStyle[] = Object.keys(
  AVATAR_PROMPTS
) as AvatarStyle[];

export function getAvatarPrompt(style: string): AvatarPromptTemplate {
  const template = AVATAR_PROMPTS[style as AvatarStyle];
  if (!template) {
    throw new Error(`Unknown avatar style: ${style}`);
  }
  return template;
}
