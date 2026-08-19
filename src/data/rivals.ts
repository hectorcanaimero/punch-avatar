export interface Rival {
  name: string;
  portraitUrl: string;
  health: number;
  damage: number;
  telegraphMs: number;
  feintProbability: number;
  comboProbability: number;
  usesSpecial: boolean;
}

export const RIVALS: readonly Rival[] = [
  {
    name: "Tito Cucharón",
    portraitUrl: "/assets/rivals/tito-cucharon.webp",
    health: 80,
    damage: 5,
    telegraphMs: 800,
    feintProbability: 0,
    comboProbability: 0,
    usesSpecial: false,
  },
  {
    name: "El Bigotes",
    portraitUrl: "/assets/rivals/el-bigotes.webp",
    health: 80,
    damage: 5,
    telegraphMs: 700,
    feintProbability: 0,
    comboProbability: 0,
    usesSpecial: false,
  },
  {
    name: "Doña Fierro",
    portraitUrl: "/assets/rivals/dona-fierro.webp",
    health: 100,
    damage: 7,
    telegraphMs: 650,
    feintProbability: 0.1,
    comboProbability: 0.15,
    usesSpecial: false,
  },
  {
    name: "Máquina de Tamales",
    portraitUrl: "/assets/rivals/maquina-de-tamales.webp",
    health: 100,
    damage: 7,
    telegraphMs: 575,
    feintProbability: 0.1,
    comboProbability: 0.15,
    usesSpecial: false,
  },
  {
    name: "Pancho Cachetada",
    portraitUrl: "/assets/rivals/pancho-cachetada.webp",
    health: 100,
    damage: 7,
    telegraphMs: 500,
    feintProbability: 0.1,
    comboProbability: 0.15,
    usesSpecial: false,
  },
  {
    name: "La Chancla Veloz",
    portraitUrl: "/assets/rivals/la-chancla-veloz.webp",
    health: 120,
    damage: 9,
    telegraphMs: 450,
    feintProbability: 0.2,
    comboProbability: 0.3,
    usesSpecial: true,
  },
  {
    name: "Pepe Picadillo",
    portraitUrl: "/assets/rivals/pepe-picadillo.webp",
    health: 120,
    damage: 9,
    telegraphMs: 400,
    feintProbability: 0.2,
    comboProbability: 0.3,
    usesSpecial: true,
  },
  {
    name: "El Tuercas",
    portraitUrl: "/assets/rivals/el-tuercas.webp",
    health: 120,
    damage: 9,
    telegraphMs: 350,
    feintProbability: 0.2,
    comboProbability: 0.3,
    usesSpecial: true,
  },
  {
    name: "Doctor Sopapo",
    portraitUrl: "/assets/rivals/doctor-sopapo.webp",
    health: 150,
    damage: 12,
    telegraphMs: 300,
    feintProbability: 0.25,
    comboProbability: 0.4,
    usesSpecial: true,
  },
  {
    name: "Campeón Don Trompazo",
    portraitUrl: "/assets/rivals/campeon-don-trompazo.webp",
    health: 150,
    damage: 12,
    telegraphMs: 300,
    feintProbability: 0.25,
    comboProbability: 0.4,
    usesSpecial: true,
  },
];
