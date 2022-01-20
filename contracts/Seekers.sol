// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/iSeekers.sol";
// import "hardhat/console.sol";

contract Seekers is ERC721Enumerable, iSeekers, AccessControl, ReentrancyGuard {
  // Access control setup
  bytes32 public constant KEEPERS_ROLE = keccak256("KEEPERS_ROLE"); // Role for Keepers
  bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE"); // Role for approved Coinlander game contracts

  // Counter inits
  uint256 private _summonSeekerId = 0; // Sale id tracker
  uint256 private _birthSeekerId = 0; // Internal id tracker

  // Minting params
  uint256 public constant MAXSEEKERS = 11111; 
  uint256 public currentBuyableSeekers = 0;
  uint256 public currentPrice = 0;
  uint256 private reserve = 0; // Contracts treasury balance
  uint256 private constant KEEPERSEEKERS = 32; // Number of Seekers that Keepers can mint for themselves
  uint256 private keepersSeekersMinted = 0;
  uint256 public constant MAXMINTABLE = 10; // Max seekers that can be purchased in one tx

  // Seeker release schedule
  // Activation for each will be called externally by the season 1 Coinlander contract
  uint256 public constant FIRSTMINT = 5000;
  bool public firstMintActive = false;
  uint256 public constant FIRSTMINTPRICE = 0.02 ether;
  uint256 public constant SECONDMINT = 3333;
  bool public secondMintActive = false;
  uint256 public constant SECONDMINTPRICE = 0.05 ether;
  uint256 public constant THIRDMINT = 1635;
  uint256 public constant THIRDMINT_INCR = 5;
  bool public thirdMintActive = false;
  uint256 public constant THIRDMINTPRICE = 0.1 ether;

  // This adds 2 because we are minting the winner_id = 1 and ids need to be 1 indexed
  uint256 private constant INTERNALIDOFFSET = FIRSTMINT + SECONDMINT + THIRDMINT + KEEPERSEEKERS + 2;

  // On-chain game parameters
  bool public released = false;
  bool public uncloaking = false;
  uint256 public constant MAXPIXELS = 1024; // 32x32 pixel grid
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
    uint16 dethscales;
  }

  mapping(uint256 => Attributes) attributesBySeekerId;

  // Off-chain metadata
  // @todo need to put a valid endpoint here 
  string private _baseTokenURI = "https://meta.coinlander.one/seekers/";

  // Alignment
  string[] private alignments = [
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
        _mintSeeker(msg.sender, _summonSeekerId, false);
    }
  }

  function birthSeeker(address to) external onlyGame returns (uint256) {
    require(_birthSeekerId < MAXSEEKERS);
    _birthSeekerId += 1;
    _mintSeeker(to, _birthSeekerId, true);
    return (_birthSeekerId);
  }

  function keepersSummonSeeker(uint256 summonCount) external nonReentrant onlyKeepers {
    require ((keepersSeekersMinted + summonCount) <= KEEPERSEEKERS);
    require((_summonSeekerId + summonCount) <= currentBuyableSeekers);
    keepersSeekersMinted += summonCount;

    for (uint256 i = 0; i < summonCount; i++) {
        _summonSeekerId += 1;
        _mintSeeker(msg.sender, _summonSeekerId, false);
    }
  }

  function _mintSeeker(address to,	uint256 id,	bool bornFromCoin) internal {

    // Born from coin grants a scale
    uint256 scales = 0;
    if (bornFromCoin) {
      scales = 1;
    }
    
    // Initialize all attributes to "hidden" values
    Attributes memory cloakedAttributes = Attributes(
        bornFromCoin,
        "",
        0,
        0,
        0,
        0,
        scales,
        address(0),
        uint16(0)
    ); 
    
    attributesBySeekerId[id] = cloakedAttributes;

    isSeekerCloaked[id] = true; // All Seekers begin cloaked

    _safeMint(to, id);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                             EXTERNALLY CALLABLE GAME EVENTS                                  //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  function activateFirstMint() external onlyGame {
    require(firstMintActive == false);
    firstMintActive = true;
    emit FirstMintActivated();
    currentBuyableSeekers += (FIRSTMINT + KEEPERSEEKERS);
    currentPrice = FIRSTMINTPRICE;
  }

  function activateSecondMint() external onlyGame {
    require(secondMintActive == false);
    secondMintActive = true;
    emit SecondMintActivated();
    currentBuyableSeekers += SECONDMINT;
    currentPrice = SECONDMINTPRICE;
  }

  function activateThirdMint() external onlyGame {
    require(thirdMintActive == false);
    thirdMintActive = true;
    emit ThirdMintActivated();
    currentBuyableSeekers += THIRDMINT_INCR;
    currentPrice = THIRDMINTPRICE;
  }

  function seizureMintIncrement() external onlyGame {
    currentBuyableSeekers += THIRDMINT_INCR;
  }

  function performUncloaking() external onlyGame {
    uncloaking = true;
    emit UncloakingAvailable();
  }

  function sendWinnerSeeker(address winner) external onlyGame {
    require(released == false);
    released = true;
    _setWinnerSeekerAttributes(1);
    _transfer(ownerOf(1), winner, 1);
  }



  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                           EXTERNALLY CALLABLE PLAYER ACTIONS                                 //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  function uncloakSeeker(uint256 id) external {
    require(uncloaking == true, "cant uncloak yet");
    require(isSeekerCloaked[id], "seeker already uncloaked");
    require(msg.sender == ownerOf(id), "must own seeker to reveal it");

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
        attributesBySeekerId[id].clan,
        uint16(0)
      ); 
    attributesBySeekerId[id] = revealedAttributes;

    uint16 _dethscales = _getDethScales(id);
    attributesBySeekerId[id].dethscales = _dethscales;

    emit SeekerUncloaked(id);
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
    emit ScalesAdded(id, scales, attributesBySeekerId[id].scales);
  }

  function declareForClan(uint id, address clanAddress) external {
    require(msg.sender == ownerOf(id));
    require(clanAddress == address(clanAddress));

    attributesBySeekerId[id].clan = clanAddress;
    emit SeekerDeclaredToClan(id,clanAddress);
  }


  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                                  INTERNAL ATTRIBUTES AND METADATA                            //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

  function _baseURI() internal view override returns (string memory) {
    return _baseTokenURI;
  }

  function setBaseURI(string memory baseTokenURI) public onlyKeepers {
    _baseTokenURI = baseTokenURI;
  }

  function _getAlignment() internal view returns (string memory) {
    uint256 mod = alignments.length;
    return _pluck(mod, alignments);
  }

  // Alignment axes are defined as a tuple which describes where on the 3x3 square the alignment lands
  // Good -> Evil :: 0 -> 2
  // Lawful -> Chaotic :: 0 -> 2
  function _getAlignmentAxes(uint256 id) internal view returns (uint256, uint256) {
    string memory seekerAlignment = attributesBySeekerId[id].alignment;
    string memory _alignment;
    for(uint256 i = 0; i < alignments.length; i++) {
      _alignment = alignments[i];
      if(keccak256(bytes(seekerAlignment)) == keccak256(bytes(_alignment))) {
        return ((i/3),(i % 3));
      }
    }
    return (0,0); // Default if alignment not set
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
    uint256 rangeSingle = maxSingle - minSingle;
    uint256 ap1 = minSingle + _getRandomNumber(rangeSingle,id);
    uint256 ap2 = minSingle + _getRandomNumber(rangeSingle,ap1);
    uint256 ap3 = minSingle + _getRandomNumber(rangeSingle,ap2);
    uint256 ap4 = minSingle + _getRandomNumber(rangeSingle,ap3);

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

  function _getDethScales(uint256 _id) internal view returns (uint16) {

    // Set fill density based on alignment 
    (uint256 x, ) = _getAlignmentAxes(_id); // Only need good/evil axis
    uint16 minDethScales;
    uint16 maxDethScales;
    if(x ==1) {
      minDethScales = 7; // Neutral case
      maxDethScales = 12;
    }
    else{
      minDethScales = 4; // Good and Evil cases
      maxDethScales = 8;
    }

    uint16 dethScaleRand = uint16(bytes2(keccak256(abi.encodePacked(
            _id,
            block.difficulty,
            block.number,
            msg.sender
            ))));

    uint16 _dethScales;
    uint16 move;
    uint16 range = maxDethScales - minDethScales;
    uint16 segBits = _getRandomNumber16(range, uint16(_id), dethScaleRand) + minDethScales;

    for(uint16 i = 0; i < segBits; i++) {
        move = _getRandomNumber16(16, i, dethScaleRand);
        _dethScales = (uint16(2) ** move) | _dethScales;
    }

    if(x==2){
      return ~_dethScales; // Invert for Evil
    }
    else {
      return _dethScales;
    }
  }
 
  function _setWinnerSeekerAttributes(uint256 id) internal {
    isSeekerCloaked[id] = false; // Uncloaks the Seeker permanently
    Attributes memory winningAttributes = Attributes(
        true, 
        "True Neutral",
        25, // Alpha
        25, // Beta
        25, // Detla
        25, // Gamma
        MAXPIXELS,
        attributesBySeekerId[id].clan,
        uint16(0)
      ); 
    attributesBySeekerId[id] = winningAttributes;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                                  EXTERNAL ATTRIBUTES AND METADATA                            //
  //                                                                                              //
  //////////////////////////////////////////////////////////////////////////////////////////////////

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

  function getDethscalesById(uint256 id) external view returns (uint16) {
    return attributesBySeekerId[id].dethscales;
  }

  function getCloakStatusById(uint256 id) external view returns (bool) {
    return isSeekerCloaked[id];
  }

  function getFullCloak(uint256 id) external view returns (uint32[32] memory) {
    require(!isSeekerCloaked[id]);
    uint16 _dethscales = attributesBySeekerId[id].dethscales;

    // Set noise based on alignment
    ( ,uint256 y) = _getAlignmentAxes(id); // Only need lawful/chaotic axis
    uint16 minNoiseBits;
    uint16 maxNoiseBits;
    if ( y == 0) { // Lawful
      minNoiseBits = 0;
      maxNoiseBits = 16;
    }
    if (y == 1) { // Neutral
      minNoiseBits = 16;
      maxNoiseBits = 32;
    }
    else { // Chaotic
      minNoiseBits = 32;
      maxNoiseBits = 64;
    }

    uint32[32] memory fullCloak;
    // Because solidity doesn't have a native way to handle 4-bit values, 
    // we construct an entire row out of each primitive
    //
    // EXAMPLE
    // uint16 dethscale = 1001 0110 1100 0001
    //
    //  Primitives:
    //   r1'  r2'  r3'  r4'
    //  1001 0110 1100 0001
    // 
    //  Full Rows: 
    // uint32 r1 = 1001 1001 ,,, 1001 
    // uint32 r2 = 0110 0110 ,,, 0110 
    // uint32 r3 = 1100 1100 ,,, 1100
    // uint32 r4 = 0001 0001 ,,, 0001

    uint32 input = uint32(_dethscales);
    uint32[4] memory rows;

    // r1
    rows[0] = (input >> 12) | 
      ((input >> 12) << 4) | 
      ((input >> 12) << 8) | 
      ((input >> 12) << 12) |
      ((input >> 12) << 16) |
      ((input >> 12) << 20) |
      ((input >> 12) << 24) |
      ((input >> 12) << 28);

    // r2
    rows[1] = (0xF & (input >> 8)) | 
      ((0xF & (input >> 8)) << 4) | 
      ((0xF & (input >> 8)) << 8) | 
      ((0xF & (input >> 8)) << 12) |
      ((0xF & (input >> 8)) << 16) |
      ((0xF & (input >> 8)) << 20) |
      ((0xF & (input >> 8)) << 24) |
      ((0xF & (input >> 8)) << 28);

    // r3
    rows[2] = (0xF & (input >> 4)) | 
      ((0xF & (input >> 4)) << 4) | 
      ((0xF & (input >> 4)) << 8) | 
      ((0xF & (input >> 4)) << 12) |
      ((0xF & (input >> 4)) << 16) |
      ((0xF & (input >> 4)) << 20) |
      ((0xF & (input >> 4)) << 24) |
      ((0xF & (input >> 4)) << 28);
    
    // r4
    rows[3] = (0xF & input) | 
      ((0xF & input) << 4) | 
      ((0xF & input) << 8) | 
      ((0xF & input) << 12) |
      ((0xF & input) << 16) |
      ((0xF & input) << 20) |
      ((0xF & input) << 24) |
      ((0xF & input) << 28);

    // Build full cloak from rows 
    for(uint16 i = 0; i < fullCloak.length; i++) {
        fullCloak[i] = rows[i % 4]; 
    }
    // Deterministically add noise 
    uint16 noiseBits = _getRandomNumber16((maxNoiseBits - minNoiseBits), _dethscales, maxNoiseBits) + minNoiseBits;
    for (uint16 i = 0; i < noiseBits; i++) {
      uint16 noiseCol = _getRandomNumber16(32, _dethscales, i);
      uint16 noiseRow = _getRandomNumber16(32, noiseCol, i);
      fullCloak[noiseRow] = (uint32(2) ** noiseCol) ^ fullCloak[noiseRow];
    }
    return fullCloak;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                              //
  //                                  PSEUDORANDOMNESS & MAFS                                     //
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

  function _getRandomNumber16(uint16 mod, uint16 r1, uint16 r2) public pure returns (uint16) {
    uint16 seed = uint16(bytes2(keccak256(abi.encodePacked(r1, r2))));
    return seed % mod;
  }

  function _pluck(uint256 mod, string[] memory sourceArray) internal view returns (string memory) {
    uint256 rand = _getRandomNumber(mod,0);
    string memory output = sourceArray[rand % sourceArray.length];
    return output;
  }

  function _countSetBits(uint64 n) internal pure returns (uint64) {
      // base case
      if (n == 0) {
          return 0;
      }
      else {
          // if last bit set add 1 else add 0
          return (n & 1) + _countSetBits(n >> 1);
      }   
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

  receive() external payable {
    revert();
  }
}