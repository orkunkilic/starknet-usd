import { useStarknet, useStarknetInvoke, useContract } from '@starknet-react/core';
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

  const [liqDebtId, setLiqDebtId] = useState("");
  const [repayDebtId, setRepayDebtId] = useState("");
  const [lentAmount, setLentAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [error, setError] = useState(null);

  const mint = async () => {
    const signer = ethContext.library.getSigner();

    const collateralContract = new ethers.Contract("0x9D0575aBb279609B31135b68eFE7C0FD3ec17Bfc", Collateral.abi, signer);

    const tx = await collateralContract.collateralizeETH(
      starkContext.account, 
      ethers.utils.parseEther(lentAmount), 
      ethers.utils.parseEther(borrowAmount), 
      { value: ethers.utils.parseEther(lentAmount)}
      );

    console.log(tx)

  } 

  const repay = useCallback(() => {
    repayReset()
    if(starkContext.account) {
      repayInvoke({ args: [Number(repayDebtId)]})
    }
  }, [starkContext.account, repayInvoke, repayReset])

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
          width: '50%',
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
                <Button mt={1} type='success' onClick={mint}>Mint</Button>
              </div>
            </Tabs.Item>
          </Tabs>
        </div>
      }
  
    </div>
  )
}

export default App;
