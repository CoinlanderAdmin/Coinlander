// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./utils/Counters.sol";
import "./interfaces/iSeekers.sol";

contract Seekers is ERC721Enumerable, iSeekers, AccessControl, ReentrancyGuard {
	// Access control setup
	bytes32 public constant KEEPERS_ROLE = keccak256("KEEPERS_ROLE"); // Role for Keepers
	bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE"); // Role for approved Coinlander game contracts

	// Counter inits
	using Counters for Counters.Counter;
	Counters.Counter private _seekerId; // Public sale id tracker
	Counters.Counter private _internalId; // Internal id tracker

	uint256 public constant MAXSEEKERS = 11111;
	uint256 public currentBuyableSeekers = 0;
	uint256 public currentPrice = 0;
	uint256 private reserve = 0; // Contracts treasury balance
	uint256 private constant KEEPERSEEKERS = 10; // Number of Seekers that Keepers can mint for themselves
	uint256 public constant MAXMINTABLE = 10; // Max seekers that can be purchased in one tx
	uint16 private constant MAXPIXELS = 1024; // 32x32 pixel grid 

	// Seeker release schedule
	// Activation for each will be called externally by the season 1 Coinlander contract
	uint256 public constant FIRSTMINT = 6117;
	bool public firstMintActive = false;
	uint256 public constant FIRSTMINTPRICE = 0.02 ether;
	uint256 public constant SECONDMINT = 3000;
	bool public secondMintActive = false;
	uint256 public constant SECONDMINTPRICE = 0.05 ether;
	uint256 public constant THIRDMINT = 1111;
	bool public thirdMintActive = false;
	uint256 public constant THIRDMINTPRICE = 0.1 ether;

	// This adds 2 because we are minting the winner id = 1 and ids need to be 1 indexed
	uint256 private constant INTERNALIDOFFSET = FIRSTMINT + SECONDMINT + THIRDMINT + 2; 

	// On-chain game parameters
	bool public uncloaking = false;
	uint256 constant COINAPOFFSET = 10; // AP buff if Seeker is minted through CL seizure
	mapping(uint256 => bool) isSeekerCloaked;

	struct Attributes {
		bool bornFromCoin;
		string alignment;
		uint256 alpha;
		uint256 beta;
		uint256 delta;
		uint256 gamma;
		uint256 scales;
		address clan;
	}

	mapping(uint256 => Attributes) attributesBySeekerId;

	// Off-chain metadata
	string private _baseTokenURI = "https://coinlander.one/seekers/";

	// Alignment
	string[] private alignment = [
		"Lawful Good",
		"Neutral Good",
		"Chaotic Good",
		"Lawful Neutral",
		"True Neutral",
		"Chaotic Neutral",
		"Lawful Evil",
		"Neutral Evil",
		"Chaotic Evil"
	];

	constructor() ERC721("Seekers", "SEEK") {
		// Give the Keeper deploying this contract the Keeper role and set them as admin
		_setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
		_setupRole(KEEPERS_ROLE, msg.sender);
		_setRoleAdmin(KEEPERS_ROLE, DEFAULT_ADMIN_ROLE);

		_seekerId.increment(); // Start indexing seekers at 1 (counter inits to 0)
		_safeMint(msg.sender, _seekerId.current()); // Set aside id 1 for Season 1 winner

		_internalId.setValue(INTERNALIDOFFSET);
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//                                                                                              //
	//                                  MINTING AND SUCH                                            //
	//                                                                                              //
	//////////////////////////////////////////////////////////////////////////////////////////////////

	function summonSeeker(uint256 summonCount) external payable nonReentrant {
		require(
			summonCount > 0 && summonCount <= MAXMINTABLE,
			"Must mint at least one and less or equal to max");
		require(
			msg.value >= currentPrice * summonCount,
			"sent insufficient Ether");
		require(
			(_seekerId.current() + summonCount) <= currentBuyableSeekers,
			"Not enough Seekers available");

		for (uint256 i = 0; i < summonCount; i++) {
			_seekerId.increment();
			mintSeeker(msg.sender, _seekerId.current(), false);
		}
	}

	function birthSeeker(address to) external onlyGame {
		require(
			_internalId.current() < MAXSEEKERS,
			"Looks like we already minted all the seekers"
		);
		_internalId.increment();
		mintSeeker(to, _internalId.current(), true);
	}

	function mintSeeker(address to,	uint256 id,	bool wasSeizure) internal {
		// Initialize Attributes for new Seeker
		Attributes memory cloakedAttributes = Attributes(
			false,
			"",
			0,
			0,
			0,
			0,
			0,
			address(0)
		); // Initialize all attributes to "hidden" values
		attributesBySeekerId[id] = cloakedAttributes;

		isSeekerCloaked[id] = true; // All Seekers begin cloaked

		// Seekers born from having held the Coinlander get special props
		if (wasSeizure) {
			attributesBySeekerId[id].bornFromCoin = true;
			attributesBySeekerId[id].scales += 1;
		}

		_safeMint(to, id);
	}


	//////////////////////////////////////////////////////////////////////////////////////////////////
	//                                                                                              //
	//                             EXTERNALLY CALLABLE TOKEN METHODS                                //
	//                                                                                              //
	//////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	* @dev This determinstically leaves a gap in returned array if we haven't reached Sweet Release
	* It will also not de-dup address with multiple tokens. The upshot is that it can be used to know 
	* who has which id via array index. 
	*/ 
	function allSeekerOwners() external view returns (address[] memory) {
		address[] memory _allTokenOwners = new address[](_internalId.current());
		for (uint256 i = 0; i < _seekerId.current(); ++i) {
			_allTokenOwners[i] = ownerOf(i + 1);
		}
		for (uint256 i = INTERNALIDOFFSET; i < _internalId.current(); i++) {
			_allTokenOwners[i] = ownerOf(i + 1);
		}

		return _allTokenOwners;
	}

	function getSeekerCount() external view returns (uint256) {
		uint256 seizureSeekers = _internalId.current() - INTERNALIDOFFSET;
		return _seekerId.current() + seizureSeekers;
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//                                                                                              //
	//                             EXTERNALLY CALLABLE GAME EVENTS                                  //
	//                                                                                              //
	//////////////////////////////////////////////////////////////////////////////////////////////////

	function activateFirstMint() external onlyGame {
		require(firstMintActive == false, "Already active");
		firstMintActive = true;
		emit firstMintActivated();
		currentBuyableSeekers += FIRSTMINT;
		currentPrice = FIRSTMINTPRICE;
	}

	function activateSecondMint() external onlyGame {
		require(secondMintActive == false, "Already active");
		secondMintActive = true;
		emit secondMintActivated();
		currentBuyableSeekers += SECONDMINT;
		currentPrice = SECONDMINTPRICE;
	}

	function activateThirdMint() external onlyGame {
		require(thirdMintActive == false, "Already active");
		thirdMintActive = true;
		emit thirdMintActivated();
		currentBuyableSeekers += THIRDMINT;
		currentPrice = THIRDMINTPRICE;
	}

	function performUncloaking() external onlyGame {
		uncloaking = true;
	}

	modifier onlyAfterUncloaking() {
		require(uncloaking == true, "only possible after uncloaking ceremony");
		_;
	}



	//////////////////////////////////////////////////////////////////////////////////////////////////
	//                                                                                              //
	//                           EXTERNALLY CALLABLE PLAYER ACTIONS                                 //
	//                                                                                              //
	//////////////////////////////////////////////////////////////////////////////////////////////////

	function uncloakSeeker(uint256 id) external onlyAfterUncloaking {
		require(isSeekerCloaked[id], "Seeker has already been revealed");
		require(msg.sender == ownerOf(id), "Must own a Seeker to uncloak it");

		string memory _alignment = _getAlignment();

		uint256[4] memory _APs = _getAP(id);

		isSeekerCloaked[id] = false; // Uncloaks the Seeker permanently

		Attributes memory revealedAttributes = Attributes(
			attributesBySeekerId[id].bornFromCoin, // Dont change how the Seeker was created
			_alignment, // Sets the alignment
			_APs[0], // Alpha
			_APs[1], // Beta
			_APs[2], // Detla
			_APs[3], // Gamma
			attributesBySeekerId[id].scales,
			attributesBySeekerId[id].clan
		); // Dont change the number of scales
		attributesBySeekerId[id] = revealedAttributes;
	}

	function addScales(uint256 id, uint256 scales) external onlyGame {
		require(ownerOf(id) != address(0), "Seeker must exist to be granted scales");
		require(scales > 0, "Not adding any scales!");
		// @QUESTION should we explicitly check to make sure that they own the seeker theyre adding scales to?
		uint256 _scales = attributesBySeekerId[id].scales;
		if ((_scales + scales) >  MAXPIXELS) {
			attributesBySeekerId[id].scales = MAXPIXELS;
		}
		else {
			attributesBySeekerId[id].scales += scales;
		}
	}

	function declareForClan(uint id, address clanAddress) external {
		require(msg.sender == ownerOf(id), "Must own a Seeker to decalre for a clan");
		require(clanAddress == address(clanAddress), "Invalid address provided");
		
		attributesBySeekerId[id].clan = clanAddress;
		emit seekerDeclaredToClan(id,clanAddress);
	}


	//////////////////////////////////////////////////////////////////////////////////////////////////
	//                                                                                              //
	//                                  ATTRIBUTES AND METADATA                                     //
	//                                                                                              //
	//////////////////////////////////////////////////////////////////////////////////////////////////

	function _baseURI() internal view virtual override returns (string memory) {
		return _baseTokenURI;
	}

	function setBaseURI(string memory baseTokenURI) public virtual onlyKeepers {
		_baseTokenURI = baseTokenURI;
	}

	function _getAlignment() internal view returns (string memory) {
		uint256 mod = alignment.length;
		return _pluck(mod, alignment);
	}

	function _getAP(uint256 id) internal view returns (uint256[4] memory) {
		uint256 minAP = 70; // Min possible sum of all attribute points
		uint256 maxAP = 85; // Max possible sum of all attribute points
		uint256 minSingle = 17; // Min possible single value
		uint256 maxSingle = 25; // Max possible single value
		uint256 sumAP = minAP;

		if (attributesBySeekerId[id].bornFromCoin) {
			// Those born from the coin are deterministically stronger
			sumAP = minAP + _getRandomNumber(maxAP - (minAP + COINAPOFFSET));
            minSingle = 20; // Buff the minimum stat value
		} else {
			sumAP = minAP + _getRandomNumber(maxAP - minAP);
		}

        // Determine 4 random attribute points
        uint256 range = maxSingle - minSingle; 
		uint256 ap1 = minSingle + _getRandomNumber(range);
		uint256 ap2 = minSingle + _getRandomNumber(range);
		uint256 ap3 = minSingle + _getRandomNumber(range);
		uint256 ap4 = sumAP - ap1 - ap2 - ap3;

        // Shuffle them 
		uint256[4] memory aps = [ap1, ap2, ap3, ap4];
        for (uint256 i =0; i < aps.length; i++) {
            uint256 n = i + uint256(keccak256(abi.encodePacked(block.timestamp))) % (aps.length -i);
            uint256 temp = aps[n];
            aps[n] = aps[i];
            aps[i] = temp;
        }

		return aps;
	}

	function getBirthStatusById(uint256 id) external view returns (bool) {
		return attributesBySeekerId[id].bornFromCoin;
	}

	function getAlignmentById(uint256 id) external view returns (string memory) {
		string memory _alignment = attributesBySeekerId[id].alignment;
		return _alignment; 
	}

	function getApById(uint256 id) external view returns (uint256[4] memory) {
		uint256[4] memory _aps = [
			attributesBySeekerId[id].alpha,
			attributesBySeekerId[id].beta,
			attributesBySeekerId[id].gamma,
			attributesBySeekerId[id].delta];
		return _aps;
	}

	function getScaleCountById(uint256 id) external view returns (uint256) {
		return attributesBySeekerId[id].scales;
	}

	function getClanById(uint256 id) external view returns (address) {
		return attributesBySeekerId[id].clan;
	} 

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//                                                                                              //
	//                                  PSEUDORANDOMNESS MAFS                                       //
	//                                                                                              //
	//////////////////////////////////////////////////////////////////////////////////////////////////

	// Thanks Manny - entropy is a bitch
	function _getRandomNumber(uint256 mod) private view returns (uint256) {
		uint256 random = uint256(
			keccak256(
				abi.encodePacked(
					mod,
					blockhash(block.number - 1),
					block.coinbase,
					block.difficulty,
					msg.sender
				)
			)
		);

		return random % mod;
	}

	function _pluck(uint256 mod, string[] memory sourceArray) internal view returns (string memory) {
		uint256 rand = _getRandomNumber(mod);
		string memory output = sourceArray[rand % sourceArray.length];
		return output;
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//                                                                                              //
	//                                ACCESS CONTROL/PERMISSIONS                                    //
	//                                                                                              //
	//////////////////////////////////////////////////////////////////////////////////////////////////
	modifier onlyGame() {
		require(
			hasRole(GAME_ROLE, msg.sender),
			"Caller must be an approved game contract"
		);
		_;
	}

	modifier onlyKeepers() {
		require(
			hasRole(KEEPERS_ROLE, msg.sender),
			"Caller must be an approved Keeper"
		);
		_;
	}

	function addGameContract(address gameContract) public onlyKeepers {
		grantRole(GAME_ROLE, gameContract);
	}

	function addKeeper(address newKeeper) public onlyKeepers {
		grantRole(KEEPERS_ROLE, newKeeper);
	}

	// @TODO add remove role methods

	function supportsInterface(bytes4 interfaceId)
		public
		view
		virtual
		override(IERC165, ERC721Enumerable, AccessControl)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}
}
