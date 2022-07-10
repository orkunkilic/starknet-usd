import { useStarknet, useStarknetInvoke, useContract } from '@starknet-react/core';
import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react'
import Activate from './Activate';
import Collateral from './abi/Collateral.json'
import Borrow from './abi/Borrow.json'

function App() {
  const ethContext = useWeb3React();
  const starkContext = useStarknet();

  const { contract: borrowContract } = useContract({
    abi: Borrow,
    address: '0x15c50afdb48e4350b5901a254344b86dab5c63bd67fe6fbe682a6696ad049f6',
  })

  const { data: txData, loading: txLoading, error: txError, reset: txReset, invoke: txInvoke } = useStarknetInvoke({
    contract: borrowContract,
    method: 'repay'
  })

  const [step, setStep] = useState("0");
  const [error, setError] = useState(null);

  const mint = async () => {
    const signer = ethContext.library.getSigner();

    const collateralContract = new ethers.Contract("0x9D0575aBb279609B31135b68eFE7C0FD3ec17Bfc", Collateral.abi, signer);

    const tx = await collateralContract.collateralizeETH(0,0,0)

    console.log(tx)

  } 

  const repay = useCallback(() => {
    txReset()
    if(starkContext.account) {
      txInvoke({ args: [0]})
    }
  }, [starkContext.account, txInvoke, txReset])

  /* const repay = async () => {
    const tx = txInvoke({ args: [0]})
    console.log(tx)
    console.log(txData)
  } */

  useEffect(() => {
    if(ethContext.account && ethContext.chainId != 5) {
      setError("Please connect to the Goerli Testnet from both wallets and refresh!")
    } 
  }, [ethContext.account, ethContext.chainId])

  if(error) {
    return <div>{error}</div>
  }

  return(
    <>
    <Activate />
    { ethContext.account && starkContext.account ?
      <select value={step} onChange={e => setStep(e.target.value)}>
        <option value="0">Step 1</option>
        <option value="1">Step 2</option>
        <option value="2">Step 3</option>
      </select>
      :
      <p>Please connect to both wallets.</p>
    }
    {txLoading && <p>Loading...</p>}
    {txError && <p>Error: {txError}</p>}
    {txData && <p>Error: {txData}</p>}

    { ethContext.account && starkContext.account && step === '0' && 
      <div>
        <p>Mint sUSD</p>
        <p>Minting sUSD to {ethContext.account}</p>
        <button onClick={mint}>Mint</button>
      </div>
    }
    { ethContext.account && starkContext.account && step === '1' &&

      <div>
        <p>Repay sUSD</p>
        <p>Repaying sUSD to {starkContext.account}</p>
        <button onClick={repay}>Repay</button>
      </div>
    }
    { ethContext.account && starkContext.account && step === '2' &&

      <div>
        <p>Liquidate sUSD</p>
        <p>Liquidating sUSD to {starkContext.account}</p>
        <button>Repay</button>
      </div>
    }
 
    </>
  )
}

export default App;
