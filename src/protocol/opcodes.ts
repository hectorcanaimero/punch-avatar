export enum ClientOpcode {
  PUNCH_LEFT = 1,
  PUNCH_RIGHT = 2,
  BLOCK_START = 3,
  BLOCK_END = 4,
  SPECIAL = 5,
}

export enum ServerOpcode {
  TELEGRAPH = 101,
  STRIKE = 102,
  STATE_TICK = 103,
  KO = 104,
  FEINT = 105,
}
