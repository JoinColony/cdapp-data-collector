import dotenv from 'dotenv';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';

import provider from './provider.js';

dotenv.config();

const networkClient = colonyJS.getColonyNetworkClient(
  process.env.NETWORK,
  provider,
  { networkAddress: process.env.NETWORK_ADDRESS },
);

export default networkClient;
