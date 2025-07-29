/**
 * Example based on stacks.js fetch.ts to test real-world type resolution
 * @module stacks-like-example
 */

// Network and client types
export interface StacksNetwork {
  chainId: number;
  url: string;
}

export interface StacksClient {
  baseUrl: string;
  fetch: typeof fetch;
}

export type NetworkClientParam = {
  network?: StacksNetwork;
  client?: StacksClient;
};

// Transaction types
export interface StacksTransactionWire {
  version: number;
  chainId: number;
  auth: TransactionAuth;
  payload: TransactionPayload;
  postConditions: PostCondition[];
}

export interface TransactionAuth {
  type: 'standard' | 'sponsored';
  originCondition: SpendingCondition;
  sponsorCondition?: SpendingCondition;
}

export interface SpendingCondition {
  hashMode: number;
  signer: string;
  nonce: bigint;
  fee: bigint;
  keyEncoding: 'compressed' | 'uncompressed';
  signature: string;
}

export interface PostCondition {
  type: 'stx' | 'ft' | 'nft';
  principal: string;
  conditionCode: number;
  amount?: bigint;
  assetInfo?: AssetInfo;
}

export interface AssetInfo {
  contractAddress: string;
  contractName: string;
  assetName: string;
}

export type TransactionPayload = 
  | TokenTransferPayload
  | ContractCallPayload
  | SmartContractPayload
  | VersionedSmartContractPayload;

export interface TokenTransferPayload {
  type: 'tokenTransfer';
  recipient: string;
  amount: bigint;
  memo?: string;
}

export interface ContractCallPayload {
  type: 'contractCall';
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
}

export interface SmartContractPayload {
  type: 'smartContract';
  contractName: string;
  codeBody: string;
}

export interface VersionedSmartContractPayload {
  type: 'versionedSmartContract';
  contractName: string;
  codeBody: string;
  clarityVersion: 1 | 2 | 3;
}

// Clarity value types
export type ClarityValue = 
  | ClarityInt
  | ClarityUInt
  | ClarityBool
  | ClarityBuffer
  | ClarityOptional
  | ClarityResponse
  | ClarityPrincipal
  | ClarityList
  | ClarityTuple
  | ClarityStringAscii
  | ClarityStringUtf8;

export interface ClarityInt {
  type: 'int';
  value: bigint;
}

export interface ClarityUInt {
  type: 'uint';
  value: bigint;
}

export interface ClarityBool {
  type: 'bool';
  value: boolean;
}

export interface ClarityBuffer {
  type: 'buffer';
  buffer: Uint8Array;
}

export interface ClarityOptional {
  type: 'optional';
  value: ClarityValue | null;
}

export interface ClarityResponse {
  type: 'response';
  value: { ok: ClarityValue } | { err: ClarityValue };
}

export interface ClarityPrincipal {
  type: 'principal';
  address: string;
}

export interface ClarityList {
  type: 'list';
  list: ClarityValue[];
}

export interface ClarityTuple {
  type: 'tuple';
  data: Record<string, ClarityValue>;
}

export interface ClarityStringAscii {
  type: 'stringAscii';
  data: string;
}

export interface ClarityStringUtf8 {
  type: 'stringUtf8';
  data: string;
}

// Result types
export type TxBroadcastResult = TxBroadcastResultOk | TxBroadcastResultRejected;

export interface TxBroadcastResultOk {
  ok: true;
  txid: string;
}

export interface TxBroadcastResultRejected {
  ok: false;
  error: string;
  reason: TxRejectedReason;
  reason_data?: unknown;
}

