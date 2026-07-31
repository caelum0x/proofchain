/**
 * @proofchain/shared — the typed contract layer for ProofChain.
 *
 * Exposes: on-chain struct mirrors + agent verdict types, the Base Sepolia viem
 * chain config, contract ABIs, a chain-keyed address map, event-decoder helpers,
 * and structured error/result envelopes. No secrets live here.
 */

// ABIs and contract identity
export {
  ABIS,
  CONTRACT_NAMES,
  attestationRegistryAbi,
  isContractName,
  mockUsdcAbi,
  provenanceRegistryAbi,
  settlementEscrowAbi,
  type ContractName,
} from "./abis/index";

// Chain config
export {
  CHAIN_ID,
  DEFAULT_BASE_SEPOLIA_RPC,
  RPC_URL_ENV,
  baseSepolia,
  createBaseSepoliaChain,
  isSupportedChainId,
  readEnv,
  type ChainId,
} from "./chains";

// Addresses
export {
  CONTRACTS,
  DEFAULT_DEPLOYMENTS_PATH,
  DEPLOYMENTS_PATH_ENV,
  addressesFromManifest,
  getContractAddress,
  parseAddress,
  readDeploymentManifest,
  resolveContractAddresses,
  tryGetContractAddress,
  type ContractAddresses,
} from "./addresses";

// Event decoders
export {
  decodeContractEvent,
  decodeProofchainLog,
  parseContractLogs,
  parseRawEventLog,
  tryDecodeProofchainLog,
  type DecodedProofchainEvent,
  type RawEventLog,
} from "./decoders";

// Types + schemas
export {
  AddressSchema,
  Bytes32Schema,
  DEAL_STATE_LABELS,
  DealState,
  FINDING_SEVERITIES,
  FindingSchema,
  HexSchema,
  ScoreBpsSchema,
  VerificationVerdictSchema,
  type Address,
  type Attestation,
  type Batch,
  type Bytes32,
  type Checkpoint,
  type Deal,
  type Finding,
  type FindingSeverity,
  type Hex,
  type VerificationVerdict,
} from "./types";

// Errors + result envelopes
export {
  DecodeError,
  DeploymentParseError,
  ErrorCode,
  InvalidAddressError,
  MissingAddressError,
  ProofchainError,
  ValidationError,
  fail,
  ok,
  toErrorEnvelope,
  type ErrorEnvelope,
  type Result,
} from "./errors";
