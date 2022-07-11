// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IStarknetCore {
    /**
      Sends a message to an L2 contract.

      Returns the hash of the message.
    */
    function sendMessageToL2(
        uint256 to_address,
        uint256 selector,
        uint256[] calldata payload
    ) external returns (bytes32);

    /**
      Consumes a message that was sent from an L2 contract.

      Returns the hash of the message.
    */
    function consumeMessageFromL2(uint256 fromAddress, uint256[] calldata payload)
        external
        returns (bytes32);
}
contract Collateral is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _debtIds;

    event Mint(uint256 debtId, uint256 amountBorrowed);
    event Withdraw(uint256 debtId, uint256 withdrawType);

    // Chainlink Price Feed does not exists on Goerli.
    // AggregatorV3Interface internal priceFeed = AggregatorV3Interface(0x8A753747A1Fa494EC906cE90E9f37563A8AF630e);

    IStarknetCore public starknet;
    uint256 public borrowContract;
    uint256 public constant MINT = 1329909728320632088402217562277154056711815095720684343816173432540100887380;

    mapping(uint256 => uint256) public debtAmounts;

    constructor(address _starknetContract) {
        starknet = IStarknetCore(_starknetContract);
        _debtIds.increment();
    }

    function setBorrowContract(uint256 _borrowContract) public onlyOwner {
        borrowContract = _borrowContract;
    }

    function collateralizeETH(uint256 borrowerL2, uint256 amountLent, uint256 amountBorrowed) public payable returns(uint256) {
        require(msg.value == amountLent, "Insufficient ETH");
        require((amountLent * getLatestPrice()) / 10 ** 8 > amountBorrowed, "Insufficient collateral");

        uint256 debtId = _debtIds.current();

        uint256[] memory payload = new uint256[](7);
        payload[0] = debtId;
        payload[1] = borrowerL2;
        payload[2] = uint256(uint160(msg.sender));
        payload[3] = 0;
        payload[4] = amountBorrowed;
        payload[5] = amountLent;
        payload[6] = 5; // Interest Rate

        starknet.sendMessageToL2(borrowContract, MINT, payload);

        debtAmounts[debtId] = amountLent;

        _debtIds.increment();

        emit Mint(debtId, amountBorrowed);

        return debtId;
    }

    function withdraw(uint256[] calldata payload) public {
        starknet.consumeMessageFromL2(borrowContract, payload);
        payable(address(uint160(payload[2]))).transfer(debtAmounts[payload[1]]); // repay or liquidation

        emit Withdraw(payload[1], payload[0]);
    }

    function getLatestPrice() internal view returns (uint256) {
        //(,int price,,,) = priceFeed.latestRoundData();
        //return uint256(price);

        // mock price
        return uint256(1100 * 10 ** 8);
    }
    
}