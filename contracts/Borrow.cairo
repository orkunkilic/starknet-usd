%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.math import assert_nn_le, assert_le
from starkware.starknet.common.messages import send_message_to_l1
from starkware.cairo.common.alloc import alloc
from starkware.starknet.common.syscalls import (
    get_caller_address,
    get_block_number,
    get_block_timestamp,
    get_contract_address
)
from starkware.cairo.common.uint256 import (
    Uint256,
    uint256_mul,
    uint256_add,
    uint256_sub,
    split_64,
    uint256_le
)

@contract_interface
namespace IERC20:
    func name() -> (name: felt):
    end

    func symbol() -> (symbol: felt):
    end

    func decimals() -> (decimals: felt):
    end

    func totalSupply() -> (totalSupply: Uint256):
    end

    func balanceOf(account: felt) -> (balance: Uint256):
    end

    func allowance(owner: felt, spender: felt) -> (remaining: Uint256):
    end

    func transfer(recipient: felt, amount: Uint256) -> (success: felt):
    end

    func transferFrom(
            sender: felt, 
            recipient: felt, 
            amount: Uint256
        ) -> (success: felt):
    end

    func approve(spender: felt, amount: Uint256) -> (success: felt):
    end

    func burn(amount: Uint256):
    end
    func mint(to: felt, amount: Uint256):
    end
end

@contract_interface
namespace IOracle:
    func get_value(asset: felt) -> (price: Price):
    end
end


struct Debt:
    member borrower: felt
    member borrower_l1: felt
    member asset_id: felt
    member amount_borrowed: Uint256
    member amount_lent: Uint256
    member interest_rate: Uint256
    member amount_paid: Uint256
    member is_liquated: felt
    member is_paid: felt
    member created_at: felt
    member updated_at: felt
end

struct Price:
    member asset: felt
    member value: felt
    member timestamp: felt
    member publisher: felt
    member type: felt
end

const sUSD_CONTRACT_ADDRESS = (0x0178a8866ef77a01df365b49d03fe46b8a90703e9fa1e10518277d12153b93d7) # mock

const L1_CONTRACT_ADDRESS = (0x2Db8c2615db39a5eD8750B87aC8F217485BE11EC)
const REPAY = 0
const LIQUIDATE = 1

const ORACLE_CONTRACT_ADDRESS = (0x0178a8866ef77a01df365b49d03fe46b8a90703e9fa1e10518277d12153b93d7)
const ETH = (19514442401534788)
const BTC = (18669995996566340)

@storage_var
func debts(id: felt) -> (debt: Debt):
end

@view
func get_debt{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    id : felt
) -> (debt : Debt):
    let (debt) = debts.read(id)
    return (debt)
end



