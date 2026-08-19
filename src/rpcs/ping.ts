export const pingRpc: nkruntime.RpcFunction = (
  _ctx,
  _logger,
  _nk,
  _payload
): string => JSON.stringify({ pong: true });
