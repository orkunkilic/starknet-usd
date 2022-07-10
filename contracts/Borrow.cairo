%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.math import assert_nn_le, assert_le, assert_not_equal, split_felt
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
    uint256_le,
    uint256_unsigned_div_rem
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


@event
func Mint(
    debt: Debt
):
end

@event
func Repay(
    debt: Debt
):
end

@event
func Liquidate(
    debt: Debt
):
end

@event
func Test(
    low: Uint256,
    high: Uint256
):
end

const sUSD_CONTRACT_ADDRESS = (0x077cc95eef18c45ec39d0c72cbb1e88fe69bf69d2f2ed48fbc49a9297bf64d88)

const L1_CONTRACT_ADDRESS = (0x9D0575aBb279609B31135b68eFE7C0FD3ec17Bfc)
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


@external
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

#@external
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
    amount_borrowed: felt,
    amount_lent: felt,
    interest_rate: felt
):
    alloc_locals

    assert from_address = L1_CONTRACT_ADDRESS

    let (debt) = get_debt(debt_id)

    with_attr error_message("System Error: Debt is already exists."):
        assert debt.borrower = 0
    end

    let (block_timestamp) = get_block_timestamp()

    let (borrow_h, borrow_l) = split_felt(amount_borrowed)
    local borrow: Uint256 = Uint256(borrow_l, borrow_h)

    let (lent_h, lent_l) = split_felt(amount_lent)
    local lent: Uint256 = Uint256(lent_l, lent_h)

    let (interest_h, interest_l) = split_felt(interest_rate)
    local interest: Uint256 = Uint256(interest_l, interest_h)

    let new_debt = Debt(
        borrower,
        borrower_l1,
        asset_id,
        borrow,
        lent,
        interest,
        Uint256(0,0),
        0,
        0,
        block_timestamp,
        block_timestamp
    )

    debts.write(debt_id, new_debt)

    IERC20.mint(
        contract_address = sUSD_CONTRACT_ADDRESS,
        to = borrower,
        amount = borrow
    )

    Mint.emit(debt = new_debt)

    return ()
end

@external
func repay{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    debt_id: felt
):
    alloc_locals

    let (debt) = get_debt(debt_id)

    with_attr error_message("Debt is not exists."):
        assert_not_equal(debt.borrower, 0)
    end

    with_attr error_message("Debt is liquidated."):
        assert_not_equal(debt.is_liquated, 1)
    end

    with_attr error_message("Debt is already repaid."):
        assert_not_equal(debt.is_paid, 1)
    end

    let (caller) = get_caller_address()

    with_attr error_message("You are not the owner of this debt."):
         assert debt.borrower = caller
    end
   

    let (block_timestamp) = get_block_timestamp()

    let (contract_address) = get_contract_address()

    let (local interest_l: Uint256, interest_h) = uint256_add(Uint256(0, 100), debt.interest_rate)

    let (local debt_l: Uint256, local debt_h: Uint256) = uint256_mul(debt.amount_borrowed, interest_l)

    let (local debt_q: Uint256, local debt_r: Uint256) = uint256_unsigned_div_rem(debt_l, Uint256(0, 100))

    IERC20.transferFrom(
        contract_address = sUSD_CONTRACT_ADDRESS,
        sender = caller,
        recipient = contract_address,
        amount = debt_q
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
        debt_q,
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

    Repay.emit(new_debt)

    return ()
end

@external
func liquidate{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    debt_id: felt, liquidator_l1: felt
):
    alloc_locals

    let (debt) = get_debt(debt_id)

    with_attr error_message("Debt is not exists."):
        assert_not_equal(debt.borrower, 0)
    end

    with_attr error_message("Debt is repaid."):
        assert_not_equal(debt.is_paid, 1)
    end

    with_attr error_message("Debt is already liquidated."):
        assert_not_equal(debt.is_liquated, 1)
    end

    let (caller) = get_caller_address()

    let (oracle_price) = get_oracle_price(debt.asset_id)

    let (oracle_price_h, oracle_price_l) = split_felt(oracle_price)

    local oracle_price_u: Uint256 = Uint256(oracle_price_l, oracle_price_h)

    let (dec_h, dec_l) = split_felt(10 ** 18)

    local dec_u: Uint256 = Uint256(dec_l, dec_h)

    let (local oracle_price_q: Uint256, local oracle_price_r: Uint256) = uint256_unsigned_div_rem(oracle_price_u, dec_u)

    let (local liquidation_price_l: Uint256, local liquidation_price_h: Uint256) = uint256_mul(oracle_price_q, debt.amount_lent)
    
    let (local interest_l: Uint256, interest_h) = uint256_add(Uint256(0, 100), debt.interest_rate)

    let (local debt_l: Uint256, local debt_h: Uint256) = uint256_mul(debt.amount_borrowed, interest_l)

    let (local debt_q: Uint256, local debt_r: Uint256) = uint256_unsigned_div_rem(debt_l, Uint256(0, 100))
    
    let (res) = uint256_le(liquidation_price_l, debt_q)
    
    with_attr error_message("Cannot be liquidated."):
        assert_not_equal(res, 0)
    end
        
    let (block_timestamp) = get_block_timestamp()

    let (contract_address) = get_contract_address()

    IERC20.transferFrom(
        contract_address = sUSD_CONTRACT_ADDRESS,
        sender = caller,
        recipient = contract_address,
        amount = debt.amount_borrowed
    )

    IERC20.burn(
        contract_address = sUSD_CONTRACT_ADDRESS,
        amount = debt.amount_borrowed
    )

    let new_debt = Debt(
        debt.borrower,
        debt.borrower_l1,
        debt.asset_id,
        debt.amount_borrowed,
        debt.amount_lent,
        debt.interest_rate,
        debt.amount_borrowed,
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

    Liquidate.emit(debt)

    return ()
end

@external
func test{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
) -> (l: Uint256, h: Uint256):
    alloc_locals

    #let (debt) = get_debt(debt_id)

    let (caller) = get_caller_address()

    local oracle_price = 1010000000000000000000

    let (oracle_price_h, oracle_price_l) = split_felt(oracle_price)

    local oracle_price_u: Uint256 = Uint256(oracle_price_l, oracle_price_h)

    let (dec_h, dec_l) = split_felt(10 ** 18)

    local dec_u: Uint256 = Uint256(dec_l, dec_h)

    let (local oracle_price_q: Uint256, local oracle_price_r: Uint256) = uint256_unsigned_div_rem(oracle_price_u, dec_u)

    let (lent_h, lent_l) = split_felt(1000000000000000000000000)

    local lent: Uint256 = Uint256(lent_l, lent_h)
    
    let (local liquidation_price_l: Uint256, local liquidation_price_h: Uint256) = uint256_mul(oracle_price_q, lent)
    
    Test.emit(liquidation_price_l, liquidation_price_h)

    return (liquidation_price_l, liquidation_price_h)
end

