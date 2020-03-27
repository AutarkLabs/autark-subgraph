import { 
  json,
  ipfs,
  log,
  store,
  Value,
  BigInt,
  JSONValue,
  Bytes,
  Address,
  TypedMap
} from "@graphprotocol/graph-ts"

import { VaultDeposit, VaultTransfer } from "../generated/templates/Vault/Vault"

export function handleVaultDeposit(event: VaultDeposit): void {}

export function handleVaultTransfer(event: VaultTransfer): void {}
