// WHY: valores de balance en config para tunear la curva sin tocar lógica.
// Spec 06 marca como riesgo "curva de XP muy dura o muy suave".
export const XP_BALANCE = {
  victory: 50,
  defeat: 10,
  cleanKoBonus: 20,
  firstCareerWinBonus: 100,
  levelCurveBase: 100,
  levelCurveExponent: 1.5,
} as const;
