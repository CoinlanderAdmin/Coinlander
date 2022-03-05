// SPDX-License-Identifier: UNLICENSED
// Author: @stevieraykatz
// https://github.com/coinlander/Coinlander

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

/**
 * @title ERC-721 Non-Fungible Token Standard extended for compatibiltiy with Seekers
 * @dev External Seekers.sol methods made available to inheriting contracts
 */

interface iSeekers is IERC721Enumerable {
    event FirstMintActivated();
    event SecondMintActivated();
    event ThirdMintActivated();
    event UncloakingAvailable();
    event SeekerUncloaked(uint256 indexed seekerId);
    event DethscalesRerolled(uint256 id);
    event PowerAdded(uint256 indexed seekerId, uint256 powerAdded, uint256 newPower);
    event SeekerDeclaredToClan(uint256 indexed seekerId, address indexed clan);


    function summonSeeker(uint256 summonCount) external payable;
    function birthSeeker(address to) external returns (uint256);
    function keepersSummonSeeker(uint256 summonCount) external;
    function activateFirstMint() external;
    function activateSecondMint() external;
    function activateThirdMint() external;
    function seizureMintIncrement() external;
    function endGoodsOnly() external;
    function performUncloaking() external;
    function sendWinnerSeeker(address winner) external;
    function uncloakSeeker(uint256 id) external;
    function rerollDethscales(uint256 id) external;
    function addPower(uint256 id, uint256 power) external;
    function declareForClan(uint id, address clanAddress) external;
    function ownerWithdraw() external payable;

    /**
    * @dev Externally callable methods for seeing Seeker attributes
    */
    function getBirthStatusById(uint256 id) external view returns (bool);
    function getAlignmentById(uint256 id) external view returns (string memory);
    function getApById(uint256 id) external view returns (uint8[4] memory);
    function getPowerById(uint256 id) external view returns (uint16);
    function getClanById(uint256 id) external view returns (address);
    function getDethscalesById(uint256 id) external view returns (uint16);
    function getCloakStatusById(uint256 id) external view returns (bool);
    function getFullCloak(uint256 id) external view returns (uint32[32] memory);
}