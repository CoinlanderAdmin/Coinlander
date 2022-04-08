// SPDX-License-Identifier: UNLICENSED
// Author: @stevieraykatz
// https://github.com/coinlander/Coinlander

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IVault.sol";

contract Vault is IVault, ERC1155, Ownable, ReentrancyGuard {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                        INIT SHIT                                             //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    // Coin IDs
    uint256 public constant KEY = 0;
    uint256 public constant FRAGMENT1 = 1;
    uint256 public constant FRAGMENT2 = 2;
    uint256 public constant FRAGMENT3 = 3;
    uint256 public constant FRAGMENT4 = 4;
    uint256 public constant FRAGMENT5 = 5;
    uint256 public constant FRAGMENT6 = 6;
    uint256 public constant FRAGMENT7 = 7;
    uint256 public constant FRAGMENT8 = 8;

    // FRAGMENT PARAMETERS
    uint16 public constant MAXFRAGMENTS = 1111;
    uint16[] private fragments; // Dynamic array of all fragment ids

    // Max supply of each type 
    uint16 public constant numT1 = 3;
    uint16 public constant numT2 = 10;
    uint16 public constant numT3 = 10;
    uint16 public constant numT4 = 50;
    uint16 public constant numT5 = 100;
    uint16 public constant numT6 = 111;
    uint16 public constant numT7 = 222;
    uint16 public constant numT8 = MAXFRAGMENTS - numT1 - numT2 - numT3 - numT4 - numT5 - numT6 - numT7;

    uint256 public prize = 0; 
    bool public gameWon = false;
    bool public sweetRelease = false;
    address public gameContract = address(0);
    string private _contractURI;

    // @TODO we need to figure out what the url schema for metadata looks like and plop that here in the constructor
    constructor() ERC1155("https://api.coinlander.dev/meta/valut/{id}") {

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

        _contractURI = "https://api.coinlander.dev/meta/vault";
    }

    function mintFragments(address _receiver, uint256 amount) external onlyGameContract {
        require(fragments.length >= amount, "E-002-009");
        for(uint256 i = 0; i < amount; i++){
            uint256 fragmentType = _getRandom(fragments);
            _mint(_receiver, uint256(fragmentType), 1, "0x0");
            
        }
    }

    function setSweetRelease() external onlyGameContract {
        sweetRelease = true;
    }

    function claimKeepersVault() external nonReentrant {
        require(sweetRelease, "E-002-010");
        require(!gameWon, "E-002-011");
        require(prize > 0, "E-002-012");
        require(balanceOf(msg.sender, FRAGMENT1) > 0, "E-002-001");
        require(balanceOf(msg.sender, FRAGMENT2) > 0, "E-002-002");
        require(balanceOf(msg.sender, FRAGMENT3) > 0, "E-002-003");
        require(balanceOf(msg.sender, FRAGMENT4) > 0, "E-002-004");
        require(balanceOf(msg.sender, FRAGMENT5) > 0, "E-002-005");
        require(balanceOf(msg.sender, FRAGMENT6) > 0, "E-002-006");
        require(balanceOf(msg.sender, FRAGMENT7) > 0, "E-002-007");
        require(balanceOf(msg.sender, FRAGMENT8) > 0, "E-002-008");

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
        emit VaultUnlocked(msg.sender);
        gameWon = true;
        uint256 _prize = prize;
        prize = 0;
        (bool success, ) = msg.sender.call{value:_prize}("");
        require(success, "E-002-014");
    }
    
    function fundPrizePurse() payable public {
        prize += msg.value;
    }

    function _getRandom(uint16[] storage _arr) private returns (uint256) {
        uint256 random = _getRandomNumber(_arr);
        uint256 fragType = uint256(_arr[random]);

        _arr[random] = _arr[_arr.length - 1]; 
        _arr.pop();
 
        return fragType;
    }

	// Thanks Manny - entropy is a bitch
	function _getRandomNumber(uint16[] storage _arr) private view returns (uint256) {
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
		return (random % _arr.length);
	}

    function setGameContract(address _gameContract) external onlyOwner {
        gameContract = _gameContract; 
    }

    modifier onlyGameContract {
        require(msg.sender == gameContract, "E-002-015");
        _;
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        _contractURI = newContractURI;
    }
    function changeURI(string calldata _newURI) external onlyOwner {
        _setURI(_newURI);
    }

    // All fund allocations should be going thru fund prize purse
    receive() external payable {
        revert("E-002-014");
    }
}