// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.8;

/**
 * @title Required interface for compatibility with future Coinlander contracts
 * @dev All methods here must be defined in a clan governance contract
 */

interface iClans {

    // Methods must return `true`
    function isClan() external returns (bool);

    // Must return a valid uri json (as defined in our docs) for building your clan page
    function returnURI() external returns (string memory); 

    // Return list of Character Ids declared to clan from specified character contract (i.e. Seekers)
    function characterMembers() external returns (address characterContract, uint256[] memory);

    // Return list of all items of a specified type declared for a given action from specified item contract 
    function declaredItems(address itemContract, uint256 itemType, uint256[] memory itemIds) external;

    // Return list of all addresses associated with clan
    function allMembers() external returns (address[] memory);

}