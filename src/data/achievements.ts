export const ACHIEVEMENT_IDS = [
  "first_blood",
  "cara_de_piedra",
  "remontada",
  "campeon",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "first_blood",
    name: "Primera Sangre",
    description: "Conseguí tu primer K.O.",
  },
  {
    id: "cara_de_piedra",
    name: "Cara de Piedra",
    description: "Ganá un combate sin recibir golpes.",
  },
  {
    id: "remontada",
    name: "Remontada",
    description: "Ganá un combate con menos de 10 HP.",
  },
  {
    id: "campeon",
    name: "Campeón",
    description: "Vencé al rival 10 del modo Carrera.",
  },
];
