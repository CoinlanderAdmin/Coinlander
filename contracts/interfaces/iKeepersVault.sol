// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.8;

// @TODO investigate EIP-712 for external method calls 

interface iKeepersVault {

    function mintFragments(address _receiver, uint256 amount) external;
    function claimKeepersVault() external;
    function fundPrizePurse() payable external;

}