// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";

import { ProvenanceRegistry } from "../src/ProvenanceRegistry.sol";
import { AttestationRegistry } from "../src/AttestationRegistry.sol";
import { SettlementEscrow } from "../src/SettlementEscrow.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

/// @title Deploy
/// @notice Deploys the four ProofChain contracts, grants AGENT_ROLE to AGENT_ADDRESS,
///         and writes deployed addresses to deployments/base-sepolia.json.
/// @dev Reads DEPLOYER_PRIVATE_KEY and AGENT_ADDRESS from env. Fails fast if missing.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address agent = vm.envAddress("AGENT_ADDRESS");
        require(agent != address(0), "AGENT_ADDRESS must be set");

        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Admin for all registries/escrow is the deployer.
        ProvenanceRegistry provenance = new ProvenanceRegistry(deployer);
        AttestationRegistry attestation = new AttestationRegistry(deployer, address(provenance));
        SettlementEscrow escrow = new SettlementEscrow(deployer, address(attestation), address(provenance));
        MockUSDC usdc = new MockUSDC();

        // Wire roles: the verification agent may attest.
        attestation.grantRole(attestation.AGENT_ROLE(), agent);

        vm.stopBroadcast();

        _writeDeployments(deployer, agent, address(provenance), address(attestation), address(escrow), address(usdc));

        console2.log("ProvenanceRegistry:", address(provenance));
        console2.log("AttestationRegistry:", address(attestation));
        console2.log("SettlementEscrow:", address(escrow));
        console2.log("MockUSDC:", address(usdc));
        console2.log("AGENT_ROLE granted to:", agent);
    }

    function _writeDeployments(
        address deployer,
        address agent,
        address provenance,
        address attestation,
        address escrow,
        address usdc
    ) internal {
        string memory obj = "deployments";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeAddress(obj, "agent", agent);
        vm.serializeAddress(obj, "ProvenanceRegistry", provenance);
        vm.serializeAddress(obj, "AttestationRegistry", attestation);
        vm.serializeAddress(obj, "SettlementEscrow", escrow);
        string memory json = vm.serializeAddress(obj, "MockUSDC", usdc);

        vm.writeJson(json, "./deployments/base-sepolia.json");
    }
}
