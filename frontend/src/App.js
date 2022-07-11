import { useStarknet, useStarknetInvoke, useContract, useStarknetCall } from '@starknet-react/core';
import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react'
import Activate from './Activate';
import Collateral from './abi/Collateral.json'
import Borrow from './abi/Borrow.json'
import Logo from './assets/logo.webp'
import { Button, Divider, Image, Input, Select, Tabs, Text } from '@geist-ui/core';
import CText from './CText';


function App() {
  const ethContext = useWeb3React();
  const starkContext = useStarknet();

  const { contract: borrowContract } = useContract({
    abi: Borrow,
    address: '0x15c50afdb48e4350b5901a254344b86dab5c63bd67fe6fbe682a6696ad049f6',
  })

  const { data: repayData, loading: repayLoading, error: repayError, reset: repayReset, invoke: repayInvoke } = useStarknetInvoke({
    contract: borrowContract,
    method: 'repay'
  })

  const { data: liquidateData, loading: liquidateLoading, error: liquidateError, reset: liquidateReset, invoke: liquidateInvoke } = useStarknetInvoke({
    contract: borrowContract,
    method: 'liquidate'
  })

  
  const [mintDebtId, setMintDebtId] = useState(null)
  const [mintData, setMintData] = useState(null)
  const [mintError, setMintError] = useState(null)
  
  const [withdrawData, setWithdrawData] = useState(null)
  const [withdrawError, setWithdrawError] = useState(null)
  
  const [liqDebtId, setLiqDebtId] = useState("");
  
  const [repayDebtId, setRepayDebtId] = useState("");
  
  const [viewDebtId, setViewDebtId] = useState("");
  
  const { data: viewData, loading: viewLoading, error: viewError, refresh: viewRefresh} = useStarknetCall({
    contract: borrowContract,
    method: 'get_debt',
    args: [viewDebtId],
    options: {
      watch: false
    }
  })
  const [withdrawType, setWithdrawType] = useState("");
  const [withdrawDebtId, setWithdrawDebtId] = useState("");

  const [lentAmount, setLentAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");

  const [error, setError] = useState(null);

  const mint = async () => {
    const signer = ethContext.library.getSigner();

    const collateralContract = new ethers.Contract("0x9D0575aBb279609B31135b68eFE7C0FD3ec17Bfc", Collateral.abi, signer);

    try {
      const tx = await collateralContract.collateralizeETH(
        starkContext.account, 
        ethers.utils.parseEther(lentAmount), 
        ethers.utils.parseEther(borrowAmount), 
        { value: ethers.utils.parseEther(lentAmount)}
      );
  
      await tx.wait()


      setMintData(tx.hash)
    } catch (error) {
      setMintError(error)
    }
  } 

  const repay = useCallback(() => {
    repayReset()
    if(starkContext.account) {
      repayInvoke({ args: [Number(repayDebtId)] })
    }
  }, [starkContext.account, repayInvoke, repayReset])

  const liquidate = useCallback(() => {
    liquidateReset()
    if(starkContext.account && ethContext.account) {
      liquidateInvoke({ args: [Number(liqDebtId), ethContext.account]})
    }
  }, [starkContext.account, liquidateInvoke, liquidateReset])

  const withdraw = async () => {
    const signer = ethContext.library.getSigner();

    const collateralContract = new ethers.Contract("0x9D0575aBb279609B31135b68eFE7C0FD3ec17Bfc", Collateral.abi, signer);

    // Convert address to uint256

    try {
      const tx = await collateralContract.withdraw(
        [withdrawType, withdrawDebtId, parseInt(ethContext.account, 16).toString()]
      );
  
      await tx.wait()


      setWithdrawData(tx.hash)
    } catch (error) {
      setWithdrawError(error)
    }
  } 
  /* const repay = async () => {
    const tx = repayInvoke({ args: [0]})
    console.log(tx)
    console.log(repayData)
  } */

  useEffect(() => {
    if(ethContext.account && ethContext.chainId != 5) {
      setError("Please connect to the Goerli Testnet from both wallets and refresh!")
    } 
  }, [ethContext.account, ethContext.chainId])

  if(error) {
    return <Text>{error}</Text>
  }

  return(
    <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 15,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',

      }}>
        <Image src={Logo} width="100px" />
        <CText h1 type='success' ml={1}>Starknet USD</CText>
      </div>
      <Divider w={80} type='lite'  />
      <Activate />
      {ethContext.account && starkContext.account && 
        <div style={{
          width: '80%',
        }}>
          <Tabs initialValue='1' hideDivider activeClassName='active-tab' hoverHeightRatio={0} hoverWidthRatio={0}>
            <Tabs.Item value='1' autoCapitalize='false' label='Mint sUSD'>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'start',
                justifyContent: 'center',
              }}>
                <CText>Mint sUSD</CText>
                <CText small>Borrower Starknet Address: {starkContext.account}</CText>
                <CText mt={1} small>ETH amount to lent: </CText>
                <Input w={20} step='0.1' htmlType='number' placeholder='0.23' type='default' value={lentAmount} onChange={(e) => setLentAmount(e.target.value)} />
                <CText mt={1} small>sUSD amount to borrow: </CText>
                <Input w={20} step='100' htmlType='number' placeholder='120' type='default' value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} />
                <Button mt={1} type='success' onClick={mint}>Mint</Button>
                {mintData && <CText mt={1}>Mint transaction hash: {mintData}. Your sUSD will be minted to your Starknet account soon.</CText>}
                {mintError && <CText mt={1}>Mint error: {mintError}</CText>}
              </div>
            </Tabs.Item>
            <Tabs.Item value='2' label='Repay'>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'start',
                justifyContent: 'center',
              }}>
                <CText>Repay sUSD Debt</CText>
                <CText mt={1} small>Debt Id: </CText>
                <Input w={20} step='1' htmlType='number' placeholder='123' type='default' value={repayDebtId} onChange={(e) => setRepayDebtId(e.target.value)} />
                <Button mt={1} type='success' onClick={repay}>Repay</Button>
                {repayLoading && <CText>Loading...</CText>}
                {repayError && <CText>Error: {repayError}</CText>}
                {repayData && <CText>Success, please wait for L1 confirmation in order to withdraw from L1.</CText>}
              </div>
            </Tabs.Item>
            <Tabs.Item value='3' label='Liquidate'>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'start',
                justifyContent: 'center',
              }}>
                <CText>Liquidate sUSD Debt</CText>
                <CText small>Liquidator Ethereum Address: {ethContext.account}</CText>
                <CText mt={1} small>Debt Id: </CText>
                <Input w={20} step='1' htmlType='number' placeholder='123' type='default' value={liqDebtId} onChange={(e) => setLiqDebtId(e.target.value)} />
                <Button mt={1} type='success' onClick={liquidate}>Liquidate</Button>
                {liquidateLoading && <CText>Loading...</CText>}
                {liquidateError && <CText>Error: {liquidateError}</CText>}
                {liquidateData && <CText>Success, please wait for L1 confirmation in order to withdraw from L1.</CText>}
              </div>
            </Tabs.Item>
            <Tabs.Item value='4' label='View Debt'>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'start',
                justifyContent: 'center',
              }}>
                <CText>View sUSD Debt Position</CText>
                <CText mt={1} small>Debt Id: </CText>
                <Input w={20} step='1' htmlType='number' placeholder='123' type='default' value={liqDebtId} onChange={(e) => setLiqDebtId(e.target.value)} />
                <Button mt={1} type='success' onClick={viewRefresh}>View</Button>
                {viewError && <CText>Error: {viewError}</CText>}
                {viewData && <CText>{JSON.stringify(viewData)}</CText>}
              </div>
            </Tabs.Item>
            <Tabs.Item value='5' label='Withdraw'>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'start',
                justifyContent: 'center',
              }}>
                <CText>Withdraw L1 Money</CText>
                <CText small>Withdraw Ethereum Address: {ethContext.account}</CText>
                <Select mt={1} initialValue="0" value={withdrawType} onChange={(e) => setWithdrawType(e)}>
                  <Select.Option value='0'>Repay Withdraw</Select.Option>
                  <Select.Option value='1'>Liquidate Withdraw</Select.Option>
                </Select>
                <CText mt={1} small>Debt Id: </CText>
                <Input w={20} step='1' htmlType='number' placeholder='123' type='default' value={withdrawDebtId} onChange={(e) => setWithdrawDebtId(e.target.value)} />
                <Button mt={1} type='success' onClick={withdraw}>Withdraw</Button>
                {withdrawError && <CText>Error: {JSON.stringify(withdrawError)}</CText>}
                {withdrawData && <CText>Success!</CText>}
              </div>
            </Tabs.Item>
          </Tabs>
        </div>
      }
  
    </div>
  )
}

export default App;
