/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { Cloak, CloakInterface } from "../Cloak";

const _abi = [
  {
    inputs: [
      {
        internalType: "uint16",
        name: "minDethscales",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "maxDethscales",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "seed",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "salt",
        type: "uint16",
      },
    ],
    name: "getDethscales",
    outputs: [
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint16",
        name: "minNoiseBits",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "maxNoiseBits",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "_dethscales",
        type: "uint16",
      },
    ],
    name: "getFullCloak",
    outputs: [
      {
        internalType: "uint32[32]",
        name: "",
        type: "uint32[32]",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
];

const _bytecode =
  "0x61090261003a600b82828239805160001a60731461002d57634e487b7160e01b600052600060045260246000fd5b30600052607381538281f3fe73000000000000000000000000000000000000000030146080604052600436106100405760003560e01c806331f7bb74146100455780633966f4001461006e575b600080fd5b610058610053366004610504565b610094565b6040516100659190610547565b60405180910390f35b61008161007c366004610583565b610396565b60405161ffff9091168152602001610065565b61009c6104b0565b6100a46104b0565b61ffff83166100b16104cf565b601082901b65fffff000000016600c83811b650fffff00000016600885811b64fffff0000016600487811b640fffff00001663fffff00089169189901c630fffff00169589901c620fffff169389901c62fffff0169390931794909417939093171791909117171781600063ffffffff9290921660209092020152601482901b63f000000016601083901b630f00000016600c84901b62f0000016600885811b620f000016600487811b61f00016610f0089169389901c600f169189901c60f0169190911792909217919091171717171781600163ffffffff9290921660209092020152601882901b63f000000016601483901b630f00000016601084901b62f0000016600c85901b620f000016600886901b61f00016600487811b610f00169088901c600f1660f089161717171717171781600263ffffffff909216602092909202015260f0600483901b16600f831617610f00600884901b161761f000600c84901b1617620f0000601084901b161762f00000601484901b1617630f000000601884901b161763f0000000601c84901b161781600363ffffffff909216602092909202015260005b60208161ffff1610156102c557816102746004836105ed565b61ffff1660048110610288576102886105d7565b6020020151848261ffff16602081106102a3576102a36105d7565b63ffffffff9092166020929092020152806102bd81610632565b91505061025b565b506000876102e86102d6828a610654565b6102e1906001610677565b888a61043f565b6102f29190610677565b905060005b8161ffff168161ffff1610156103895760006103156020898461043f565b905060006103256020838561043f565b9050868161ffff166020811061033d5761033d6105d7565b602002015161034d836002610894565b18878261ffff1660208110610364576103646105d7565b63ffffffff90921660209290920201525081905061038181610632565b9150506102f7565b5092979650505050505050565b60008080806103a58888610654565b6103b0906001610677565b9050600061ffff8716156103c2575060015b6000816103cf57866103d1565b875b905060008a6103e1858a8561043f565b6103eb9190610677565b905060005b8161ffff168161ffff16101561042f5761040c6010828561043f565b95508661041a8760026108b1565b1796508061042781610632565b9150506103f0565b50949a9950505050505050505050565b6040517fffff00000000000000000000000000000000000000000000000000000000000060f084811b8216602084015283901b16602282015260009081906024016040516020818303038152906040528051906020012060f01c905084816104a791906105ed565b95945050505050565b6040518061040001604052806020906020820280368337509192915050565b60405180608001604052806004906020820280368337509192915050565b803561ffff811681146104ff57600080fd5b919050565b60008060006060848603121561051957600080fd5b610522846104ed565b9250610530602085016104ed565b915061053e604085016104ed565b90509250925092565b6104008101818360005b6020808210610560575061057a565b825163ffffffff1684529283019290910190600101610551565b50505092915050565b6000806000806080858703121561059957600080fd5b6105a2856104ed565b93506105b0602086016104ed565b92506105be604086016104ed565b91506105cc606086016104ed565b905092959194509250565b634e487b7160e01b600052603260045260246000fd5b600061ffff8084168061061057634e487b7160e01b600052601260045260246000fd5b92169190910692915050565b634e487b7160e01b600052601160045260246000fd5b600061ffff8083168181141561064a5761064a61061c565b6001019392505050565b600061ffff8381169083168181101561066f5761066f61061c565b039392505050565b600061ffff8083168185168083038211156106945761069461061c565b01949350505050565b600181815b808511156106da578163ffffffff048211156106c0576106c061061c565b808516156106cd57918102915b93841c93908002906106a2565b509250929050565b600181815b808511156106da578161ffff048211156107035761070361061c565b8085161561071057918102915b93841c93908002906106e7565b60008261072c575060016107e5565b81610739575060006107e5565b816001811461074f57600281146107595761078a565b60019150506107e5565b60ff84111561076a5761076a61061c565b6001841b915063ffffffff8211156107845761078461061c565b506107e5565b5060208310610133831016604e8410600b84101617156107c1575081810a63ffffffff8111156107bc576107bc61061c565b6107e5565b6107cb838361069d565b8063ffffffff048211156107e1576107e161061c565b0290505b92915050565b6000826107fa575060016107e5565b81610807575060006107e5565b816001811461074f576002811461081d57610846565b60ff84111561082e5761082e61061c565b6001841b915061ffff8211156107845761078461061c565b5060208310610133831016604e8410600b8410161715610876575081810a61ffff8111156107bc576107bc61061c565b61088083836106e2565b8061ffff048211156107e1576107e161061c565b60006108aa61ffff841663ffffffff841661071d565b9392505050565b600061ffff6108c48185168285166107eb565b94935050505056fea2646970667358221220ce88b0f869166934612699f88775bde8903d9aeb6f8f76625fdd965492dd4d1464736f6c634300080a0033";

export class Cloak__factory extends ContractFactory {
  constructor(
    ...args: [signer: Signer] | ConstructorParameters<typeof ContractFactory>
  ) {
    if (args.length === 1) {
      super(_abi, _bytecode, args[0]);
    } else {
      super(...args);
    }
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<Cloak> {
    return super.deploy(overrides || {}) as Promise<Cloak>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): Cloak {
    return super.attach(address) as Cloak;
  }
  connect(signer: Signer): Cloak__factory {
    return super.connect(signer) as Cloak__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): CloakInterface {
    return new utils.Interface(_abi) as CloakInterface;
  }
  static connect(address: string, signerOrProvider: Signer | Provider): Cloak {
    return new Contract(address, _abi, signerOrProvider) as Cloak;
  }
}
