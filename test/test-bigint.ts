export interface Transaction {
  nonce: bigint;
  fee: bigint;
}

export function createTransaction(nonce: bigint, fee: bigint): Transaction {
  return { nonce, fee };
}