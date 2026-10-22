// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Testnet evidence probe: callers update only their own sequence.
contract PortalPulseProbe {
    mapping(address => uint64) public sequenceOf;

    event SequenceRecorded(address indexed caller, uint64 sequence);

    function record(uint64 nextSequence) external {
        sequenceOf[msg.sender] = nextSequence;
        emit SequenceRecorded(msg.sender, nextSequence);
    }
}
