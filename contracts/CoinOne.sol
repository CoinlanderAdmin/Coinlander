// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/iSeekers.sol";
import "./interfaces/iKeepersVault.sol";

// @TODO investigate EIP-712 for external method calls 

contract CoinOne is ERC1155, Ownable, ReentrancyGuard {

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
    Counters.Counter private seizureCount; 

    // GAME CONSTANTS
    uint256 public constant FIRSTSEEKERMINTTHRESH = 233;
    uint256 public constant SECONDSEEKERMINTTHRESH = 534;
    uint256 public constant THIRDSEEKERMINTTHRESH = 644;
    uint256 public constant UNCLOAKINGTHRESH = 464;
    uint256 public constant SWEETRELEASE = 883; 

    // ECONOMIC CONSTANTS  
    uint256 public constant PERCENTRATEINCREASE = 100; // 1% increase for each successive seizure 
    uint256 constant PERCENTRESERVES = 75; // 0.75% goes to treasury 
    uint256 public constant PERCENTPRIZE = 4000; // 40.00% of revenue goes to prize pool     
    uint256 constant PERCENTBASIS = 10000;
    
    // ECONOMIC STATE VARS 
    uint256 public seizureStake = 5 * 10**16; // First price for Coinlander 0.05Eth
    uint256 public prize = 0; // Prize pool balance
    uint256 private reserve = 0; // Treasury balance 

    // SHARD CONSTANTS
    uint256 constant SEEKERSHARDDROP = 1; // One shard to each Seeker holder 
    uint256 constant SCALEPERSHARD = 1; // One scale per Shard 
    uint256 constant FRAGMENTMULTIPLIER = 1; // One fragment per Shard 
    uint256 constant BASESHARDREWARD = 1; // 10 Shard guaranteed per seizure
    uint256 constant INCRSHARDREWARD = 11; // 1.1 Eth/Shard
    uint256 constant INCRBASIS = 10; //  

    // BALANCES AND ECONOMIC PARAMETERS 
    // Refund structure, tracks both Eth withdraw value and earned Shard 

    //@todo check gas needed vs 2 distinct mappings 
    struct withdrawParams {
        uint256 _withdrawValue;
        uint256 _shardOwed;
        // uint256 _holdTime;
    } 

    mapping(address => withdrawParams) public pendingWithdrawals;

    struct cloinDeposit {
        address depositor; 
        uint256 amount;
        uint256 timestamp;
    }

    cloinDeposit[] public cloinDeposits;
    iSeekers public seekers;
    iKeepersVault private _keepersVault;

    event Stolen(address indexed by, address indexed from, uint256 bounty);
    event SweetRelease(address winner);
    
    // @TODO we need to figure out what the url schema for metadata looks like and plop that here in the constructor
    constructor(address seekersContract, address keepeersVault) ERC1155("https://coinlander.one/api/token/{id}.json") {
        // Create the One Coin and set the deployer as initial COINLANDER
        _mint(msg.sender, ONECOIN, 1, "0x0");
        COINLANDER = msg.sender;

        // Add interface for seekers contract 
        seekers = iSeekers(seekersContract);
        _keepersVault = iKeepersVault(keepeersVault);
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
        require(released == false);
        require(msg.value == seizureStake);
        require(msg.sender != COINLANDER);

        address previousOwner = COINLANDER;
        address newOwner = msg.sender;

        emit Stolen(newOwner, previousOwner, msg.value);
        
        seizureCount.increment();

        // Perform the steal
        _stealTransfer(previousOwner, newOwner);

        // Establish rewards and refunds 
        _processPaymentsAndRewards(previousOwner, msg.value);

        // Trigger game events if price is worthy 
        _processGameEvents();
    }


    function _processPaymentsAndRewards(address previousOwner, uint256 value) internal {
            
            // Set aside funds for treasury and prize pool
            uint256 _take = (value * PERCENTRESERVES) / PERCENTBASIS;
            uint256 _prize = (value * PERCENTPRIZE) / PERCENTBASIS;
            reserve += (_take - _prize);
            prize += _prize; 

            uint256 deposit = seizureStake - _take;
            pendingWithdrawals[previousOwner]._withdrawValue += deposit;

            uint256 shardReward = _calculateShardReward(seizureStake);
            pendingWithdrawals[previousOwner]._shardOwed += shardReward;

            // Handle all cases that aren't the last 
            if (!released) {

                // Determine what it will cost to seize next time
                seizureStake = value + ((value * PERCENTRATEINCREASE) / PERCENTBASIS);
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

        _keepersVault.fundPrizePurse{value: prize}();

        seekers.sendWinnerSeeker(msg.sender);
    }

    modifier postReleaseOnly() {
        require(released == true);
        _;
    }
    


//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                  IN IT TO WIN IT -- SHARD LYFE                               //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    // This is gas expensive, so only the Keepers can call it and pay the associated gas costs
    function airdropShardPostRelease() external onlyOwner {
        address[] memory allSeekerHolders = seekers.allSeekerOwners();
        for (uint256 i = 0; i < allSeekerHolders.length; i++) {
            address acct = allSeekerHolders[i];
            if (acct != address(0)) {
                pendingWithdrawals[acct]._shardOwed += SEEKERSHARDDROP;
            }
        }
    }

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
        _deposit.timestamp = block.timestamp;
        
        cloinDeposits.push(_deposit);
    }

    function burnShardForFragments(uint256 amount) external postReleaseOnly nonReentrant {
        require(amount > 0);
        require(balanceOf(msg.sender, SHARD) >= amount);
        require(seekers.balanceOf(msg.sender) != 0);
    
        uint256 fragmentReward = amount * FRAGMENTMULTIPLIER; 
        _burn(msg.sender, SHARD, amount);
        _keepersVault.mintFragments(msg.sender, fragmentReward);
    }

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                  MAGIC INTERNET MONEY BUSINESS                               //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    function claimRefundAndShard() external nonReentrant {

        uint256 withdrawal = pendingWithdrawals[msg.sender]._withdrawValue;
        uint256 shard = pendingWithdrawals[msg.sender]._shardOwed;

        if (withdrawal > 0) {
            
            pendingWithdrawals[msg.sender]._withdrawValue = 0;
            payable(msg.sender).transfer(withdrawal);
        }
        if (shard > 0) {
            // Seeker reward
            seekers.birthSeeker(msg.sender); 
            // Shard reward 
            _mint(msg.sender, SHARD, shard, "0x0");

        } 
        else {
            revert();
        }
    }

    function ownerWithdraw(uint256 amount) external payable onlyOwner{
        require(amount <= reserve);
        payable(msg.sender).transfer(amount);
        reserve -= amount;
    }

    function _calculateShardReward(uint256 _value) private pure returns (uint256) {
        uint256 reward = BASESHARDREWARD;
        // 1 additional shard for each 0.5Eth
        reward += (_value/10**18) * INCRBASIS / INCRSHARDREWARD;
        return reward;  
    }
}