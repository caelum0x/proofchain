# ProofChain — Live Deployment

**Network:** Ethereum Sepolia (chainId `11155111`) · **Contracts deployed:** 117

Deployer `0x0e9b9e1B9aD338F859022A5d2D2eb8eea7E15bF8` · Agent signer `0xeBcc3857C046872F25ff39c08A6FB02E52944793`

## Live end-to-end proof (clean shipment → autonomous settlement)

Actors: supplier `0x0f0441aB85252EB60bd73543b7051a204aa7C111`, buyer `0x35a5587D6e6a431E476D1a29C3bA47dBBB82b205`.

Result: attestation score **9600**, deal state **Released**, supplier paid **1000 USDC** — verified on-chain.

| Step | Tx |
|------|----|
| grant REGISTRAR_ROLE | [0xd1a997adf2db…](https://sepolia.etherscan.io/tx/0xd1a997adf2dbdc4136807fd47aa58400c5a2585d0bcec161f5089c746f96d3df) |
| registerBatch | [0x09bcfae11327…](https://sepolia.etherscan.io/tx/0x09bcfae11327877b291d0708c13780016ba862ff014ef32e766f3e5224f3b831) |
| addCheckpoint | [0x1d8e6d0e5316…](https://sepolia.etherscan.io/tx/0x1d8e6d0e5316f203765cae09b980fe0ce1c0451891c0da5d3151190f8e4e9238) |
| attest (score 9600) | [0xbd2ba84f57af…](https://sepolia.etherscan.io/tx/0xbd2ba84f57afe7047492a9776cdece776fd4856537cb6b28261876662643953d) |
| fund escrow (1000 USDC) | [0x2aa9c3ae15b5…](https://sepolia.etherscan.io/tx/0x2aa9c3ae15b512d3df326e403635b1901b7f7cd02688d3fbeb387dcfe432d3c8) |

## Core contracts

| Contract | Address |
|----------|---------|
| **AddressBook** | [`0xcfb6cb0f72b14decde521d456199cdb67c15ddd6`](https://sepolia.etherscan.io/address/0xcfb6cb0f72b14decde521d456199cdb67c15ddd6) |
| **ProvenanceRegistry** | [`0xbf0a3b62db1605fb018a4bdffc8e39377e16b0df`](https://sepolia.etherscan.io/address/0xbf0a3b62db1605fb018a4bdffc8e39377e16b0df) |
| **AttestationRegistry** | [`0x074aee1a91607e787bbb2e7a38136af0d6bb79ad`](https://sepolia.etherscan.io/address/0x074aee1a91607e787bbb2e7a38136af0d6bb79ad) |
| **SettlementEscrow** | [`0xa83e133d60bb38e18668682d83b4268c8251f28e`](https://sepolia.etherscan.io/address/0xa83e133d60bb38e18668682d83b4268c8251f28e) |
| **MockUSDC** | [`0xdc0302f14781754e302d9d9669d7aac8d26cc210`](https://sepolia.etherscan.io/address/0xdc0302f14781754e302d9d9669d7aac8d26cc210) |

## All deployed contracts (117)

| Contract | Address |
|----------|---------|
| AMLRegistry | [`0xdb0930e777f0947725c510c1019bf3c0defd6d31`](https://sepolia.etherscan.io/address/0xdb0930e777f0947725c510c1019bf3c0defd6d31) |
| AddressBook | [`0xcfb6cb0f72b14decde521d456199cdb67c15ddd6`](https://sepolia.etherscan.io/address/0xcfb6cb0f72b14decde521d456199cdb67c15ddd6) |
| ArbiterStaking | [`0xb171c673c82044b0ad85fa9577dfa22d5a482df3`](https://sepolia.etherscan.io/address/0xb171c673c82044b0ad85fa9577dfa22d5a482df3) |
| AttestationRegistry | [`0x074aee1a91607e787bbb2e7a38136af0d6bb79ad`](https://sepolia.etherscan.io/address/0x074aee1a91607e787bbb2e7a38136af0d6bb79ad) |
| AuctionHouse | [`0x32e8329d39b71281eb621e47a85b6ace52e3145a`](https://sepolia.etherscan.io/address/0x32e8329d39b71281eb621e47a85b6ace52e3145a) |
| BatchMetadataStore | [`0xc1771d6d2c722a5de79cac3a808540404251b632`](https://sepolia.etherscan.io/address/0xc1771d6d2c722a5de79cac3a808540404251b632) |
| BatchNFT | [`0x3da47c22f87576fac23cb3923e0c2c2ee49e0893`](https://sepolia.etherscan.io/address/0x3da47c22f87576fac23cb3923e0c2c2ee49e0893) |
| BidManager | [`0xfd8c77fb5d911d34950735b48ed9add3e11c5925`](https://sepolia.etherscan.io/address/0xfd8c77fb5d911d34950735b48ed9add3e11c5925) |
| BillOfExchange | [`0x93dd3bb52092d91a369e33e76a6c1d5893169726`](https://sepolia.etherscan.io/address/0x93dd3bb52092d91a369e33e76a6c1d5893169726) |
| BiodiversityCredit | [`0x6c55655539019f4e9979815587db18f44da31cc3`](https://sepolia.etherscan.io/address/0x6c55655539019f4e9979815587db18f44da31cc3) |
| BondedWarehouse | [`0xafac891b9306f9f95b44a161b273fcb00918f6fd`](https://sepolia.etherscan.io/address/0xafac891b9306f9f95b44a161b273fcb00918f6fd) |
| BuyerRegistry | [`0x2db2953a2a4cc4d719cacca6d4e07e425a5af09a`](https://sepolia.etherscan.io/address/0x2db2953a2a4cc4d719cacca6d4e07e425a5af09a) |
| CarbonCreditToken | [`0xa0b321cb5924cc810a8e964d5b6ea0a64fb523e0`](https://sepolia.etherscan.io/address/0xa0b321cb5924cc810a8e964d5b6ea0a64fb523e0) |
| CarrierRegistry | [`0x1f9b2b1e1d503067d95ba01d3188079865890afc`](https://sepolia.etherscan.io/address/0x1f9b2b1e1d503067d95ba01d3188079865890afc) |
| CertificateOfOrigin | [`0xfad639c0544eb248012382121c76645b4219f20a`](https://sepolia.etherscan.io/address/0xfad639c0544eb248012382121c76645b4219f20a) |
| CheckpointOracle | [`0x6bac715c6195b3162faa15a1545d32508c353705`](https://sepolia.etherscan.io/address/0x6bac715c6195b3162faa15a1545d32508c353705) |
| ClaimsProcessor | [`0xa13c5df9e0972300ddd0d5ef930ea403939eb141`](https://sepolia.etherscan.io/address/0xa13c5df9e0972300ddd0d5ef930ea403939eb141) |
| ColdChainMonitor | [`0xf7da2e9309e802fc331199e4e38ff21469952a82`](https://sepolia.etherscan.io/address/0xf7da2e9309e802fc331199e4e38ff21469952a82) |
| CommodityToken | [`0x45db031f09932116be9ddd39151d13afc3d2ee4b`](https://sepolia.etherscan.io/address/0x45db031f09932116be9ddd39151d13afc3d2ee4b) |
| CommodityVault | [`0x31665c2a31d6057a8a6c514ab9580b75ec9bc5b0`](https://sepolia.etherscan.io/address/0x31665c2a31d6057a8a6c514ab9580b75ec9bc5b0) |
| ContainerRegistry | [`0xf92411734330070604dbce06a3e1e2a06d9931f0`](https://sepolia.etherscan.io/address/0xf92411734330070604dbce06a3e1e2a06d9931f0) |
| CreditLineManager | [`0x530a5274e61b1ac97ba743ab54dca88d5a8aa7f8`](https://sepolia.etherscan.io/address/0x530a5274e61b1ac97ba743ab54dca88d5a8aa7f8) |
| CustomsBonded | [`0x40ebd300dca67498325a8f7ff75c35583cda630b`](https://sepolia.etherscan.io/address/0x40ebd300dca67498325a8f7ff75c35583cda630b) |
| CustomsDeclaration | [`0xed08575b298854c1b9339b3a7c9565b49972e428`](https://sepolia.etherscan.io/address/0xed08575b298854c1b9339b3a7c9565b49972e428) |
| DPPComplianceOracle | [`0xdafbfabf13fa252719abf09c30afdb0ebc2e1acd`](https://sepolia.etherscan.io/address/0xdafbfabf13fa252719abf09c30afdb0ebc2e1acd) |
| DPPDataCarrier | [`0x6d9b02495c08f64b51b1adc50f035fc756a82fba`](https://sepolia.etherscan.io/address/0x6d9b02495c08f64b51b1adc50f035fc756a82fba) |
| DPPLifecycleRegistry | [`0x5fd73b7c79af5f0c6cd8a44386bee61936411060`](https://sepolia.etherscan.io/address/0x5fd73b7c79af5f0c6cd8a44386bee61936411060) |
| DataMarketplace | [`0x89093556256dcdd43e7a4dd05dc11b84b49c23e1`](https://sepolia.etherscan.io/address/0x89093556256dcdd43e7a4dd05dc11b84b49c23e1) |
| DigitalProductPassport | [`0x27606724f47269d6520549d4bc96439337c06494`](https://sepolia.etherscan.io/address/0x27606724f47269d6520549d4bc96439337c06494) |
| DiscountCalculator | [`0x5b0ed9e174b7cd0c8e9f6a8e70aa1bb4f0786245`](https://sepolia.etherscan.io/address/0x5b0ed9e174b7cd0c8e9f6a8e70aa1bb4f0786245) |
| DisputeArbitration | [`0x134c806b5b11d74796fc6bcabf7b3db1701e015d`](https://sepolia.etherscan.io/address/0x134c806b5b11d74796fc6bcabf7b3db1701e015d) |
| DutyAndTariffCalculator | [`0x9bcbe4ebb271a98d89ccceff0c8b8784bf3ee833`](https://sepolia.etherscan.io/address/0x9bcbe4ebb271a98d89ccceff0c8b8784bf3ee833) |
| DynamicDiscounting | [`0xccf9b88926b5c93fb8f5905119752be237ead5d6`](https://sepolia.etherscan.io/address/0xccf9b88926b5c93fb8f5905119752be237ead5d6) |
| ESGRegistry | [`0x8d0397a06b94bbe7cfb5146cc1bb46a25e6d8c78`](https://sepolia.etherscan.io/address/0x8d0397a06b94bbe7cfb5146cc1bb46a25e6d8c78) |
| EmissionsController | [`0x526e969c8b6be109c1a3607c772796ba21b2d110`](https://sepolia.etherscan.io/address/0x526e969c8b6be109c1a3607c772796ba21b2d110) |
| EmissionsTrading | [`0xa2dd0ac677d1ba8cef8db4798ec8a525aa2c85a0`](https://sepolia.etherscan.io/address/0xa2dd0ac677d1ba8cef8db4798ec8a525aa2c85a0) |
| EscrowFactory | [`0x6281ded23822b5b9f35f0a6b8931ea83daf974ef`](https://sepolia.etherscan.io/address/0x6281ded23822b5b9f35f0a6b8931ea83daf974ef) |
| ExportLicenseRegistry | [`0xc68e3e6823820473f8397e5ca2e4b7a20dda1a0d`](https://sepolia.etherscan.io/address/0xc68e3e6823820473f8397e5ca2e4b7a20dda1a0d) |
| FactoringAgreement | [`0xb67515e0778b861c0fb8e93ab425ccacb21a24ea`](https://sepolia.etherscan.io/address/0xb67515e0778b861c0fb8e93ab425ccacb21a24ea) |
| FeeManager | [`0x0420fb0ed34b7c6b648d17f7bbdf22036f9cae98`](https://sepolia.etherscan.io/address/0x0420fb0ed34b7c6b648d17f7bbdf22036f9cae98) |
| FinancingMarketplace | [`0xde996a0d33fbaba844854c0f315b949e6ac0b5f2`](https://sepolia.etherscan.io/address/0xde996a0d33fbaba844854c0f315b949e6ac0b5f2) |
| FinancingPool | [`0xf277d8cab9a3bb3ccd06beb221efe430af155538`](https://sepolia.etherscan.io/address/0xf277d8cab9a3bb3ccd06beb221efe430af155538) |
| FleetRegistry | [`0x3ae413961ce77c5091dc99627c1856a98a83d6b9`](https://sepolia.etherscan.io/address/0x3ae413961ce77c5091dc99627c1856a98a83d6b9) |
| FreightBooking | [`0xec98c3b3e58672a16a211caafe5a2fcff1bb58cf`](https://sepolia.etherscan.io/address/0xec98c3b3e58672a16a211caafe5a2fcff1bb58cf) |
| GovernanceToken | [`0x00b98a6329300b3be27969f5e673de67924a07c7`](https://sepolia.etherscan.io/address/0x00b98a6329300b3be27969f5e673de67924a07c7) |
| GradingRegistry | [`0x58c4376e3c0f56507b32651c44f958182be3df6d`](https://sepolia.etherscan.io/address/0x58c4376e3c0f56507b32651c44f958182be3df6d) |
| GreenBondIssuer | [`0xa147737b32e6c7a48001c5465c414b8dc9533d4e`](https://sepolia.etherscan.io/address/0xa147737b32e6c7a48001c5465c414b8dc9533d4e) |
| GuaranteeRegistry | [`0x8413d295bd5d913b246143976c5a2ab12e4b3811`](https://sepolia.etherscan.io/address/0x8413d295bd5d913b246143976c5a2ab12e4b3811) |
| HalalCertification | [`0x5d80d959fb12940599f112432971789add5cee20`](https://sepolia.etherscan.io/address/0x5d80d959fb12940599f112432971789add5cee20) |
| HarvestRegistry | [`0x3437d697cb1a3e54131b4fcc793dc6764e5f6e27`](https://sepolia.etherscan.io/address/0x3437d697cb1a3e54131b4fcc793dc6764e5f6e27) |
| IdentityResolver | [`0x25b7675d8d412ea8ac5c06767d795d6e9cbed9b0`](https://sepolia.etherscan.io/address/0x25b7675d8d412ea8ac5c06767d795d6e9cbed9b0) |
| InsurancePool | [`0xa227c93d69a25cdeaed54e7882b0de422a2b3aea`](https://sepolia.etherscan.io/address/0xa227c93d69a25cdeaed54e7882b0de422a2b3aea) |
| InvoiceFinancing | [`0xf08e091cd91755796ac3fb51d9c6b054454617eb`](https://sepolia.etherscan.io/address/0xf08e091cd91755796ac3fb51d9c6b054454617eb) |
| InvoiceNFT | [`0xc0809d2dac3046fd18a541ef1a07041516cf896a`](https://sepolia.etherscan.io/address/0xc0809d2dac3046fd18a541ef1a07041516cf896a) |
| IoTSensorRegistry | [`0xb2c4a5ab9f33c1fe78048a2e378d4d1b8bbe84eb`](https://sepolia.etherscan.io/address/0xb2c4a5ab9f33c1fe78048a2e378d4d1b8bbe84eb) |
| KYCRegistry | [`0x1a1ffb8fff918e9807d38ec304111ab920694ce7`](https://sepolia.etherscan.io/address/0x1a1ffb8fff918e9807d38ec304111ab920694ce7) |
| LabTestAttestation | [`0x1c7857398332f8a4f709039870fcc04f2f3f59b5`](https://sepolia.etherscan.io/address/0x1c7857398332f8a4f709039870fcc04f2f3f59b5) |
| LaborComplianceRegistry | [`0xef71a031acc2bbc68b49846e524c4261277a9138`](https://sepolia.etherscan.io/address/0xef71a031acc2bbc68b49846e524c4261277a9138) |
| LastMileProofOfDelivery | [`0xdacecc2df614a6db46cb2751b55a509827e5ad19`](https://sepolia.etherscan.io/address/0xdacecc2df614a6db46cb2751b55a509827e5ad19) |
| LenderVault | [`0xe043a00533a2f258683f4f4567b57bc494ea4230`](https://sepolia.etherscan.io/address/0xe043a00533a2f258683f4f4567b57bc494ea4230) |
| LetterOfCredit | [`0xc22f95a501f9e1b67aebf05bc9b2f1a72814f0c4`](https://sepolia.etherscan.io/address/0xc22f95a501f9e1b67aebf05bc9b2f1a72814f0c4) |
| ListingRegistry | [`0x1ccaab5659f7e9e6320f25fcb71d3c05347e20d2`](https://sepolia.etherscan.io/address/0x1ccaab5659f7e9e6320f25fcb71d3c05347e20d2) |
| LoyaltyPoints | [`0x766fe311ebeac7cd8707963c888561f839d032ce`](https://sepolia.etherscan.io/address/0x766fe311ebeac7cd8707963c888561f839d032ce) |
| MaterialComposition | [`0xfc79f432c9044364b4dc60f64a74799a0a8441d1`](https://sepolia.etherscan.io/address/0xfc79f432c9044364b4dc60f64a74799a0a8441d1) |
| MilestonePayroll | [`0x9458f41f4b7d9aabebe837c8da446756c4182230`](https://sepolia.etherscan.io/address/0x9458f41f4b7d9aabebe837c8da446756c4182230) |
| MockUSDC | [`0xdc0302f14781754e302d9d9669d7aac8d26cc210`](https://sepolia.etherscan.io/address/0xdc0302f14781754e302d9d9669d7aac8d26cc210) |
| OffsetMarketplace | [`0x000a390c3765c9edca01892a3661f9c3f316434b`](https://sepolia.etherscan.io/address/0x000a390c3765c9edca01892a3661f9c3f316434b) |
| OracleAggregator | [`0x7f03044de8707bd79f9bbddddffb7ec8977e09fe`](https://sepolia.etherscan.io/address/0x7f03044de8707bd79f9bbddddffb7ec8977e09fe) |
| OrderBook | [`0xa7815f97ba5682eff8ce2285c59ba9dda31d33ca`](https://sepolia.etherscan.io/address/0xa7815f97ba5682eff8ce2285c59ba9dda31d33ca) |
| OrganizationRegistry | [`0xed0416b101b8fbfaaa4bd129bbaa64b560af2c80`](https://sepolia.etherscan.io/address/0xed0416b101b8fbfaaa4bd129bbaa64b560af2c80) |
| Pauser | [`0x32d773a74ee344abcd32c62d2d113156af3ed84b`](https://sepolia.etherscan.io/address/0x32d773a74ee344abcd32c62d2d113156af3ed84b) |
| PaymentRouter | [`0x79bceba4f2f538265f2a5840a9581e77791bb7a8`](https://sepolia.etherscan.io/address/0x79bceba4f2f538265f2a5840a9581e77791bb7a8) |
| PhytosanitaryCertificate | [`0xf29e247d6f82332e73cc19b05717e23c026dbf74`](https://sepolia.etherscan.io/address/0xf29e247d6f82332e73cc19b05717e23c026dbf74) |
| PolicyManager | [`0x15bdd9451e1c60df35cb13e55ab5800125f24338`](https://sepolia.etherscan.io/address/0x15bdd9451e1c60df35cb13e55ab5800125f24338) |
| PremiumCalculator | [`0xcf1748259caf1a0a4064e51ab03450357bda5e2e`](https://sepolia.etherscan.io/address/0xcf1748259caf1a0a4064e51ab03450357bda5e2e) |
| PriceOracle | [`0x7d11f31cb5e6e97e5389324ed19b5f5e8ed853fd`](https://sepolia.etherscan.io/address/0x7d11f31cb5e6e97e5389324ed19b5f5e8ed853fd) |
| ProductRecallRegistry | [`0x82d163897802cb9a4a33f42b946ac6d7108ff65e`](https://sepolia.etherscan.io/address/0x82d163897802cb9a4a33f42b946ac6d7108ff65e) |
| ProofChainGovernor | [`0xa0aa7b5285fd46ed558fd5df39889672afdfa164`](https://sepolia.etherscan.io/address/0xa0aa7b5285fd46ed558fd5df39889672afdfa164) |
| ProofChainTimelock | [`0x8bfe4778d9c97b63c4c41f4f6a56c48737108ccd`](https://sepolia.etherscan.io/address/0x8bfe4778d9c97b63c4c41f4f6a56c48737108ccd) |
| ProposalRegistry | [`0x39a0eb52c1736682aab5063ab3334647b9d6927b`](https://sepolia.etherscan.io/address/0x39a0eb52c1736682aab5063ab3334647b9d6927b) |
| ProvenanceFactory | [`0x752ac2a7495539b56304ac0446750be4387637f9`](https://sepolia.etherscan.io/address/0x752ac2a7495539b56304ac0446750be4387637f9) |
| ProvenanceRegistry | [`0xbf0a3b62db1605fb018a4bdffc8e39377e16b0df`](https://sepolia.etherscan.io/address/0xbf0a3b62db1605fb018a4bdffc8e39377e16b0df) |
| PurchaseOrderFinancing | [`0xb7671efc8d538aef068fea26f8df24fe4e05cd6b`](https://sepolia.etherscan.io/address/0xb7671efc8d538aef068fea26f8df24fe4e05cd6b) |
| QualityInspection | [`0x435bf86676c59e335f6ae4bea69e1f3a9460eac3`](https://sepolia.etherscan.io/address/0x435bf86676c59e335f6ae4bea69e1f3a9460eac3) |
| ReceivableRegistry | [`0x5d91df43b74c33c02578b1a956445bc5d9425143`](https://sepolia.etherscan.io/address/0x5d91df43b74c33c02578b1a956445bc5d9425143) |
| ReceivableSecuritization | [`0xcd9bb10213b6c9732bcf957a58ec9228b1bf7c5a`](https://sepolia.etherscan.io/address/0xcd9bb10213b6c9732bcf957a58ec9228b1bf7c5a) |
| RecyclingRegistry | [`0x55ce196277f8a27106479e0dc1f545c675b14d24`](https://sepolia.etherscan.io/address/0x55ce196277f8a27106479e0dc1f545c675b14d24) |
| ReferralProgram | [`0xf0d9c9c22663bbbdbc3ca69e77767401e1a7dfac`](https://sepolia.etherscan.io/address/0xf0d9c9c22663bbbdbc3ca69e77767401e1a7dfac) |
| RenewableEnergyCertificate | [`0xfc59db5dcab9bc07bfa9d6260992c4e0a99c3e4d`](https://sepolia.etherscan.io/address/0xfc59db5dcab9bc07bfa9d6260992c4e0a99c3e4d) |
| RepairabilityIndex | [`0xcd55422ba872f5e05ea158ecd0d88eba2b5b3dfc`](https://sepolia.etherscan.io/address/0xcd55422ba872f5e05ea158ecd0d88eba2b5b3dfc) |
| RepaymentController | [`0x0e939f936a190e407d7a33fbdfd47415793a84cc`](https://sepolia.etherscan.io/address/0x0e939f936a190e407d7a33fbdfd47415793a84cc) |
| ReputationEngine | [`0xb69478fad3a58327dc6c624231f1d3abd57e19fb`](https://sepolia.etherscan.io/address/0xb69478fad3a58327dc6c624231f1d3abd57e19fb) |
| RewardsDistributor | [`0xc757e68eb4b4db69b972b203ea426d48d8e98e45`](https://sepolia.etherscan.io/address/0xc757e68eb4b4db69b972b203ea426d48d8e98e45) |
| RiskPool | [`0x28e6891616794a582aa356b1519a484961c524ad`](https://sepolia.etherscan.io/address/0x28e6891616794a582aa356b1519a484961c524ad) |
| RouteAttestation | [`0x3b1da38bcf79e8baf56e4a87f144458203d33d76`](https://sepolia.etherscan.io/address/0x3b1da38bcf79e8baf56e4a87f144458203d33d76) |
| SafetyTrainingRegistry | [`0xe4427642c723135b976de4491ba284320bdfcda6`](https://sepolia.etherscan.io/address/0xe4427642c723135b976de4491ba284320bdfcda6) |
| SanctionsScreening | [`0xb56e92b28deeb92e140af44c0416512a5612a31e`](https://sepolia.etherscan.io/address/0xb56e92b28deeb92e140af44c0416512a5612a31e) |
| ScoreOracle | [`0xb90bc3c0f264d6447d0a0976e45b149a58763c9b`](https://sepolia.etherscan.io/address/0xb90bc3c0f264d6447d0a0976e45b149a58763c9b) |
| SettlementEscrow | [`0xa83e133d60bb38e18668682d83b4268c8251f28e`](https://sepolia.etherscan.io/address/0xa83e133d60bb38e18668682d83b4268c8251f28e) |
| SettlementRouter | [`0xe194012ffc056e680931e20c05f25d9399c2d09a`](https://sepolia.etherscan.io/address/0xe194012ffc056e680931e20c05f25d9399c2d09a) |
| SkillAttestation | [`0x499ee25879a51b6d76656ff1c5c840eb04d093e1`](https://sepolia.etherscan.io/address/0x499ee25879a51b6d76656ff1c5c840eb04d093e1) |
| SlashingController | [`0x4ac1b72e153d17861707a673c2ed415e9bcc62fc`](https://sepolia.etherscan.io/address/0x4ac1b72e153d17861707a673c2ed415e9bcc62fc) |
| StablecoinRegistry | [`0x37414c2058ced701b00480ea3a02abad0b552580`](https://sepolia.etherscan.io/address/0x37414c2058ced701b00480ea3a02abad0b552580) |
| StakeManager | [`0xe36d82fc6c6adeccd895356806e455a97d5a740e`](https://sepolia.etherscan.io/address/0xe36d82fc6c6adeccd895356806e455a97d5a740e) |
| StakingRewards | [`0x816620593ded4193358722e6b8dc675d5551add8`](https://sepolia.etherscan.io/address/0x816620593ded4193358722e6b8dc675d5551add8) |
| StorageReceipt | [`0x32f1539d70312d993ce9d4b407ff1959a2028d13`](https://sepolia.etherscan.io/address/0x32f1539d70312d993ce9d4b407ff1959a2028d13) |
| SupplierBond | [`0xce35f880789104c06c16ac410f3ae87b50879985`](https://sepolia.etherscan.io/address/0xce35f880789104c06c16ac410f3ae87b50879985) |
| SupplierRegistry | [`0xfb2aebff9b0f1fd00c60ab822f5c239a0efed8e3`](https://sepolia.etherscan.io/address/0xfb2aebff9b0f1fd00c60ab822f5c239a0efed8e3) |
| SupplyChainFinance | [`0xded863e069ba127232a1e8d92d5071553ea010c3`](https://sepolia.etherscan.io/address/0xded863e069ba127232a1e8d92d5071553ea010c3) |
| SustainabilityOracle | [`0x45c3d4c17bd6d166c7ee9fa3085cb34dc130c200`](https://sepolia.etherscan.io/address/0x45c3d4c17bd6d166c7ee9fa3085cb34dc130c200) |
| TradeComplianceEngine | [`0x2de51e78b1620b3c9bfe240b0b9f0b3728cbbff2`](https://sepolia.etherscan.io/address/0x2de51e78b1620b3c9bfe240b0b9f0b3728cbbff2) |
| TrancheToken | [`0x5d0ddf48cd68d4ceabc71f2dd567ab7d5661dde7`](https://sepolia.etherscan.io/address/0x5d0ddf48cd68d4ceabc71f2dd567ab7d5661dde7) |
| Treasury | [`0x6888b31fe7537fc818ec01fada596cb4e1872486`](https://sepolia.etherscan.io/address/0x6888b31fe7537fc818ec01fada596cb4e1872486) |
| WarehouseReceipt | [`0xcd0a3f8ab994dabc04055554d822143e98039a30`](https://sepolia.etherscan.io/address/0xcd0a3f8ab994dabc04055554d822143e98039a30) |
| WaterCredit | [`0xe22356e5a6325e717ab6b2451f42c8ac6de4ee92`](https://sepolia.etherscan.io/address/0xe22356e5a6325e717ab6b2451f42c8ac6de4ee92) |
| WorkerCredential | [`0xc3607f29ba374c03cfec110b8cb8955c2164409a`](https://sepolia.etherscan.io/address/0xc3607f29ba374c03cfec110b8cb8955c2164409a) |
| YieldDistributor | [`0x95edbc5ed025abc6525748800ea9988c40efd11e`](https://sepolia.etherscan.io/address/0x95edbc5ed025abc6525748800ea9988c40efd11e) |