func get_oracle_price{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(asset_id: felt) -> (price: felt):
    if asset_id == 0:
        let (price) = IOracle.get_value(
            contract_address = ORACLE_CONTRACT_ADDRESS,
            asset = ETH
        )
        return (price.value)
    end
    if asset_id == 1:
        let (price) = IOracle.get_value(
            contract_address = ORACLE_CONTRACT_ADDRESS,
            asset = BTC
        )
        return (price.value)
    else:
        return (0)
    end
    

end

@l1_handler
func mint{
    syscall_ptr: felt*, 
    pedersen_ptr: HashBuiltin*, 
    range_check_ptr}(
    from_address: felt,
    debt_id: felt,
    borrower: felt,
    borrower_l1: felt,
    asset_id: felt,
    amount_borrowed: Uint256,
    amount_lent: Uint256,
    interest_rate: Uint256
):
    alloc_locals

    assert from_address = L1_CONTRACT_ADDRESS

    let (block_timestamp) = get_block_timestamp()

    local new_debt: Debt
    assert new_debt.borrower = borrower
    assert new_debt.borrower_l1 = borrower_l1
    assert new_debt.asset_id = asset_id
    assert new_debt.amount_borrowed = amount_borrowed
    assert new_debt.amount_lent = amount_lent
    assert new_debt.interest_rate = interest_rate
    assert new_debt.created_at = block_timestamp
    assert new_debt.updated_at = block_timestamp

    debts.write(debt_id, new_debt)

    IERC20.mint(
        contract_address = sUSD_CONTRACT_ADDRESS,
        to = borrower,
        amount = amount_borrowed
    )

    return ()
end

@external
func repay{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    debt_id: felt
):
    alloc_locals

    let (debt) = get_debt(debt_id)

    let (caller) = get_caller_address()

    assert debt.borrower = caller

    let (block_timestamp) = get_block_timestamp()

    let (contract_address) = get_contract_address()

    let (local amount_repaid_l: Uint256, amount_repaid_h) = uint256_add(debt.amount_borrowed, Uint256(0, 20)) # MOCK

    IERC20.transferFrom(
        contract_address = sUSD_CONTRACT_ADDRESS,
        sender = caller,
        recipient = contract_address,
        amount = amount_repaid_l
    )

    IERC20.burn(
        contract_address = sUSD_CONTRACT_ADDRESS,
        amount = debt.amount_borrowed
    )

    ## Send the rest to DAO

    let new_debt = Debt(
        debt.borrower,
        debt.borrower_l1,
        debt.asset_id,
        debt.amount_borrowed,
        debt.amount_lent,
        debt.interest_rate,
        amount_repaid_l,
        0,
        1,
        debt.created_at,
        block_timestamp
    )

    debts.write(debt_id, new_debt)


    let (message_payload: felt*) = alloc()
    assert message_payload[0] = REPAY
    assert message_payload[1] = debt_id
    assert message_payload[2] = debt.borrower_l1

    send_message_to_l1(
        to_address=L1_CONTRACT_ADDRESS,
        payload_size=3,
        payload=message_payload,
    )

    return ()
end

@external
func liquidate{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    debt_id: felt, liquidator_l1: felt
):
    alloc_locals

    let (debt) = get_debt(debt_id)

    let (caller) = get_caller_address()

    let (oracle_price) = get_oracle_price(debt.asset_id)

    let (oracle_price_l, oracle_price_h) = split_64(oracle_price)

    local oracle_price_u: Uint256 = Uint256(oracle_price_l, oracle_price_h)

    let (local liquidation_price_l: Uint256, local liquidation_price_h: Uint256) = uint256_mul(oracle_price_u, debt.amount_lent)
    
    #check if _l is correct
    let (res) = uint256_le(liquidation_price_l, debt.amount_borrowed)
    if res == 1:
        
        let (block_timestamp) = get_block_timestamp()

        let (contract_address) = get_contract_address()

        let (amount_repaid) = uint256_sub(debt.amount_borrowed, Uint256(0, 20)) # MOCK

        IERC20.transferFrom(
            contract_address = sUSD_CONTRACT_ADDRESS,
            sender = caller,
            recipient = contract_address,
            amount = amount_repaid
        )

        IERC20.burn(
            contract_address = sUSD_CONTRACT_ADDRESS,
            amount = amount_repaid
        )

        let new_debt = Debt(
            debt.borrower,
            debt.borrower_l1,
            debt.asset_id,
            debt.amount_borrowed,
            debt.amount_lent,
            debt.interest_rate,
            amount_repaid,
            1,
            0,
            debt.created_at,
            block_timestamp
        )

        debts.write(debt_id, new_debt)

        let (message_payload: felt*) = alloc()
        assert message_payload[0] = LIQUIDATE
        assert message_payload[1] = debt_id
        assert message_payload[2] = liquidator_l1

        # release asset from l1 to liquidator
        send_message_to_l1(
            to_address=L1_CONTRACT_ADDRESS,
            payload_size=3,
            payload=message_payload,
        )

        return ()
    else:
        return()
    end 
end

@external
func test{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
) -> (l: Uint256, h: Uint256):
    alloc_locals

    #let (debt) = get_debt(debt_id)

    let (caller) = get_caller_address()

    local oracle_price = 1000

    let (oracle_price_l, oracle_price_h) = split_64(oracle_price)

    local oracle_price_u: Uint256 = Uint256(oracle_price_l, oracle_price_h)

    let (local liquidation_price_l: Uint256, local liquidation_price_h: Uint256) = uint256_mul(oracle_price_u, oracle_price_u)
    
    return (liquidation_price_l, liquidation_price_h)
end

