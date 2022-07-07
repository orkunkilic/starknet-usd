// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";

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
contract Collateral {
    using Counters for Counters.Counter;
    Counters.Counter private _debtIds;

    IStarknetCore public starknet;
    uint256 public borrowContract;

    uint256 public constant MINT = 0; // mint l1_handler

    mapping(uint256 => uint256) public debtAmounts;

    constructor(address _starknetContract, uint256 _borrowContract) {
        starknet = IStarknetCore(_starknetContract);
        borrowContract = _borrowContract;
        _debtIds.increment();
    }

    function collateralizeETH(uint256 borrowerL2, uint256 amountLent, uint256 amountBorrowed) public payable {
        require(msg.value == amountLent, "Insufficient ETH");

        uint256 debtId = _debtIds.current();

        uint256[] memory payload = new uint256[](4);
        payload[0] = borrowerL2;
        payload[1] = amountLent;
        payload[2] = amountBorrowed;
        payload[3] = 5; // Interest Rate

        starknet.sendMessageToL2(borrowContract, MINT, payload);

        debtAmounts[debtId] = amountLent;

        _debtIds.increment();
    }

    function consume(uint256[] calldata payload) public {
        starknet.consumeMessageFromL2(borrowContract, payload);
        payable(address(uint160(payload[2]))).transfer(debtAmounts[payload[1]]); // repay or liquidation
    }

    
}