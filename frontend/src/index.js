import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Web3ReactProvider } from '@web3-react/core';
import { getProvider } from './utils/provider';
import { StarknetProvider, getInstalledInjectedConnectors } from '@starknet-react/core'
import { GeistProvider, CssBaseline, Themes } from '@geist-ui/core'

const connectors = getInstalledInjectedConnectors()
const root = ReactDOM.createRoot(document.getElementById('root'));

const theme = Themes.createFromLight({
  type: 'customTheme',
  palette: {
    success: '#292a6d',
    secondary: '#ff4f0b'
  }
})


root.render(
  <React.StrictMode>
    <Web3ReactProvider getLibrary={getProvider}>
      <StarknetProvider connectors={connectors}>
        <GeistProvider themes={[theme]} themeType="customTheme">
          <CssBaseline />
          <App />
        </GeistProvider>
      </StarknetProvider>
    </Web3ReactProvider>
  </React.StrictMode>
);
