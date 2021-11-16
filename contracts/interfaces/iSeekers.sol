// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

/**
 * @title ERC-721 Non-Fungible Token Standard extended for compatibiltiy with Seekers
 * @dev External Seekers.sol methods made available to inheriting contracts
 */

interface iSeekers is IERC721Enumerable {
    event firstMintActivated();
    event secondMintActivated();
    event thirdMintActivated();
    event uncloakingAvailable();
    event seekerDeclaredToClan(uint256 indexed seekerId, address indexed clan);


    function summonSeeker(uint256 summonCount) external payable;
    function birthSeeker(address to) external;
    function getSeekerCount() external view returns (uint256);
    function allSeekerOwners() external view returns (address[] memory);
    function activateFirstMint() external;
    function activateSecondMint() external;
    function activateThirdMint() external;
    function performUncloaking() external;
    function uncloakSeeker(uint256 id) external;
    function addScales(uint256 id, uint256 scales) external;

    /**
    * @dev Externally callable methods for seeing Seeker attributes
    */
    function getBirthStatusById(uint256 id) external view returns (bool);
    function getAlignmentById(uint256 id) external view returns (string memory);
    function getApById(uint256 id) external view returns (uint256[4] memory);
    function getScaleCountById(uint256 id) external view returns (uint256);
    function getClanById(uint256 id) external view returns (address);
}