export enum TxRejectedReason {
  Serialization = 'Serialization',
  Deserialization = 'Deserialization',
  SignatureValidation = 'SignatureValidation',
  BadNonce = 'BadNonce',
  FeeTooLow = 'FeeTooLow',
  NotEnoughFunds = 'NotEnoughFunds',
  NoSuchContract = 'NoSuchContract',
  NoSuchPublicFunction = 'NoSuchPublicFunction',
  BadFunctionArgument = 'BadFunctionArgument',
  ContractAlreadyExists = 'ContractAlreadyExists',
  PoisonMicroblocksDoNotConflict = 'PoisonMicroblocksDoNotConflict',
  PoisonMicroblockHasUnknownPubKeyHash = 'PoisonMicroblockHasUnknownPubKeyHash',
  PoisonMicroblockIsInvalid = 'PoisonMicroblockIsInvalid',
  BadAddressVersionByte = 'BadAddressVersionByte',
  NoCoinbaseViaMempool = 'NoCoinbaseViaMempool',
  NoTenureChangeViaMempool = 'NoTenureChangeViaMempool',
  ServerFailureNoSuchChainTip = 'ServerFailureNoSuchChainTip',
  ServerFailureDatabase = 'ServerFailureDatabase',
  ServerFailureOther = 'ServerFailureOther',
  EstimatorError = 'EstimatorError',
  ReplaceByFeeNotEnough = 'ReplaceByFeeNotEnough',
  ReplacedByRBF = 'ReplacedByRBF',
  TooMuchChaining = 'TooMuchChaining',
  ConflictingNonceInMempool = 'ConflictingNonceInMempool',
}

// Helper type for broadcast parameters
export type BroadcastTransactionOptions = {
  transaction: StacksTransactionWire;
  attachment?: Uint8Array | string;
} & NetworkClientParam;

/**
 * Broadcast a transaction to the Stacks blockchain
 * @param options - The transaction broadcast options
 * @returns Promise that resolves to the broadcast result
 * @throws Error if the transaction serialization fails
 */
export async function broadcastTransaction(
  options: BroadcastTransactionOptions
): Promise<TxBroadcastResult> {
  const { transaction: txOpt, attachment: attachOpt, network: _network, client: _client } = options;
  
  // Use default network/client if not provided
  const network = _network ?? getDefaultNetwork();
  const client = _client ?? getDefaultClient(network);
  
  // Serialize transaction
  const serialized = serializeTransaction(txOpt);
  
  // Prepare request body
  const body = {
    tx: Buffer.from(serialized).toString('hex'),
    attachment: attachOpt ? normalizeAttachment(attachOpt) : undefined,
  };
  
  // Make API request
  const response = await client.fetch(`${client.baseUrl}/v2/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const result = await response.json() as any;
  
  if (response.ok) {
    return {
      ok: true,
      txid: result.txid,
    };
  } else {
    return {
      ok: false,
      error: result.error,
      reason: result.reason as TxRejectedReason,
      reason_data: result.reason_data,
    };
  }
}

// Helper functions (simplified implementations)
function getDefaultNetwork(): StacksNetwork {
  return {
    chainId: 1,
    url: 'https://api.mainnet.hiro.so',
  };
}

function getDefaultClient(network: StacksNetwork): StacksClient {
  return {
    baseUrl: network.url,
    fetch: globalThis.fetch,
  };
}

function serializeTransaction(tx: StacksTransactionWire): Uint8Array {
  // Simplified - actual implementation would serialize all fields
  return new Uint8Array([1, 2, 3, 4]);
}

function normalizeAttachment(attachment: Uint8Array | string): string {
  if (typeof attachment === 'string') {
    return attachment;
  }
  return Buffer.from(attachment).toString('hex');
}

// Export utility types for testing generic resolution
export type PartialTransaction = Partial<StacksTransactionWire>;
export type RequiredAuth = Required<Pick<TransactionAuth, 'type' | 'originCondition'>>;
export type TransactionWithoutPostConditions = Omit<StacksTransactionWire, 'postConditions'>;
export type ReadonlyTransaction = Readonly<StacksTransactionWire>;

// Generic helper type
export interface Result<T, E = Error> {
  ok: boolean;
  value?: T;
  error?: E;
}

// Test async function with complex return type
export async function fetchAndBroadcastTransaction<T extends StacksTransactionWire>(
  tx: T,
  options?: Partial<NetworkClientParam>
): Promise<Result<TxBroadcastResultOk, TxBroadcastResultRejected>> {
  try {
    const result = await broadcastTransaction({
      transaction: tx,
      ...options,
    });
    
    if (result.ok) {
      return {
        ok: true,
        value: result,
      };
    } else {
      return {
        ok: false,
        error: result,
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reason: TxRejectedReason.ServerFailureOther,
      },
    };
  }
}