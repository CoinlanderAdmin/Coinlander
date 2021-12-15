// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/iSeekers.sol";

contract Seekers is ERC721Enumerable, iSeekers, AccessControl, ReentrancyGuard {
  // Access control setup
  bytes32 public constant KEEPERS_ROLE = keccak256("KEEPERS_ROLE"); // Role for Keepers
  bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE"); // Role for approved Coinlander game contracts

  // Counter inits
  uint256 private _summonSeekerId = 0; // Sale id tracker
  uint256 private _birthSeekerId = 0; // Internal id tracker

  uint256 public constant MAXSEEKERS = 11111;
  bool public gameWon = false;
  uint256 public currentBuyableSeekers = 0;
  uint256 public currentPrice = 0;
  uint256 private reserve = 0; // Contracts treasury balance
  uint256 private constant KEEPERSEEKERS = 32; // Number of Seekers that Keepers can mint for themselves
  uint256 private keepersSeekersMinted = 0;
  uint256 public constant MAXMINTABLE = 10; // Max seekers that can be purchased in one tx
  uint16 public constant MAXPIXELS = 1024; // 32x32 pixel grid

  // Seeker release schedule
  // Activation for each will be called externally by the season 1 Coinlander contract
  uint256 public constant FIRSTMINT = 6117;
  bool public firstMintActive = false;
  uint256 public constant FIRSTMINTPRICE = 0.02 ether;
  uint256 public constant SECONDMINT = 3000;
  bool public secondMintActive = false;
  uint256 public constant SECONDMINTPRICE = 0.05 ether;
  uint256 public constant THIRDMINT = 1111;
  uint256 public constant THIRDMINT_INCR = 5;
  bool public thirdMintActive = false;
  uint256 public constant THIRDMINTPRICE = 0.1 ether;

  // This adds 2 because we are minting the winner_id = 1 and ids need to be 1 indexed
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

    _summonSeekerId += 1;
    _safeMint(msg.sender, _summonSeekerId); // Set aside id 1 for Season 1 winner

    _birthSeekerId = INTERNALIDOFFSET;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                                  MINTING AND SUCH                                            //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  function summonSeeker(uint256 summonCount) external payable nonReentrant {
    require(summonCount > 0 && summonCount <= MAXMINTABLE);
    require(msg.value >= (currentPrice * summonCount));
    require((_summonSeekerId + summonCount) <= currentBuyableSeekers);

    for (uint256 i = 0; i < summonCount; i++) {
        _summonSeekerId += 1;
        mintSeeker(msg.sender, _summonSeekerId, false);
    }
  }

  function birthSeeker(address to) external onlyGame returns (uint256) {
    require(_birthSeekerId < MAXSEEKERS);
    _birthSeekerId += 1;
    mintSeeker(to, _birthSeekerId, true);
    emit seekerBornFromCoin(_birthSeekerId, to);
    return (_birthSeekerId);
  }

  function keepersSummonSeeker(uint256 summonCount) external nonReentrant onlyKeepers {
    require ((keepersSeekersMinted + summonCount) <= KEEPERSEEKERS);
    require((_summonSeekerId + summonCount) <= currentBuyableSeekers);
    keepersSeekersMinted += summonCount;

    for (uint256 i = 0; i < summonCount; i++) {
        _summonSeekerId += 1;
        mintSeeker(msg.sender, _summonSeekerId, false);
    }
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
    address[] memory _allTokenOwners = new address[](_birthSeekerId);
    for (uint256 i = 0; i < _summonSeekerId; ++i) {
        _allTokenOwners[i] = ownerOf(i + 1);
    }
    for (uint256 i = INTERNALIDOFFSET; i < _birthSeekerId; i++) {
        _allTokenOwners[i] = ownerOf(i + 1);
    }

    return _allTokenOwners;
  }

  function getSeekerCount() external view returns (uint256) {
    uint256 seizureSeekers = _birthSeekerId - INTERNALIDOFFSET;
    return _summonSeekerId + seizureSeekers;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                             EXTERNALLY CALLABLE GAME EVENTS                                  //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  function activateFirstMint() external onlyGame {
    require(firstMintActive == false);
    firstMintActive = true;
    emit firstMintActivated();
    currentBuyableSeekers += FIRSTMINT;
    currentPrice = FIRSTMINTPRICE;
  }

  function activateSecondMint() external onlyGame {
    require(secondMintActive == false);
    secondMintActive = true;
    emit secondMintActivated();
    currentBuyableSeekers += SECONDMINT;
    currentPrice = SECONDMINTPRICE;
  }

  function activateThirdMint() external onlyGame {
    require(thirdMintActive == false);
    thirdMintActive = true;
    emit thirdMintActivated();
    currentBuyableSeekers += THIRDMINT_INCR;
    currentPrice = THIRDMINTPRICE;
  }

  function seizureMintIncrement() external onlyGame {
    currentBuyableSeekers += THIRDMINT_INCR;
  }

  function performUncloaking() external onlyGame {
    uncloaking = true;
  }

  function sendWinnerSeeker(address winner) external onlyGame {
    require(gameWon == false);
    gameWon = true;
    _transfer(ownerOf(1), winner, 1);
  }



  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                           EXTERNALLY CALLABLE PLAYER ACTIONS                                 //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  function uncloakSeeker(uint256 id) external {
    require(uncloaking == true);
    require(isSeekerCloaked[id]);
    require(msg.sender == ownerOf(id));

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
      ); 
    attributesBySeekerId[id] = revealedAttributes;
  }

  function addScales(uint256 id, uint256 scales) external onlyGame {
    require(ownerOf(id) != address(0));
    require(scales > 0);
    uint256 _scales = attributesBySeekerId[id].scales;
    if ((_scales + scales) >  MAXPIXELS) {
        attributesBySeekerId[id].scales = MAXPIXELS;
    }
    else {
        attributesBySeekerId[id].scales += scales;
    }
  }

  function declareForClan(uint id, address clanAddress) external {
    require(msg.sender == ownerOf(id));
    require(clanAddress == address(clanAddress));

    attributesBySeekerId[id].clan = clanAddress;
    emit seekerDeclaredToClan(id,clanAddress);
  }


  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                                  ATTRIBUTES AND METADATA                                     //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  function _baseURI() internal view override returns (string memory) {
    return _baseTokenURI;
  }

  function setBaseURI(string memory baseTokenURI) public onlyKeepers {
    _baseTokenURI = baseTokenURI;
  }

  function _getAlignment() internal view returns (string memory) {
    uint256 mod = alignment.length;
    return _pluck(mod, alignment);
  }

  function _getAP(uint256 id) internal view returns (uint256[4] memory) {
    uint256 minSingle = 17;
    uint256 maxSingle = 23;

    // Those born from the Coin are deterministically stronger 
    if (attributesBySeekerId[id].bornFromCoin) {
        minSingle = 20; 
        maxSingle = 25; 
    }

    // Determine 4 random attribute points
    uint256 range = maxSingle - minSingle;
    uint256 ap1 = minSingle + _getRandomNumber(range,id);
    uint256 ap2 = minSingle + _getRandomNumber(range,ap1);
    uint256 ap3 = minSingle + _getRandomNumber(range,ap2);
    uint256 ap4 = minSingle + _getRandomNumber(range,ap3);

    // Shuffle them
    uint256[4] memory aps = [ap1, ap2, ap3, ap4];
    for (uint256 i = 0; i < aps.length; i++) {
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
        attributesBySeekerId[id].delta
        ];
    return _aps;
  }

  function getScaleCountById(uint256 id) external view returns (uint256) {
    return attributesBySeekerId[id].scales;
  }

  function getClanById(uint256 id) external view returns (address) {
    return attributesBySeekerId[id].clan;
  }

  function getCloakStatusById(uint256 id) external view returns (bool) {
    return isSeekerCloaked[id];
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                                  PSEUDORANDOMNESS MAFS                                       //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  // Thanks Manny - entropy is a bitch
  function _getRandomNumber(uint256 mod, uint256 r) private view returns (uint256) {
    uint256 random = uint256(
      keccak256(
        abi.encodePacked(
          mod,
          r,
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
    uint256 rand = _getRandomNumber(mod,0);
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
      hasRole(GAME_ROLE, msg.sender));
    _;
  }

  modifier onlyKeepers() {
    require(
      hasRole(KEEPERS_ROLE, msg.sender));
    _;
  }

  function ownerWithdraw() external payable onlyKeepers{
    require(reserve > 0);
    uint256 amount = reserve;
    reserve = 0;
    payable(msg.sender).transfer(amount);
  }

  function addGameContract(address gameContract) public onlyKeepers {
    grantRole(GAME_ROLE, gameContract);
  }

  function addKeeper(address newKeeper) public onlyKeepers {
    grantRole(KEEPERS_ROLE, newKeeper);
  }

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
