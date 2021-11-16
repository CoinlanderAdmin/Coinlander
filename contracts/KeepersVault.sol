// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/iSeekers.sol";
import "./interfaces/iKeepersVault.sol";

contract KeepersVault is iKeepersVault, ERC1155, Ownable, ReentrancyGuard {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                        INIT SHIT                                             //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    // Coin IDs
    uint256 public constant FRAGMENT1 = 0;
    uint256 public constant FRAGMENT2 = 1;
    uint256 public constant FRAGMENT3 = 2;
    uint256 public constant FRAGMENT4 = 3;
    uint256 public constant FRAGMENT5 = 4;
    uint256 public constant FRAGMENT6 = 5;
    uint256 public constant FRAGMENT7 = 6;
    uint256 public constant FRAGMENT8 = 7;
    uint256 public constant KEY = 8;

    // FRAGMENT PARAMETERS
    uint16 public constant MAXFRAGMENTS = 1111;
    uint16[] private fragments; // Dynamic array of all fragment ids

    // Max supply of each type 
    uint16 constant numT1 = 3;
    uint16 constant numT2 = 10;
    uint16 constant numT3 = 10;
    uint16 constant numT4 = 50;
    uint16 constant numT5 = 100;
    uint16 constant numT6 = 111;
    uint16 constant numT7 = 222;
    uint16 constant numT8 = MAXFRAGMENTS - numT1 - numT2 - numT3 - numT4 - numT5 - numT6 - numT7;

    iSeekers public seekers;
    uint256 public prize = 0; 

    // @TODO we need to figure out what the url schema for metadata looks like and plop that here in the constructor
    constructor(address seekersContract) ERC1155("https://coinlander.one/api/keepersVault/token/{id}.json") {
        // Create the One Coin and set the deployer as initial COINLANDER

        // Add interface for seekers contract 
        seekers = iSeekers(seekersContract);

        // Initialize the fragments array
        for  (uint16 i = 0; i < numT1; i++){
            fragments.push(uint16(FRAGMENT1));
        }
        for  (uint16 i = 0; i < numT2; i++){
            fragments.push(uint16(FRAGMENT2));
        }
        for  (uint16 i = 0; i < numT3; i++){
            fragments.push(uint16(FRAGMENT3));
        }
        for  (uint16 i = 0; i < numT4; i++){
            fragments.push(uint16(FRAGMENT4));
        }
        for  (uint16 i = 0; i < numT5; i++){
            fragments.push(uint16(FRAGMENT5));
        }
        for  (uint16 i = 0; i < numT6; i++){
            fragments.push(uint16(FRAGMENT6));
        }
        for  (uint16 i = 0; i < numT7; i++){
            fragments.push(uint16(FRAGMENT7));
        }
        for  (uint16 i = 0; i < numT8; i++){
            fragments.push(uint16(FRAGMENT8));
        }
    }

    function mintFragments(address _receiver, uint256 amount) external onlyOwner {
        for(uint256 i = 0; i < amount; i++){
            uint16 fragmentType = _getRandom(fragments);
            _mint(_receiver, uint256(fragmentType), 1, "0x0");
            
        }
    }

    function claimKeepersVault() external nonReentrant {
        require(prize > 0);
        require(seekers.balanceOf(msg.sender) > 0);
        require(balanceOf(msg.sender, FRAGMENT1) > 0);
        require(balanceOf(msg.sender, FRAGMENT2) > 0);
        require(balanceOf(msg.sender, FRAGMENT3) > 0);
        require(balanceOf(msg.sender, FRAGMENT4) > 0);
        require(balanceOf(msg.sender, FRAGMENT5) > 0);
        require(balanceOf(msg.sender, FRAGMENT6) > 0);
        require(balanceOf(msg.sender, FRAGMENT7) > 0);
        require(balanceOf(msg.sender, FRAGMENT8) > 0);

        // Assemble the Key 
        _burn(msg.sender, FRAGMENT1, 1);
        _burn(msg.sender, FRAGMENT2, 1);
        _burn(msg.sender, FRAGMENT3, 1);
        _burn(msg.sender, FRAGMENT4, 1);
        _burn(msg.sender, FRAGMENT5, 1);
        _burn(msg.sender, FRAGMENT6, 1);
        _burn(msg.sender, FRAGMENT7, 1);
        _burn(msg.sender, FRAGMENT8, 1);
        _mint(msg.sender, KEY, 1, "0x0");

        // Unlock the vault
        payable(msg.sender).transfer(prize);
        prize = 0;
    }
    
    function fundPrizePurse() payable public {
        prize += msg.value;
    }

    function _getRandom(uint16[] storage _arr) private returns (uint16) {
        uint16 random = _getRandomNumber(_arr);
        uint16 fragType = _arr[random];

        _arr[random] = _arr[_arr.length - 1]; 
        _arr.pop();

        return fragType;
    }

	// Thanks Manny - entropy is a bitch
	function _getRandomNumber(uint16[] storage _arr) private view returns (uint16) {
		uint256 random = uint256(
			keccak256(
				abi.encodePacked(
					_arr,
					blockhash(block.number - 1),
					block.coinbase,
					block.difficulty,
					msg.sender
				)
			)
		);
		return uint16(random % _arr.length);
	}
}