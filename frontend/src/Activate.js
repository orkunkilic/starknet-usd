import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core';
import { useConnectors, useStarknet } from '@starknet-react/core'
import { MouseEvent, ReactElement, useState } from 'react';
import styled from 'styled-components';
import { injected } from './utils/connectors';
import { useEagerConnect, useInactiveListener } from './utils/hooks';
import { Provider } from './utils/provider';
import { Button, Text } from '@geist-ui/core';
import CText from './CText';


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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 15
        }}>
          <Button
              disabled={active}
              onClick={handleActivate}
              type="success"
          >
              Connect Metamask
          </Button>

        {connectors.map((connector) =>
          connector.available() ? (
            <Button
            ml={1}
            key={connector.id()}
            disabled={account}
            onClick={() => connect(connector)}
            type="success"
          >
            Connect {connector.name()}
          </Button>
          ) : null
        )}
              </div>
        {!account && connectors.length == 0 ? <CText>No Starknet Wallet available</CText> : null}
        
        {ethAccount ? <CText small mt={1}>Ethereum address: {ethAccount}</CText> : null}
        {account ? <CText small>Starknet address: {account}</CText> : null}
      </div>
    </>
    );
  }