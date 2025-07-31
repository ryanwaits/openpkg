import {
  clientFromNetwork,
  type NetworkClientParam,
  networkFrom,
} from "@stacks/network";
import {
  bytesToHex,
  deriveNetworkFromTx,
  type StacksTransactionWire,
  type TxBroadcastResult,
  type TxBroadcastResultOk,
  type TxBroadcastResultRejected,
} from "@stacks/transactions";

export const BROADCAST_PATH = "/v2/transactions";
export const TRANSFER_FEE_ESTIMATE_PATH = "/v2/fees/transfer";
export const TRANSACTION_FEE_ESTIMATE_PATH = "/v2/fees/transaction";
export const ACCOUNT_PATH = "/v2/accounts";
export const CONTRACT_ABI_PATH = "/v2/contracts/interface";
export const READONLY_FUNCTION_CALL_PATH = "/v2/contracts/call-read";
export const MAP_ENTRY_PATH = "/v2/map_entry";

/**
 * Broadcast a serialized transaction to a Stacks node (which will validate and forward to the network).
 * @param opts.transaction - The transaction to broadcast
 * @param opts.attachment - Optional attachment encoded as a hex string
 * @param opts.api - Optional API info (`.url` & `.fetch`) used for fetch call
 * @returns A Promise that resolves to a {@link TxBroadcastResult} object
 */
export async function broadcastTransaction({
  transaction: txOpt,
  attachment: attachOpt,
  network: _network,
  client: _client,
}: {
  /** The transaction to broadcast */
  transaction: StacksTransactionWire;
  /** Optional attachment in bytes or encoded as a hex string */
  attachment?: Uint8Array | string;
} & NetworkClientParam): Promise<TxBroadcastResult> {
  const tx = txOpt.serialize();
  const attachment = attachOpt
    ? typeof attachOpt === "string"
      ? attachOpt
      : bytesToHex(attachOpt)
    : undefined;
  const json = attachOpt ? { tx, attachment } : { tx };
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  };

  const network = _network ?? deriveNetworkFromTx(txOpt);
  const client = Object.assign(
    {},
    clientFromNetwork(networkFrom(network)),
    _client,
  );
  const url = `${client.baseUrl}${BROADCAST_PATH}`;
  const response = await client.fetch(url, options);

  if (!response.ok) {
    try {
      return (await response.json()) as TxBroadcastResultRejected;
    } catch (e) {
      throw Error(
        "Failed to broadcast transaction (unable to parse node response).",
        { cause: e },
      );
    }
  }

  const text = await response.text();
  const txid = text.replace(/["]+/g, ""); // Replace extra quotes around txid string

  return { txid } as TxBroadcastResultOk;
}
