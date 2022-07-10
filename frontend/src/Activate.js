import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';
import { useConnectors, useStarknet } from '@starknet-react/core'
import { MouseEvent, ReactElement, useState } from 'react';
import styled from 'styled-components';
import { injected } from './utils/connectors';
import { useEagerConnect, useInactiveListener } from './utils/hooks';
import { Provider } from './utils/provider';

const StyledActivateDeactivateDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 1fr 1fr;
  grid-gap: 10px;
  place-self: center;
  align-items: center;
`;

const StyledActivateButton = styled.button`
  width: 150px;
  height: 2rem;
  border-radius: 1rem;
  border-color: green;
  cursor: pointer;
`;

const StyledDeactivateButton = styled.button`
  width: 150px;
  height: 2rem;
  border-radius: 1rem;
  border-color: red;
  cursor: pointer;
`;

export default function Activate() {
    const context = useWeb3React();
    const { activate, active, account: ethAccount } = context;

    // Starknet
    const { connect, connectors } = useConnectors()
    const { account } = useStarknet()
    // End Starknet

    const [activating, setActivating] = useState(false);
  
    function handleActivate(event) {
      event.preventDefault();
  
      async function _activate(activate) {
        setActivating(true);
        await activate(injected);
        setActivating(false);
      }
  
      _activate(activate);
    }
  
    // handle logic to eagerly connect to the injected ethereum provider, if it exists and has
    // granted access already
    const eagerConnectionSuccessful = useEagerConnect();
  
    // handle logic to connect in reaction to certain events on the injected ethereum provider,
    // if it exists
    useInactiveListener(!eagerConnectionSuccessful);
  
    return (
        <>
        <StyledActivateButton
            disabled={active}
            style={{
            cursor: active ? 'not-allowed' : 'pointer',
            borderColor: activating ? 'orange' : active ? 'unset' : 'green'
            }}
            onClick={handleActivate}
        >
            Connect Metamask
        </StyledActivateButton>
      <div>
      {connectors.map((connector) =>
        connector.available() ? (
          <StyledActivateButton
          key={connector.id()}
          disabled={account}
          style={{
            cursor: active ? 'not-allowed' : 'pointer',
            borderColor: activating ? 'orange' : active ? 'unset' : 'green'
          }}
          onClick={() => connect(connector)}
        >
          Connect {connector.name()}
        </StyledActivateButton>
        ) : null
      )}
      {!account && connectors.length == 0 ? <p>No Starknet Wallet available</p> : null}
      {account ? <p>Starknet address -> {account}</p> : null}
      {ethAccount ? <p>Ethereum address -> {ethAccount}</p> : null}
    </div>
    </>
    );
  }