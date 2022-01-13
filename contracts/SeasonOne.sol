// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.8;
// @todo update to sol 0.8.10

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/iSeekers.sol";
import "./interfaces/iVault.sol";
// import "hardhat/console.sol";

/*

      /@@@#       &@@@@    /@@     @&@@@@@    ,@@            ..@@@,     @@@@@@@     @@,.@@@        &@@@@     @@@@@@@   
   @@   @@@,   /@(  @@@&   @@@   @@@&  @@@@   @@@          @@   @@@   @@@@  @@@@   @@@   @@@    (@(  @@@&  @@@@  @@@@  
  @@@   @@&   @@@(  @@@&   @@@   @@@&  @@@@   @@@         @@@   @@@   @@@@  @@@@   @@@   @@@   @@@(  @     @@@@  @@@@  
  @@@         @@@(  @@@&   @@@   @@@&  @@@@   @@@         @@@   @@@   @@@@  @@@@   @@@   @@@   @@@(        @@@@  @@    
  @@@         @@@(  @@@&   @@@   @@@&  @@@@   @@@         @@@&  @@@   @@@@  @@@@   @@@   @@@   @@@@@&      @@@@ @@@    
  @@@         @@@(  @@@&   @@@   @@@&  @@@@   @@@         @@@   @@@   @@@@  @@@@   @@@   @@@   @@@(        @@@@  @@@@  
  @@@         @@@(  @@@&   @@@   @@@&  @@@@   @@@         @@@   @@@   @@@@  @@@@   @@@   @@@   @@@(        @@@@  @@@@  
  @@@     @,  @@@(  @@@&   @@@   @@@&  @@@@   @@@         @@@   @@@   @@@@  @@@@   @@@   @@@   @@@(    @&  @@@@  @@@@  
  @@@   @@@,  @@@(  @@@&   @@@   @@@&  @@@@   @@@   *@@   @@@   @@@   @@@@  @@@@   @@@   @@@   @@@(  @@@&  @@@@  @@@@  
  @@@   @@@,  @@@(  @@@&   @@@   @@@&  @@@@   @@@   @@@   @@@   @@@   @@@@  @@@@   @@@   @@@   @@@(  @@@&  @@@@  @@@@  
  @@@   @     @@@(  @      @@@   @@@&  @@@@   @@@   @     @@@   @@@   @@@@  @@@@   @@@   @     @@@(  @     @@@@  @@@@  
    @@#         @@@%       @     @@    @@      ,@@.%      @     @,    @@    @@      *@@%^        @@@       @@    @@    
            
*/

