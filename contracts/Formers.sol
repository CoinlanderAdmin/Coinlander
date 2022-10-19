// SPDX-License-Identifier: UNLICENSED
// Author: @stevieraykatz
// https://github.com/coinlander/Coinlander

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/ICloak.sol";

contract Formers is ERC721Enumerable, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Init
    ICloak cloak;
    struct Attributes {
        string alignment;
        uint8 alpha;
        uint8 beta;
        uint8 delta;
        uint8 gamma;
        uint16 seed;
        address clan;
        bytes32 provenance;
    }

    // State
    Counters.Counter private tokenCounter;
    mapping(uint256 => Attributes) attributesByTokenId;
    mapping(address => bool) claimedByAddr;
    bytes32 public WLMerkleRoot;
    bool public isPublicClaimActive;
    bool public isCommunityClaimActive;
    bool public isProvenanceSetActive = true;

    // Off-chain metadata
    string private _contractURI = "https://api.coinlander.one/meta/formers";
    string private _baseTokenURI = "https://api.coinlander.one/meta/formers/";

    // Constants
    uint256 constant maxSupply = 10_000;
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

    constructor(address CloakLibAddr) ERC721("Coinlander: Citizens", "CTZEN") {
        // Attach contract to Cloak lib
        cloak = ICloak(CloakLibAddr);
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                              //
    //                                  EVENTS                                                      //
    //                                                                                              //
    //////////////////////////////////////////////////////////////////////////////////////////////////

    event ProvenanceSet(uint256 id, bytes32 provenance);
    event AdminChange();
    event CitizenDeclaredToClan(uint256 id, address clanAddr);

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                              //
    //                                  MODIFIERS                                                   //
    //                                                                                              //
    //////////////////////////////////////////////////////////////////////////////////////////////////

    modifier isValidMerkleProof(bytes32[] calldata merkleProof, bytes32 root) {
        require(
            MerkleProof.verify(
                merkleProof,
                root,
                keccak256(abi.encodePacked(msg.sender))
            ),
            "E-003-001"
        );
        _;
    }

    modifier publicClaimActive() {
        require(isPublicClaimActive, "E-003-002");
        _;
    }

    modifier communityClaimActive() {
        require(isCommunityClaimActive, "E-003-003");
        _;
    }

    modifier provenanceSetActive() {
        require(isProvenanceSetActive, "E-003-004");
        _;
    }

    modifier canClaim() {
        require(!claimedByAddr[msg.sender], "E-003-005");
        _;
    }

    modifier EOAOnly() {
        require(tx.origin == msg.sender, "E-003-006");
        _;
    }

    modifier onlyTokenOwner(uint256 id) {
        require(msg.sender == ownerOf(id), "E-003-007");
        _;
    }

    modifier tokensAvailable() {
        require(tokenCounter.current() < maxSupply, "E-003-008");
        _;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                              //
    //                                  EXTERNAL METHODS                                            //
    //                                                                                              //
    //////////////////////////////////////////////////////////////////////////////////////////////////

    function wlClaim(bytes32[] calldata merkleProof)
        external
        nonReentrant
        EOAOnly
        communityClaimActive
        canClaim
        isValidMerkleProof(merkleProof, WLMerkleRoot)
        tokensAvailable
    {
        claimedByAddr[msg.sender] = true;
        _mint(_nextTokenId());
    }

    function publicClaim()
        external
        nonReentrant
        EOAOnly
        publicClaimActive
        canClaim
        tokensAvailable
    {
        claimedByAddr[msg.sender] = true;
        _mint(_nextTokenId());
    }

    function setProvenance(uint256 id, bytes32 _provenance)
        external
        onlyTokenOwner(id)
        provenanceSetActive
    {
        require(
            attributesByTokenId[id].provenance == bytes32(0),
            "E-003-009"
        );
        attributesByTokenId[id].provenance = _provenance;

        emit ProvenanceSet(id, _provenance);
    }

    function declareForClan(uint256 id, address clanAddress) 
        external 
        onlyTokenOwner(id)
        {
        require(clanAddress == address(clanAddress), "E-003-010");

        attributesByTokenId[id].clan = clanAddress;
        emit CitizenDeclaredToClan(id, clanAddress);
    }


    //////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                              //
    //                                  INTERNAL METHODS                                            //
    //                                                                                              //
    //////////////////////////////////////////////////////////////////////////////////////////////////
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _nextTokenId() private returns (uint256) {
        tokenCounter.increment();
        return tokenCounter.current();
    }

    function _mint(uint256 id) private {
        _safeMint(msg.sender, id);
        _setAttributes(id);
    }

    function _setAttributes(uint256 id) private {
        string memory _alignment = _pluck(alignments.length, alignments);

        uint8[4] memory _APs = _getAP(id);

        Attributes memory revealedAttributes = Attributes(
            _alignment, // Sets the alignment
            _APs[0], // Alpha
            _APs[1], // Beta
            _APs[2], // Detla
            _APs[3], // Gamma
            uint16(0),
            address(0),
            ""
        );
        attributesByTokenId[id] = revealedAttributes;

        uint16 _seed = _getSeed(id);
        attributesByTokenId[id].seed = _seed;
    }

    function _getAP(uint256 id) internal view returns (uint8[4] memory) {
        uint256 minSingle = 5;
        uint256 maxSingle = 12;

        // Determine 4 random attribute points
        uint256 rangeSingle = maxSingle - minSingle + 1;
        uint8 ap1 = uint8(minSingle + _getRandomNumber(rangeSingle, id + 1));
        uint8 ap2 = uint8(minSingle + _getRandomNumber(rangeSingle, id + 2));
        uint8 ap3 = uint8(minSingle + _getRandomNumber(rangeSingle, id + 3));
        uint8 ap4 = uint8(minSingle + _getRandomNumber(rangeSingle, id + 4));
        uint8[4] memory aps = [ap1, ap2, ap3, ap4];

        // Shuffle them
        for (uint256 i = 0; i < aps.length; i++) {
            uint256 n = i +
                (uint256(keccak256(abi.encodePacked(block.timestamp))) %
                    (aps.length - i));
            uint8 temp = aps[n];
            aps[n] = aps[i];
            aps[i] = temp;
        }

        return aps;
    }

    function _getSeed(uint256 _id) internal view returns (uint16) {
        // Set fill density based on alignment
        (uint256 x, ) = _getAlignmentAxes(_id); // Only need good/evil axis
        uint16 min;
        uint16 max;
        if (x == 1) {
            min = 7; // Neutral case
            max = 12;
        } else {
            min = 4; // Good and Evil cases
            max = 8;
        }
        uint16 rand = uint16(_getRandomNumber(2**16, _id));
        uint16 _seed = cloak.getDethscales(
            min,
            max,
            attributesByTokenId[_id].seed,
            rand
        );
        return _seed;
    }

    // Alignment axes are defined as a tuple which describes where on the 3x3 square the alignment lands
    // Good -> Evil :: 0 -> 2
    // Lawful -> Chaotic :: 0 -> 2
    function _getAlignmentAxes(uint256 id)
        internal
        view
        returns (uint256, uint256)
    {
        string memory seekerAlignment = attributesByTokenId[id].alignment;
        string memory _alignment;
        for (uint256 i = 0; i < alignments.length; i++) {
            _alignment = alignments[i];
            if (
                keccak256(bytes(seekerAlignment)) ==
                keccak256(bytes(_alignment))
            ) {
                return ((i / 3), (i % 3));
            }
        }
        return (0, 0); // Default if alignment not set
    }

    function _getRandomNumber(uint256 mod, uint256 r)
        private
        view
        returns (uint256)
    {
        uint256 random = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.timestamp,
                    msg.sender,
                    mod,
                    r
                )
            )
        );

        return random % mod;
    }

    function _pluck(uint256 mod, string[] memory sourceArray)
        internal
        view
        returns (string memory)
    {
        uint256 rand = _getRandomNumber(mod, 0);
        string memory output = sourceArray[rand % sourceArray.length];
        return output;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                              //
    //                                  VIEW METHODS                                                //
    //                                                                                              //
    //////////////////////////////////////////////////////////////////////////////////////////////////

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    function getAlignmentById(uint256 id)
        external
        view
        returns (string memory)
    {
        string memory _alignment = attributesByTokenId[id].alignment;
        return _alignment;
    }

    function getApById(uint256 id) external view returns (uint8[4] memory) {
        uint8[4] memory _aps = [
            attributesByTokenId[id].alpha,
            attributesByTokenId[id].beta,
            attributesByTokenId[id].gamma,
            attributesByTokenId[id].delta
        ];
        return _aps;
    }

    function getClanById(uint256 id) external view returns (address) {
        return attributesByTokenId[id].clan;
    }

    function getSeedById(uint256 id) external view returns (uint16) {
        return attributesByTokenId[id].seed;
    }

    function getFullBytes(uint256 id)
        external
        view
        returns (uint32[32] memory)
    {
        uint16 _seed = attributesByTokenId[id].seed;

        // Set noise based on alignment
        (, uint256 y) = _getAlignmentAxes(id); // Only need lawful/chaotic axis
        uint16 minNoiseBits;
        uint16 maxNoiseBits;
        if (y == 0) {
            // Lawful
            minNoiseBits = 0;
            maxNoiseBits = 16;
        }
        if (y == 1) {
            // Neutral
            minNoiseBits = 16;
            maxNoiseBits = 32;
        } else {
            // Chaotic
            minNoiseBits = 32;
            maxNoiseBits = 96;
        }

        return cloak.getFullCloak(minNoiseBits, maxNoiseBits, _seed);
    }

    function getProvenanceById(uint256 id) external view returns(bytes32) {
        return attributesByTokenId[id].provenance;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                              //
    //                                  ADMIN                                                       //
    //                                                                                              //
    //////////////////////////////////////////////////////////////////////////////////////////////////

    function setIsPublicClaimActive(bool _isPublicClaimActive)
        external
        onlyOwner
    {
        isPublicClaimActive = _isPublicClaimActive;
        emit AdminChange();
    }

    function setIsCommunityClaimActive(bool _isCommunityClaimActive)
        external
        onlyOwner
    {
        isCommunityClaimActive = _isCommunityClaimActive;
        emit AdminChange();
    }

    function setProvenanceActive(bool _isProvenanceSetActive)
        external
        onlyOwner
    {
        isProvenanceSetActive = _isProvenanceSetActive;
        emit AdminChange();
    }

    function setListMerkleRoot(bytes32 merkleRoot) external onlyOwner {
        WLMerkleRoot = merkleRoot;
        emit AdminChange();
    }

    function setBaseURI(string memory baseTokenURI) public onlyOwner {
        _baseTokenURI = baseTokenURI;
        emit AdminChange();
    }

    function setContractURI(string calldata newContractURI)
        external
        onlyOwner
    {
        _contractURI = newContractURI;
        emit AdminChange();
    }
    
    function ownerWithdraw() external payable onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }
}
