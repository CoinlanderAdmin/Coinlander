//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/// @title An Auction Contract for bidding and selling single and batched NFTs, based on Avo Labs impl
/// @author Avo Labs GmbH, @stevieraykatz
/// @notice This contract can be used for auctioning NFTs from ERC1155 contracts 
contract ERC1155Marketplace is Ownable {

    // Token contract -> token id -> seller -> Auction
    mapping(address => mapping(uint256 => mapping(address => Auction))) public nftContractAuctions;
    mapping(address => uint256) failedTransferCredits;
    //Each Auction is unique to each token batch (contract + id + seller).
    struct Auction {
        //map token ID to
        uint256 tokenQty;
        uint32 bidIncreasePercentage;
        uint32 auctionBidPeriod; //Increments the length of time the auction is open in which a new bid can be made after each bid.
        uint64 auctionEnd;
        uint128 minPrice;
        uint128 buyNowPrice;
        uint128 nftHighestBid;
        address nftHighestBidder;
        address whitelistedBuyer; //The seller can specify a whitelisted address for a sale (this is effectively a direct sale).
        address nftRecipient; //The bidder can specify a recipient for the NFT if their bid is successful.
        address feeRecipient;
        uint32 feePercentage;
    }

    /*
     * Default values that are used if not specified by the NFT seller.
     */
    uint32 public defaultBidIncreasePercentage;
    uint32 public minimumSettableIncreasePercentage;
    uint32 public maximumMinPricePercentage;
    uint32 public defaultAuctionBidPeriod;
    uint32 public defaultFeePercentage;
    address public defaultFeeCollector; 

    /*╔═════════════════════════════╗
      ║           EVENTS            ║
      ╚═════════════════════════════╝*/

    event NftAuctionCreated(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        uint256 tokenQuantity,
        uint128 minPrice,
        uint128 buyNowPrice,
        uint32 auctionBidPeriod,
        uint32 bidIncreasePercentage,
        address feeRecipient,
        uint32 feePercentage
    );

    event SaleCreated(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        uint256 tokenQuantity,
        uint128 buyNowPrice,
        address whitelistedBuyer,
        address feeRecipient,
        uint32 feePercentage
    );

    event BidMade(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        address bidder,
        uint256 ethAmount
    );

    event AuctionPeriodUpdated(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        uint64 auctionEndPeriod
    );

    event NFTTransferredAndSellerPaid(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        uint256 tokenQuantity,
        uint128 nftHighestBid,
        address nftHighestBidder,
        address nftRecipient
    );

    event AuctionSettled(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        address auctionSettler
    );

    event AuctionWithdrawn(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller
    );

    event BidWithdrawn(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        address highestBidder
    );

    event WhitelistedBuyerUpdated(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        address newWhitelistedBuyer
    );

    event MinimumPriceUpdated(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        uint256 newMinPrice
    );

    event BuyNowPriceUpdated(
        address nftContractAddress,
        uint256 tokenId,
        address nftSeller,
        uint128 newBuyNowPrice
    );
    event HighestBidTaken(
        address nftContractAddress, 
        uint256 tokenId,
        address nftSeller
    );

    /**********************************/
    /*╔═════════════════════════════╗
      ║          MODIFIERS          ║
      ╚═════════════════════════════╝*/

    modifier isAuctionNotStartedByOwner(address _nftContractAddress, uint256 _tokenId, address _nftSeller) {
        require(
            nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].tokenQty != 0,
            "Auction already started by owner");

        require(IERC1155(_nftContractAddress).balanceOf(msg.sender, _tokenId) > 0,
                "Sender doesn't own NFT");

            _resetAuction(_nftContractAddress, _tokenId, _nftSeller);
        _;
    }

    modifier auctionOngoing(address _nftContractAddress, uint256 _tokenId, address _nftSeller) {
        require(_isAuctionOngoing(_nftContractAddress, _tokenId, _nftSeller),
            "Auction has ended");
        _;
    }

    modifier priceGreaterThanZero(uint256 _price) {
        require(_price > 0, "Price cannot be 0");
        _;
    }

    /*
     * The minimum price must be 80% of the buyNowPrice(if set).
     */
    modifier minPriceDoesNotExceedLimit(uint128 _buyNowPrice, uint128 _minPrice) {
        require(_buyNowPrice == 0 ||
                _getPortionOfBid(_buyNowPrice, maximumMinPricePercentage) >= _minPrice,
                "MinPrice > 80% of buyNowPrice");
        _;  
    }

    modifier notNftSeller(address _nftSeller) {
        require(msg.sender != _nftSeller,
            "Owner cannot bid on own Auction");
        _;
    }

    modifier onlyNftSeller(address _nftSeller) {
        require(msg.sender == _nftSeller,
            "Only nft seller");
        _;
    }

    /*
     * The bid amount was either equal the buyNowPrice or it must be higher than the previous
     * bid by the specified bid increase percentage.
     */
    modifier bidAmountMeetsBidRequirements(address _nftContractAddress,uint256 _tokenId, address _nftSeller) {
        require(_doesBidMeetBidRequirements(_nftContractAddress, _tokenId, _nftSeller),
            "Not enough funds to bid on NFT");
        _;
    }

    // check if the highest bidder can purchase this NFT.
    modifier onlyApplicableBuyer(address _nftContractAddress, uint256 _tokenId, address _nftSeller) {
        require(!_isWhitelistedSale(_nftContractAddress, _tokenId, _nftSeller) ||
                nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].whitelistedBuyer == msg.sender,
            "Only the whitelisted buyer");
        _;
    }

    modifier minimumBidNotMade(address _nftContractAddress, uint256 _tokenId, address _nftSeller) {
        require(!_isMinimumBidMade(_nftContractAddress, _tokenId, _nftSeller),
            "The auction has a valid bid made");
        _;
    }

    modifier paymentAccepted() {
        require(msg.value != 0);
        _;
    }

    modifier isAuctionOver(address _nftContractAddress, uint256 _tokenId, address _nftSeller) {
        require(
            !_isAuctionOngoing(_nftContractAddress, _tokenId, _nftSeller),
            "Auction is not yet over"
        );
        _;
    }

    modifier notZeroAddress(address _address) {
        require(_address != address(0), "Cannot specify 0 address");
        _;
    }

    modifier increasePercentageAboveMinimum(uint32 _bidIncreasePercentage) {
        require(
            _bidIncreasePercentage >= minimumSettableIncreasePercentage,
            "Bid increase percentage too low"
        );
        _;
    }

    modifier isFeePercentagesLessThanMaximum(uint32 _feePercentage) {
        require(_feePercentage <= 10000, "Fee percentage exceeds 100%");
        _;
    }

    modifier isNotASale(address _nftContractAddress, uint256 _tokenId, address _nftSeller) {
        require(!_isASale(_nftContractAddress, _tokenId, _nftSeller),
            "Not applicable for a sale");
        _;
    }

    modifier sellerHasTokenBalance(address _nftContractAddress, uint256 _tokenId, address _nftSeller, uint256 _tokenQty) {
        require(
            IERC1155(_nftContractAddress).balanceOf(msg.sender, _tokenId) > _tokenQty,
            "Lister doesnt have enough tokens");
        _;
    }

    constructor() {
        defaultBidIncreasePercentage = 100;
        defaultAuctionBidPeriod = 86400; //1 day in sec
        minimumSettableIncreasePercentage = 100;
        maximumMinPricePercentage = 8000;
        defaultFeePercentage = 200; // 2% 
        defaultFeeCollector = msg.sender;
    }

    /*╔══════════════════════════════╗
      ║    AUCTION CHECK FUNCTIONS   ║
      ╚══════════════════════════════╝*/

    function _isAuctionOngoing(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        internal view returns (bool) {
        uint64 auctionEndTimestamp = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].auctionEnd;
        //if the auctionEnd is set to 0, the auction is technically on-going, however
        //the minimum bid price (minPrice) has not yet been met.
        return (auctionEndTimestamp == 0 || block.timestamp < auctionEndTimestamp);
    }

    /*
     * Check if a bid has been made. This is applicable in the early bid scenario
     * to ensure that if an auction is created after an early bid, the auction
     * begins appropriately or is settled if the buy now price is met.
     */
    function _isABidMade(address _nftContractAddress, uint256 _tokenId, address _nftSeller) internal view returns (bool) {
        return (nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBid > 0);
    }

    /*
     *if the minPrice is set by the seller, check that the highest bid meets or exceeds that price.
     */
    function _isMinimumBidMade(address _nftContractAddress, uint256 _tokenId, address _nftSeller) 
        internal view returns (bool) {

        uint128 minPrice = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].minPrice;
        return minPrice > 0 &&
            (nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBid >= minPrice);
    }

    /*
     * If the buy now price is set by the seller, check that the highest bid meets that price.
     */
    function _isBuyNowPriceMet(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        internal view returns (bool) {

        uint128 buyNowPrice = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].buyNowPrice;
        return buyNowPrice > 0 &&
            nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBid >= buyNowPrice;
    }

    /*
     * Check that a bid is applicable for the purchase of the NFT.
     * In the case of a sale: the bid needs to meet the buyNowPrice.
     * In the case of an auction: the bid needs to be a % higher than the previous bid.
     */
    function _doesBidMeetBidRequirements(address _nftContractAddress, uint256 _tokenId, address _nftSeller) 
        internal view returns (bool) {

        uint128 buyNowPrice = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].buyNowPrice;

        //if buyNowPrice is met, ignore increase percentage
        if (buyNowPrice > 0 && (msg.value >= buyNowPrice)) {
            return true;
        }

        //if the NFT is up for auction, the bid needs to be a % higher than the previous bid
        uint256 bidIncreaseAmount = (nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .nftHighestBid *
            (10000 + _getBidIncreasePercentage(_nftContractAddress, _tokenId, _nftSeller))) /
            10000;
        return (msg.value >= bidIncreaseAmount);
    }

    /*
     * An NFT is up for sale if the buyNowPrice is set, but the minPrice is not set.
     * Therefore the only way to conclude the NFT sale is to meet the buyNowPrice.
     */
    function _isASale(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        internal view returns (bool) {
        return (nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].buyNowPrice > 0 &&
            nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].minPrice == 0);
    }

    function _isWhitelistedSale(address _nftContractAddress, uint256 _tokenId, address _nftSeller) 
        internal view returns (bool) {
        return (nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .whitelistedBuyer != address(0));
    }

    /*
     * The highest bidder is allowed to purchase the NFT if
     * no whitelisted buyer is set by the NFT seller.
     * Otherwise, the highest bidder must equal the whitelisted buyer.
     */
    function _isHighestBidderAllowedToPurchaseNFT(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal view returns (bool) {
        return
            (!_isWhitelistedSale(_nftContractAddress, _tokenId, _nftSeller)) ||
            _isHighestBidderWhitelisted(_nftContractAddress, _tokenId, _nftSeller);
    }

    function _isHighestBidderWhitelisted(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal view returns (bool) {
        return (nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .nftHighestBidder ==
            nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
                .whitelistedBuyer);
    }

 
    /*
     * Returns the percentage of the total bid (used to calculate fee payments)
     */
    function _getPortionOfBid(uint256 _totalBid, uint256 _percentage)
        internal
        pure
        returns (uint256)
    {
        return (_totalBid * (_percentage)) / 10000;
    }


    /**********************************/
    /*╔══════════════════════════════╗
      ║    DEFAULT GETTER FUNCTIONS  ║
      ╚══════════════════════════════╝*/
    /*****************************************************************
     * These functions check if the applicable auction parameter has *
     * been set by the NFT seller. If not, return the default value. *
     *****************************************************************/

    function _getBidIncreasePercentage(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal view returns (uint32) {
        uint32 bidIncreasePercentage = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].bidIncreasePercentage;

        if (bidIncreasePercentage == 0) {
            return defaultBidIncreasePercentage;
        } else {
            return bidIncreasePercentage;
        }
    }

    function _getAuctionBidPeriod(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        internal
        view
        returns (uint32)
    {
        uint32 auctionBidPeriod = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].auctionBidPeriod;

        if (auctionBidPeriod == 0) {
            return defaultAuctionBidPeriod;
        } else {
            return auctionBidPeriod;
        }
    }

    /*
     * The default value for the NFT recipient is the highest bidder
     */
    function _getNftRecipient(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        internal
        view
        returns (address)
    {
        address nftRecipient = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].nftRecipient;

        if (nftRecipient == address(0)) {
            return
                nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
                    .nftHighestBidder;
        } else {
            return nftRecipient;
        }
    }

    /*╔══════════════════════════════╗
      ║  TRANSFER NFTS TO CONTRACT   ║
      ╚══════════════════════════════╝*/

    function _transferNftToAuctionContract(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal {
        uint256 _tokenQty = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].tokenQty;
        uint256 _contractBeforeBalance = IERC1155(_nftContractAddress).balanceOf(address(this), _tokenId);
        require(IERC1155(_nftContractAddress).balanceOf(_nftSeller, _tokenId) >= _tokenQty, 
            "seller doesn't own enough tokens");
        IERC1155(_nftContractAddress).safeTransferFrom(
            _nftSeller,
            address(this),
            _tokenId,
            _tokenQty,
            "0x0"
        );
        require(IERC1155(_nftContractAddress).balanceOf(address(this), _tokenId) > _contractBeforeBalance,
            "nft transfer failed");
    }

    /*╔══════════════════════════════╗
      ║       AUCTION CREATION       ║
      ╚══════════════════════════════╝*/

    /**
     * Setup parameters applicable to all auctions and whitelised sales:
     * -> token quantity: _tokenQty
     * -> minimum price : _minPrice
     * -> buy now price : _buyNowPrice
     * -> the nft seller: msg.sender
     * -> The fee recipients & their respective percentages for a sucessful auction/sale
     */
    function _setupAuction(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        uint256 _tokenQty,
        uint128 _minPrice,
        uint128 _buyNowPrice,
        address _feeRecipient,
        uint32 _feePercentage
    )
        internal
        minPriceDoesNotExceedLimit(_buyNowPrice, _minPrice)
        isFeePercentagesLessThanMaximum(_feePercentage)
    {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .tokenQty = _tokenQty;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .feeRecipient = _feeRecipient;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .feePercentage = _feePercentage;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .buyNowPrice = _buyNowPrice;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].minPrice = _minPrice;
    }

    function _createNewNftAuction(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        uint256 _tokenQty,
        uint128 _minPrice,
        uint128 _buyNowPrice,
        address _feeRecipient,
        uint32 _feePercentage
    ) internal {
        _setupAuction(
            _nftContractAddress,
            _tokenId,
            _nftSeller, 
            _tokenQty,
            _minPrice,
            _buyNowPrice,
            _feeRecipient,
            _feePercentage
        );
        emit NftAuctionCreated(
            _nftContractAddress,
            _tokenId,
            _nftSeller,
            _tokenQty,
            _minPrice,
            _buyNowPrice,
            _getAuctionBidPeriod(_nftContractAddress, _tokenId, _nftSeller),
            _getBidIncreasePercentage(_nftContractAddress, _tokenId, _nftSeller),
            _feeRecipient,
            _feePercentage
        );
        _updateOngoingAuction(_nftContractAddress, _tokenId, _nftSeller);
    }

    function createNewNftAuction(
        address _nftContractAddress,
        uint256 _tokenId,
        uint256 _tokenQty,
        uint128 _minPrice,
        uint128 _buyNowPrice,
        uint32 _auctionBidPeriod, 
        uint32 _bidIncreasePercentage
    )
        external
        isAuctionNotStartedByOwner(_nftContractAddress, _tokenId, msg.sender)
        priceGreaterThanZero(_minPrice)
        increasePercentageAboveMinimum(_bidIncreasePercentage)
        sellerHasTokenBalance(_nftContractAddress, _tokenId, msg.sender, _tokenQty)
    {
        nftContractAuctions[_nftContractAddress][_tokenId][msg.sender]
            .auctionBidPeriod = _auctionBidPeriod;
        nftContractAuctions[_nftContractAddress][_tokenId][msg.sender]
            .bidIncreasePercentage = _bidIncreasePercentage;
        _createNewNftAuction(
            _nftContractAddress,
            _tokenId,
            msg.sender,
            _tokenQty,
            _minPrice,
            _buyNowPrice,
            defaultFeeCollector,
            defaultFeePercentage
        );
    }

    /*╔══════════════════════════════╗
      ║            SALES             ║
      ╚══════════════════════════════╝*/

    /********************************************************************
     * Allows for a standard sale mechanism where the NFT seller can    *
     * can select an address to be whitelisted. This address is then    *
     * allowed to make a bid on the NFT. No other address can bid on    *
     * the NFT.                                                         *
     ********************************************************************/
    function _setupSale(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        uint256 _tokenQty,
        uint128 _buyNowPrice,
        address _whitelistedBuyer,
        address _feeRecipient,
        uint32 _feePercentage
    )
        internal

        isFeePercentagesLessThanMaximum(_feePercentage)
    {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .feeRecipient = _feeRecipient;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .feePercentage = _feePercentage;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .buyNowPrice = _buyNowPrice;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .whitelistedBuyer = _whitelistedBuyer;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .tokenQty = _tokenQty;
    }

    function createSale(
        address _nftContractAddress,
        uint256 _tokenId,
        uint256 _tokenQty,
        uint128 _buyNowPrice,
        address _whitelistedBuyer,
        address _feeRecipient,
        uint32 _feePercentage
    )
        external
        isAuctionNotStartedByOwner(_nftContractAddress, _tokenId, msg.sender)
        priceGreaterThanZero(_buyNowPrice)
    {
        //min price = 0
        _setupSale(
            _nftContractAddress,
            _tokenId,
            msg.sender,
            _tokenQty,
            _buyNowPrice,
            _whitelistedBuyer,
            _feeRecipient,
            _feePercentage
        );

        emit SaleCreated(
            _nftContractAddress,
            _tokenId,
            msg.sender,
            _tokenQty,
            _buyNowPrice,
            _whitelistedBuyer,
            _feeRecipient,
            _feePercentage
        );
        //check if buyNowPrice is met and conclude sale, otherwise reverse an early bid
        if (_isABidMade(_nftContractAddress, _tokenId, msg.sender)) {
            //we only revert the underbid if the seller specifies a different
            //whitelisted buyer to the highest bidder
            if (_isHighestBidderAllowedToPurchaseNFT(_nftContractAddress, _tokenId,msg.sender)) {
                if (_isBuyNowPriceMet(_nftContractAddress, _tokenId, msg.sender)) {
                    _transferNftToAuctionContract(_nftContractAddress, _tokenId, msg.sender);
                    _transferNftAndPaySeller(_nftContractAddress, _tokenId, msg.sender);
                }
            } else {
                _reverseAndResetPreviousBid(_nftContractAddress, _tokenId, msg.sender);
            }
        }
    }

    /*╔═════════════════════════════╗
      ║        BID FUNCTIONS        ║
      ╚═════════════════════════════╝*/

    /********************************************************************
     * Make bids with ETH                                              *
     * Additionally, a buyer can pay the asking price to conclude a sale*
     * of an NFT.                                                      *
     ********************************************************************/

    function _makeBid(address _nftContractAddress, uint256 _tokenId, address _nftSeller) internal
        notNftSeller(_nftSeller)
        paymentAccepted()
        bidAmountMeetsBidRequirements(
            _nftContractAddress,
            _tokenId,
            _nftSeller
        )
    {
        _reversePreviousBidAndUpdateHighestBid(
            _nftContractAddress,
            _tokenId,
            _nftSeller
        );
        emit BidMade(
            _nftContractAddress,
            _tokenId,
            _nftSeller,
            msg.sender,
            msg.value
        );
        _updateOngoingAuction(_nftContractAddress, _tokenId, _nftSeller);
    }

    function makeBid(address _nftContractAddress, uint256 _tokenId, address _nftSeller) external payable
        auctionOngoing(_nftContractAddress, _tokenId, _nftSeller)
        onlyApplicableBuyer(_nftContractAddress, _tokenId, _nftSeller)
    {
        _makeBid(_nftContractAddress, _tokenId, _nftSeller);
    }

    function makeCustomBid(address _nftContractAddress, uint256 _tokenId, address _nftSeller, address _nftRecipient)
        external
        payable
        auctionOngoing(_nftContractAddress, _tokenId, _nftSeller)
        notZeroAddress(_nftRecipient)
        onlyApplicableBuyer(_nftContractAddress, _tokenId, _nftSeller)
    {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .nftRecipient = _nftRecipient;
        _makeBid(_nftContractAddress, _tokenId, _nftSeller);
    }

    /*╔══════════════════════════════╗
      ║       UPDATE AUCTION         ║
      ╚══════════════════════════════╝*/

    /***************************************************************
     * Settle an auction or sale if the buyNowPrice is met or set  *
     *  auction period to begin if the minimum price has been met. *
     ***************************************************************/
    function _updateOngoingAuction(address _nftContractAddress, uint256 _tokenId, address _nftSeller) internal {
        if (_isBuyNowPriceMet(_nftContractAddress, _tokenId, _nftSeller)) {
            _transferNftToAuctionContract(_nftContractAddress, _tokenId, _nftSeller);
            _transferNftAndPaySeller(_nftContractAddress, _tokenId, _nftSeller);
            return;
        }
        //min price not set, nft not up for auction yet
        if (_isMinimumBidMade(_nftContractAddress, _tokenId, _nftSeller)) {
            _transferNftToAuctionContract(_nftContractAddress, _tokenId, _nftSeller);
            _updateAuctionEnd(_nftContractAddress, _tokenId, _nftSeller);
        }
    }

    function _updateAuctionEnd(address _nftContractAddress, uint256 _tokenId, address _nftSeller) internal {
        //the auction end is always set to now + the bid period
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].auctionEnd =
            _getAuctionBidPeriod(_nftContractAddress, _tokenId, _nftSeller) + uint64(block.timestamp);
        emit AuctionPeriodUpdated(_nftContractAddress, _tokenId, _nftSeller,
            nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].auctionEnd
        );
    }

    /*╔══════════════════════════════╗
      ║       RESET FUNCTIONS        ║
      ╚══════════════════════════════╝*/

    /*
     * Reset all auction related parameters for an NFT.
     * This effectively removes an NFT as an item up for auction
     */
    function _resetAuction(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        internal
    {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].tokenQty = 0;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].minPrice = 0;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].buyNowPrice = 0;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].auctionEnd = 0;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].auctionBidPeriod = 0;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .bidIncreasePercentage = 0;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .whitelistedBuyer = address(0);
    }

    /*
     * Reset all bid related parameters for an NFT.
     * This effectively sets an NFT as having no active bids
     */
    function _resetBids(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        internal
    {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .nftHighestBidder = address(0);
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBid = 0;
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .nftRecipient = address(0);
    }

    /*╔══════════════════════════════╗
      ║         UPDATE BIDS          ║
      ╚══════════════════════════════╝*/
    /******************************************************************
     * Internal functions that update bid parameters and reverse bids *
     * to ensure contract only holds the highest bid.                 *
     ******************************************************************/
    function _updateHighestBid(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
                .nftHighestBid = uint128(msg.value);
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .nftHighestBidder = msg.sender;
    }

    function _reverseAndResetPreviousBid(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal {
        address nftHighestBidder = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].nftHighestBidder;
        uint128 nftHighestBid = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].nftHighestBid;
        _resetBids(_nftContractAddress, _tokenId, _nftSeller);

        _payout(nftHighestBidder, nftHighestBid);
    }

    function _reversePreviousBidAndUpdateHighestBid(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal {
        address prevNftHighestBidder = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].nftHighestBidder;

        uint256 prevNftHighestBid = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].nftHighestBid;
        _updateHighestBid(_nftContractAddress, _tokenId, _nftSeller);

        if (prevNftHighestBidder != address(0)) {
            _payout(
                prevNftHighestBidder,
                prevNftHighestBid
            );
        }
    }

    /*╔══════════════════════════════╗
      ║  TRANSFER NFT & PAY SELLER   ║
      ╚══════════════════════════════╝*/

    function _transferNftAndPaySeller(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller
    ) internal {
        address _nftHighestBidder = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBidder;
        address _nftRecipient = _getNftRecipient(_nftContractAddress, _tokenId, _nftSeller);
        uint128 _nftHighestBid = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBid;
        uint256 _tokenQty = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].tokenQty;
        _resetBids(_nftContractAddress, _tokenId, _nftSeller);

        _payFeesAndSeller(
            _nftContractAddress,
            _tokenId,
            _nftSeller,
            _nftHighestBid
        );
        IERC1155(_nftContractAddress).safeTransferFrom(
            address(this),
            _nftRecipient,
            _tokenId,
            _tokenQty,
            "0x0"
        );

        _resetAuction(_nftContractAddress, _tokenId, _nftSeller);
        emit NFTTransferredAndSellerPaid(
            _nftContractAddress,
            _tokenId,
            _nftSeller,
            _tokenQty,
            _nftHighestBid,
            _nftHighestBidder,
            _nftRecipient
        );
    }

    function _payFeesAndSeller(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        uint256 _highestBid
    ) internal {

        uint256 fee = _getPortionOfBid(_highestBid,
                nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].feePercentage);

        _payout(nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].feeRecipient,fee);
        _payout(_nftSeller, (_highestBid - fee));
    }

    function _payout(address _recipient, uint256 _amount) internal {
        // attempt to send the funds to the recipient
        (bool success, ) = payable(_recipient).call{
            value: _amount,
            gas: 20000
        }("");
        // if it failed, update their credit balance so they can pull it later
        if (!success) {
            failedTransferCredits[_recipient] = failedTransferCredits[_recipient] + _amount;
        }
    }

    /*╔══════════════════════════════╗
      ║      SETTLE & WITHDRAW       ║
      ╚══════════════════════════════╝*/

    function settleAuction(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        external
        isAuctionOver(_nftContractAddress, _tokenId, _nftSeller)
    {
        _transferNftAndPaySeller(_nftContractAddress, _tokenId, _nftSeller);
        emit AuctionSettled(_nftContractAddress, _tokenId, _nftSeller, msg.sender);
    }

    function withdrawAuction(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        external
    {
        //only the NFT owner can prematurely close and auction
        require(_nftSeller == msg.sender, "Not Auction owner");
        _resetAuction(_nftContractAddress, _tokenId, _nftSeller);
        emit AuctionWithdrawn(_nftContractAddress, _tokenId, _nftSeller);
    }

    function withdrawBid(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        external
        minimumBidNotMade(_nftContractAddress, _tokenId, _nftSeller)
    {
        address nftHighestBidder = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBidder;
        require(msg.sender == nftHighestBidder, "Sender not highest bidder");

        uint128 nftHighestBid = nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].nftHighestBid;
        _resetBids(_nftContractAddress, _tokenId, _nftSeller);

        _payout(nftHighestBidder, nftHighestBid);

        emit BidWithdrawn(_nftContractAddress, _tokenId, _nftSeller, msg.sender);
    }

    /*╔══════════════════════════════╗
      ║       UPDATE AUCTION         ║
      ╚══════════════════════════════╝*/

    function updateWhitelistedBuyer(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        address _newWhitelistedBuyer
    ) external onlyNftSeller(_nftSeller) {
        require(_isASale(_nftContractAddress, _tokenId, _nftSeller), "Not a sale");
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .whitelistedBuyer = _newWhitelistedBuyer;
        //if an underbid is by a non whitelisted buyer,reverse that bid
        address nftHighestBidder = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].nftHighestBidder;
        uint128 nftHighestBid = nftContractAuctions[_nftContractAddress][_tokenId]
            [_nftSeller].nftHighestBid;
        if (nftHighestBid > 0 && !(nftHighestBidder == _newWhitelistedBuyer)) {
            //we only revert the underbid if the seller specifies a different
            //whitelisted buyer to the highest bider

            _resetBids(_nftContractAddress, _tokenId, _nftSeller);

            _payout(nftHighestBidder,nftHighestBid);
        }

        emit WhitelistedBuyerUpdated(
            _nftContractAddress,
            _tokenId,
            _nftSeller,
            _newWhitelistedBuyer
        );
    }

    function updateMinimumPrice(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        uint128 _newMinPrice
    )
        external
        onlyNftSeller(_nftSeller)
        minimumBidNotMade(_nftContractAddress, _tokenId, _nftSeller)
        isNotASale(_nftContractAddress, _tokenId, _nftSeller)
        priceGreaterThanZero(_newMinPrice)
        minPriceDoesNotExceedLimit(
            nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].buyNowPrice,
            _newMinPrice
        )
    {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .minPrice = _newMinPrice;

        emit MinimumPriceUpdated(_nftContractAddress, _tokenId, _nftSeller, _newMinPrice);

        if (_isMinimumBidMade(_nftContractAddress, _tokenId, _nftSeller)) {
            _transferNftToAuctionContract(_nftContractAddress, _tokenId, _nftSeller);
            _updateAuctionEnd(_nftContractAddress, _tokenId, _nftSeller);
        }
    }

    function updateBuyNowPrice(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        uint128 _newBuyNowPrice
    )
        external
        onlyNftSeller(_nftSeller)
        priceGreaterThanZero(_newBuyNowPrice)
        minPriceDoesNotExceedLimit(
            _newBuyNowPrice,
            nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].minPrice
        )
    {
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller]
            .buyNowPrice = _newBuyNowPrice;
        emit BuyNowPriceUpdated(_nftContractAddress, _tokenId, _nftSeller, _newBuyNowPrice);
        if (_isBuyNowPriceMet(_nftContractAddress, _tokenId, _nftSeller)) {
            _transferNftToAuctionContract(_nftContractAddress, _tokenId, _nftSeller);
            _transferNftAndPaySeller(_nftContractAddress, _tokenId, _nftSeller);
        }
    }

    function updateTokenQty(
        address _nftContractAddress,
        uint256 _tokenId,
        address _nftSeller,
        uint256 _tokenQty
    )
        external    
        onlyNftSeller(_nftSeller)
        minimumBidNotMade(_nftContractAddress, _tokenId, _nftSeller)
        sellerHasTokenBalance(_nftContractAddress, _tokenId, _nftSeller, _tokenQty)

    {
        require(_tokenQty > 0, "Must be updated to a nonzero qty");
        nftContractAuctions[_nftContractAddress][_tokenId][_nftSeller].tokenQty = _tokenQty;

    }

    /*
     * The NFT seller can opt to end an auction by taking the current highest bid.
     */
    function takeHighestBid(address _nftContractAddress, uint256 _tokenId, address _nftSeller)
        external
        onlyNftSeller(_nftSeller)
    {
        require(
            _isABidMade(_nftContractAddress, _tokenId, _nftSeller),
            "cannot payout 0 bid"
        );
        _transferNftToAuctionContract(_nftContractAddress, _tokenId, _nftSeller);
        _transferNftAndPaySeller(_nftContractAddress, _tokenId, _nftSeller);
        emit HighestBidTaken(_nftContractAddress, _tokenId, _nftSeller);
    }

    /*
     * If the transfer of a bid has failed, allow the recipient to reclaim their amount later.
     */
    function withdrawAllFailedCredits() external {
        uint256 amount = failedTransferCredits[msg.sender];

        require(amount != 0, "no credits to withdraw");

        failedTransferCredits[msg.sender] = 0;

        (bool successfulWithdraw, ) = msg.sender.call{
            value: amount,
            gas: 20000
        }("");
        require(successfulWithdraw, "withdraw failed");
    }

    /*╔══════════════════════════════╗
      ║       OWNER CONTROLS         ║
      ╚══════════════════════════════╝*/

    function setDefaultFeePercentage(uint32 _feePercentage) external onlyOwner {
        defaultFeePercentage = _feePercentage;
    }

    function setDefaultFeeCollector(address _feeCollector) external onlyOwner {
        defaultFeeCollector = _feeCollector;
    }
}