contract SeasonOne is ERC1155, Ownable, ReentrancyGuard {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                        INIT SHIT                                             //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
    // Coin IDs
    uint256 public constant ONECOIN = 0;
    uint256 public constant SHARD = 1;

    // COINLANDER PARAMETERS
    address public COINLANDER;
    bool public released = false;
    bool private transferIsSteal = false;
    
    using Counters for Counters.Counter;
    Counters.Counter public seizureCount; 

    // GAME CONSTANTS
    uint256 public constant FIRSTSEEKERMINTTHRESH = 290;
    uint256 public constant SECONDSEEKERMINTTHRESH = 666;
    uint256 public constant THIRDSEEKERMINTTHRESH = 784;
    uint256 public constant UNCLOAKINGTHRESH = 464;
    uint256 public constant SWEETRELEASE = 1111; 

    // ECONOMIC CONSTANTS  
    uint256 public constant PERCENTRATEINCREASE = 80; // 0.8% increase for each successive seizure 
    uint256 public constant PERCENTRESERVES = 50; // 0.50% goes to treasury 
    uint256 constant PERCENTPRIZE = 5000; // 50.00% of take goes to prize pool     
    uint256 constant PERCENTBASIS = 10000;
    
    // ECONOMIC STATE VARS 
    uint256 public seizureStake = 5 * 10**16; // First price for Coinlander 0.05Eth
    uint256 private previousSeizureStake = 0; 
    uint256 public prize = 0; // Prize pool balance
    uint256 private reserve = 0; // Treasury balance 

    // SHARD CONSTANTS
    uint256 constant SEEKERSHARDDROP = 1; // At least one shard to each Seeker holder 
    uint256 constant SHARDDROPRAND = 3; // Up to 3 additional shard drops
    uint256 constant SCALEPERSHARD = 8; // Eight scales per Shard 
    uint256 constant FRAGMENTMULTIPLIER = 1; // One fragment per Shard 
    uint256 constant BASESHARDREWARD = 1; // 1 Shard guaranteed per seizure
    uint256 constant INCRSHARDREWARD = 30; // 3 Eth/Shard
    uint256 constant INCRBASIS = 10; //

    // BALANCES AND ECONOMIC PARAMETERS 
    // Refund structure, tracks both Eth withdraw value and earned Shard 
    struct withdrawParams {
        uint256 _withdrawValue;
        uint256 _shardOwed;
        uint256 _seekersOwed;
    } 

    mapping(address => withdrawParams) public pendingWithdrawals;
    mapping(uint256 => bool) public claimedAirdropBySeekerId;

    struct cloinDeposit {
        address depositor; 
        uint256 amount;
        uint256 blockNumber;
    }

    cloinDeposit[] public cloinDeposits;
    iSeekers public seekers;
    iVault private vault;

    event SweetRelease(address winner);
    event Seized(address previousOwner, address newOwner, uint256 seizurePrice, uint256 nextSeizurePrice, uint256 currentPrize);
    event NewCloinDeposit(address depositor, uint256 amount);
    event ClaimedAll(address claimer);
    event AirdropClaim(uint256 id);
    
    //@TODO we need to figure out what the url schema for metadata looks like and plop that here in the constructor
    constructor(address seekersContract, address keepeersVault) ERC1155("https://meta.coinlander.one/seasonone/{id}") {
        // Create the One Coin and set the deployer as initial COINLANDER
        _mint(msg.sender, ONECOIN, 1, "0x0");
        COINLANDER = msg.sender;

        // Add interface for seekers contract 
        seekers = iSeekers(seekersContract);
        vault = iVault(keepeersVault);
    }



//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                  TOKEN TRANSFER OVERRIDES                                    //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        // No constraints post release 
        if (!released) {
            // Check the id arry for One Coin 
            for (uint i=0; i < ids.length; i++){
                // If One Coin transfer is being attempted, check constraints 
                if (ids[i] == ONECOIN){
                    if (from != address(0) && !transferIsSteal) {
                        revert();
                    }
                } 
            }
        }
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
    

    function _stealTransfer(address holder, address newOwner) internal {
        transferIsSteal = true;
        _safeTransferFrom(holder, newOwner, ONECOIN, 1, "0x0"); // There is only 1 
        transferIsSteal = false;
        if (!released) {
            COINLANDER = newOwner;
        }
    }



//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                  COINLANDER GAME LOGIC                                       //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    function seize() external payable nonReentrant {
        require(released == false, "Cant be released");
        require(msg.value == seizureStake, "Must send exact seizure value");
        require(msg.sender != COINLANDER, "Cant seize from yourself");

        address previousOwner = COINLANDER;
        address newOwner = msg.sender;
        
        seizureCount.increment();

        // Perform the steal
        _stealTransfer(previousOwner, newOwner);

        // Establish rewards and refunds 
        _processPaymentsAndRewards(previousOwner, previousSeizureStake);

        emit Seized(previousOwner, newOwner, msg.value, seizureStake, prize);

        // Trigger game events if price is worthy 
        _processGameEvents();
    }


    function _processPaymentsAndRewards(address previousOwner, uint256 value) internal {
            
        // Set aside funds for treasury and prize pool
        uint256 _take = (value * PERCENTRESERVES) / PERCENTBASIS;
        uint256 _prize = (_take * PERCENTPRIZE) / PERCENTBASIS;
        reserve += (_take - _prize);
        prize += _prize; 

        uint256 deposit = value - _take;
        pendingWithdrawals[previousOwner]._withdrawValue += deposit;

        uint256 shardReward = _calculateShardReward(previousSeizureStake);
        pendingWithdrawals[previousOwner]._shardOwed += shardReward;

        pendingWithdrawals[previousOwner]._seekersOwed += 1;

        // Handle all cases that aren't the last 
        if (!released) {
            // Store current seizure as previous
            previousSeizureStake = seizureStake;
            // Determine what it will cost to seize next time
            seizureStake = seizureStake + ((seizureStake * PERCENTRATEINCREASE) / PERCENTBASIS);
        }
    }

    // Autonomous game events triggered by Coinlander seizure count 
    function _processGameEvents() internal {
        uint256 count = seizureCount.current();

        if (count == FIRSTSEEKERMINTTHRESH) {
            seekers.activateFirstMint();
        }

        if (count == SECONDSEEKERMINTTHRESH) {
            seekers.activateSecondMint();
        }

        if (count == THIRDSEEKERMINTTHRESH) {
            seekers.activateThirdMint();
        }

        if (count > THIRDSEEKERMINTTHRESH) {
            seekers.seizureMintIncrement();
        }

        if (count == UNCLOAKINGTHRESH) {
            seekers.performUncloaking();
        }

        if (count == SWEETRELEASE) {
            _triggerRelease();
        }
    }

    function _triggerRelease() internal {
        released = true;
        emit SweetRelease(msg.sender);

        // Process rewards and refund for the winner 
        _processPaymentsAndRewards(msg.sender,msg.value);

        // Send prize purse to keepers vault
        vault.fundPrizePurse{value: prize}();
        vault.setSweetRelease();

        // Send winning Seeker to winner  
        seekers.sendWinnerSeeker(msg.sender);
    }

    modifier postReleaseOnly() {
        require(released == true);
        _;
    }
    
    function getSeizureCount() external view returns(uint256) {
        return seizureCount.current();
    }


