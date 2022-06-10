// SPDX-License-Identifier: UNLICENSED
// Author: @stevieraykatz
// https://github.com/coinlander/Coinlander

pragma solidity ^0.8.10;

// @TODO investigate EIP-712 for external method calls 

interface IVault {

    event VaultUnlocked(address winner);

    function mintFragments(address _receiver, uint256 amount) external;
    function setSweetRelease() external;
    function claimKeepersVault() external;
    function fundPrizePurse() payable external;

}