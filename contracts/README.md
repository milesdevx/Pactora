## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

Testnet only. Unaudited. No subjective dispute arbitration. Run from this directory only if an owner intends a new deployment, using a dedicated testnet wallet. Keep `DEPLOYER_PRIVATE_KEY` local; never print or commit it.

```powershell
forge script script/DeployPactoraEscrow.s.sol:DeployPactoraEscrow --rpc-url https://rpc.test.mezo.org --chain-id 31611 --private-key $env:DEPLOYER_PRIVATE_KEY --broadcast --legacy
```

V2 is already deployed. [Deployment checks](../docs/deployments.md) record the verified address, receipts and remaining gaps. OpenZeppelin/forge-std are vendored in `lib`; a normal checkout needs no fresh `forge install`.

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