//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                  IN IT TO WIN IT -- SHARD LYFE                               //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    function burnShardForScale(uint256 seekerId, uint256 amount) external nonReentrant {
        require(amount > 0);
        require(balanceOf(msg.sender, SHARD) >= amount);
        _burn(msg.sender, SHARD, amount);
        uint256 scales = amount * SCALEPERSHARD;
        seekers.addScales(seekerId, scales);
    }

    function stakeShardForCloin(uint256 amount) external nonReentrant {
        require(amount > 0);
        require(balanceOf(msg.sender, SHARD) >= amount);
        _burn(msg.sender, SHARD, amount);
        
        cloinDeposit memory _deposit;
        _deposit.depositor = msg.sender;
        _deposit.amount = amount;
        _deposit.blockNumber = block.number; 
        
        cloinDeposits.push(_deposit);
        emit NewCloinDeposit(msg.sender, amount);
    }

    function burnShardForFragments(uint256 amount) external nonReentrant {
        require(amount > 0);
        require(balanceOf(msg.sender, SHARD) >= amount);
        require(seekers.balanceOf(msg.sender) != 0);
    
        uint256 fragmentReward = amount * FRAGMENTMULTIPLIER; 
        _burn(msg.sender, SHARD, amount);
        vault.mintFragments(msg.sender, fragmentReward);
    }

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                  MAGIC INTERNET MONEY BUSINESS                               //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    // Method for claiming all owed rewards and payments: ether refunds, shards and seekers 
    function claimAll() external nonReentrant {

        uint256 withdrawal = pendingWithdrawals[msg.sender]._withdrawValue;
        uint256 shard = pendingWithdrawals[msg.sender]._shardOwed;
        uint256 seeks = pendingWithdrawals[msg.sender]._seekersOwed;

        if (withdrawal > 0) {
            pendingWithdrawals[msg.sender]._withdrawValue = 0;
            (bool success, ) = msg.sender.call{value:withdrawal}("");
            require(success);
        }

        if (shard > 0) {
            pendingWithdrawals[msg.sender]._shardOwed = 0;
            _mint(msg.sender, SHARD, shard, "0x0");
        } 

        if (seeks > 0){
            pendingWithdrawals[msg.sender]._seekersOwed = 0;
            for (uint256 i = 0; i < seeks; i++){
                seekers.birthSeeker(msg.sender);
            }
        }
        else {
            revert();
        }

        emit ClaimedAll(msg.sender);
    }
    
    function airdropClaimBySeekerId(uint256 id) external nonReentrant postReleaseOnly {
        require(seekers.ownerOf(id) == msg.sender);
        require(!claimedAirdropBySeekerId[id]);
        claimedAirdropBySeekerId[id] = true;
        uint256 amount;
        uint256 r1 = _getRandomNumber(SHARDDROPRAND, id);
        uint256 r2 = _getRandomNumber(SHARDDROPRAND, r1);
        amount = SEEKERSHARDDROP + r1 + r2;
        emit AirdropClaim(id);
        _mint(msg.sender, SHARD, amount, "0x0");
    }

    function ownerWithdraw() external payable onlyOwner{
        require(reserve > 0);
        uint256 amount = reserve;
        reserve = 0;
        payable(msg.sender).transfer(amount);
    }

    function _calculateShardReward(uint256 _value) private pure returns (uint256) {
        uint256 reward = BASESHARDREWARD;
        reward += (_value/10**18) * INCRBASIS / INCRSHARDREWARD;
        return reward;  
    }

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
                )));
        return random % mod;
    }

    function getPendingWithdrawl(address _user) external view returns (uint256[3] memory) {
        return [
            pendingWithdrawals[_user]._withdrawValue,
            pendingWithdrawals[_user]._shardOwed,
            pendingWithdrawals[_user]._seekersOwed
        ];
    }

    function getAirdropStatus(uint256 _id) external view returns (bool) {
        return claimedAirdropBySeekerId[_id];
    }

    // If someone messes up and pays us without using the seize method, revert 
    receive() external payable {
        revert();
    }
}