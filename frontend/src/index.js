import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Web3ReactProvider } from '@web3-react/core';
import { getProvider } from './utils/provider';
import { StarknetProvider, getInstalledInjectedConnectors } from '@starknet-react/core'
import { Provider } from 'starknet';
const connectors = getInstalledInjectedConnectors()
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Web3ReactProvider getLibrary={getProvider}>
      <StarknetProvider connectors={connectors}>
        <App />
      </StarknetProvider>
    </Web3ReactProvider>
  </React.StrictMode>
);
