// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/iSeekers.sol";

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
    uint256 public constant FRAGMENT1 = 2;
    uint256 public constant FRAGMENT2 = 3;
    uint256 public constant FRAGMENT3 = 4;
    uint256 public constant FRAGMENT4 = 5;
    uint256 public constant FRAGMENT5 = 6;
    uint256 public constant FRAGMENT6 = 7;
    uint256 public constant FRAGMENT7 = 8;
    uint256 public constant FRAGMENT8 = 9;
    uint256 public constant KEY = 10;

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

    // FRAGMENT PARAMETERS
    uint16 public constant MAXFRAGMENTS = 11111;
    uint256[] private fragments; // Dynamic array of all fragment ids

    // Max supply of each type 
    uint16 constant numT1 = 3;
    uint16 constant numT2 = 10;
    uint16 constant numT3 = 10;
    uint16 constant numT4 = 50;
    uint16 constant numT5 = 100;
    uint16 constant numT6 = 111;
    uint16 constant numT7 = 222;
    uint16 constant numT8 = MAXFRAGMENTS - numT1 - numT2 - numT3 - numT4 - numT5 - numT6 - numT7;

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

    event Stolen(address indexed by, address indexed from, uint256 bounty);
    event SweetRelease(address winner);
    
    // @TODO we need to figure out what the url schema for metadata looks like and plop that here in the constructor
    constructor(address seekersContract) ERC1155("https://coinlander.one/api/token/{id}.json") {
        // Create the One Coin and set the deployer as initial COINLANDER
        _mint(msg.sender, ONECOIN, 1, "0x0");
        COINLANDER = msg.sender;

        // Add interface for seekers contract 
        seekers = iSeekers(seekersContract);

        // Initialize the fragments array
        for  (uint16 i = 0; i < numT1; i++){
            fragments.push(FRAGMENT1);
        }
        for  (uint16 i = 0; i < numT2; i++){
            fragments.push(FRAGMENT2);
        }
        for  (uint16 i = 0; i < numT3; i++){
            fragments.push(FRAGMENT3);
        }
        for  (uint16 i = 0; i < numT4; i++){
            fragments.push(FRAGMENT4);
        }
        for  (uint16 i = 0; i < numT5; i++){
            fragments.push(FRAGMENT5);
        }
        for  (uint16 i = 0; i < numT6; i++){
            fragments.push(FRAGMENT6);
        }
        for  (uint16 i = 0; i < numT7; i++){
            fragments.push(FRAGMENT7);
        }
        for  (uint16 i = 0; i < numT8; i++){
            fragments.push(FRAGMENT8);
        }
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

                    if (from == address(0) && balanceOf(COINLANDER, ONECOIN) > 0) {
                        revert("There can only be one!");
                    }

                    if (from != address(0) && !transferIsSteal) {
                        revert("The one coin must be seized by force!");
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
        require(
            released == false,
            "The coin has been released and can no longer be stolen."
        );
        require(
            msg.value == seizureStake,
            "Must claim with exactly seizure stake"
        );
        require(
            msg.sender != COINLANDER, 
            "You can't steal from yourself!"
        );

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

        // @TODO transfer seeker id 1 to winner 
    }

    modifier postReleaseOnly() {
        require(released == true, "Only available after the release");
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
        require(amount > 0, "You must specify a number of shard to burn");
        require(balanceOf(msg.sender, SHARD) >= amount, "Gotta have shard to burn");
        _burn(msg.sender, SHARD, amount);
        uint256 scales = amount * SCALEPERSHARD;
        seekers.addScales(seekerId, scales);
    }

    function stakeShardForCloin(uint256 amount) external nonReentrant {
        require(amount > 0, "You must specify a number of shard to burn");
        require(balanceOf(msg.sender, SHARD) >= amount, "Gotta have shard to burn");
        _burn(msg.sender, SHARD, amount);

        cloinDeposit memory _deposit;
        _deposit.depositor = msg.sender;
        _deposit.amount = amount;
        _deposit.timestamp = block.timestamp;
        
        cloinDeposits.push(_deposit);
    }

    function burnShardForFragments(uint256 amount) external nonReentrant {
        require(amount > 0, "You must specify a number of shard to burn");
        require(released, "Only possible after the Sweet Release");
        require(balanceOf(msg.sender, SHARD) >= amount, "Gotta have shard to burn");
        require(seekers.balanceOf(msg.sender) != 0, "Must have a Seeker to claim fragments");
    
        uint256 fragmentReward = amount * FRAGMENTMULTIPLIER; 
        _burn(msg.sender, SHARD, amount);

        for(uint256 i = 0; i < amount; i++){
            uint256 fragmentType = _getRandom(fragments);
            _mint(msg.sender, fragmentType, fragmentReward, "0x0");
            
        }
    }

    function claimKeepersVault() external nonReentrant {
        require(released, "The key to the vault cannot be assembled until the Sweet Release");
        require(prize > 0, "The prize has already been claimed");
        require(seekers.balanceOf(msg.sender) > 0, "Only a Seeker can claim wield the Keepers Key");
        require(balanceOf(msg.sender, FRAGMENT1) > 0, "Must have a FRAGMENT1");
        require(balanceOf(msg.sender, FRAGMENT2) > 0, "Must have a FRAGMENT2");
        require(balanceOf(msg.sender, FRAGMENT3) > 0, "Must have a FRAGMENT3");
        require(balanceOf(msg.sender, FRAGMENT4) > 0, "Must have a FRAGMENT4");
        require(balanceOf(msg.sender, FRAGMENT5) > 0, "Must have a FRAGMENT5");
        require(balanceOf(msg.sender, FRAGMENT6) > 0, "Must have a FRAGMENT6");
        require(balanceOf(msg.sender, FRAGMENT7) > 0, "Must have a FRAGMENT7");
        require(balanceOf(msg.sender, FRAGMENT8) > 0, "Must have a FRAGMENT8");

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

    function _getRandom(uint256[] storage _arr) private returns (uint256) {
        uint256 random = _getRandomNumber(_arr);
        uint256 fragType = _arr[random];

        _arr[random] = _arr[_arr.length - 1]; // Set the idx of taken frag to most common 
        _arr.pop();

        return fragType;
    }

	// Thanks Manny - entropy is a bitch
	function _getRandomNumber(uint256[] storage _arr) private view returns (uint256) {
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
		return random % _arr.length;
	}

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
//                                  MAGIC INTERNET MONEY BUSINESS                               //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////

    function claimRefundAndShard() external nonReentrant {

        uint256 withdrawal = pendingWithdrawals[msg.sender]._withdrawValue;
        uint256 shard = pendingWithdrawals[msg.sender]._shardOwed;
// @TODO clean this up; we shouldn't call a transfer with 0 value
        if (withdrawal > 0 || shard > 0) {
            
            pendingWithdrawals[msg.sender]._withdrawValue = 0;
            payable(msg.sender).transfer(withdrawal);

            // Seeker reward
            seekers.birthSeeker(msg.sender); 
            // Shard reward 
            _mint(msg.sender, SHARD, shard, "0x0");

        } 
        else {
            revert("Nothing to withdraw");
        }
    }

    function ownerWithdraw(uint256 amount) external payable onlyOwner{
        require(amount <= reserve, "Withdawl value cant exceed reserve holdings");
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