import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { loadJsonFile } from 'load-json-file';
import { writeJsonFile } from 'write-json-file';
import { utils, constants } from 'ethers';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';

import provider from './provider.js';

// note that __filename and __dirname don't exist in node if package json declares "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const writeTokenToFile = async ({
  address = constants.AddressZero,
  symbol,
  name,
  decimals
} = {}) => {
  console.time('write-token-file');

  const checksummedTokenAddress = utils.getAddress(address);
  const tokenFilePath = resolve(__dirname, '.', 'tokens', `${checksummedTokenAddress}.json`);

  try {
    // only write it if it doesn't exist, save on I/O disk actions! Would somebody please think of the SSDs...
    if (!existsSync(tokenFilePath)) {
      await writeJsonFile(tokenFilePath, {
        address: checksummedTokenAddress,
        symbol,
        name,
        decimals,
      })

      console.timeEnd('write-token-file');
      return true;
    }
  } catch (error) {
    console.error(`Could not write token file: ${tokenFilePath}`);
    console.error(error);
  }

  console.timeEnd('write-token-file');
  return false;
};

export const sortMetadataByTimestamp = (
  { transaction: { block: { timestamp: timestampA }}},
  { transaction: { block: { timestamp: timestampB }}},
) => parseInt(timestampB, 10) - parseInt(timestampA, 10);

export const getToken = async (address = constants.AddressZero) => {
  console.time('get-token');

  const checksummedTokenAddress = utils.getAddress(address);
  const tokenFilePath = resolve(__dirname, '.', 'tokens', `${checksummedTokenAddress}.json`);

  // see if we already have it
  let tokensFile = {};
  try {
    tokensFile = await loadJsonFile(tokenFilePath);
  } catch (error) {
    // most likely the file doesn't exist
  }
  if (tokensFile.address) {
    // return locally stored token
    console.timeEnd('get-token');
    return tokensFile;
  }

  let newToken = {
    address: constants.AddressZero,
    name: 'xDAI Token',
    symbol: 'xDAI',
    decimals: 18,
  };

  try {
    // fetch it from the chain, unless is the native chain token (XDAI, ETH)
    if (checksummedTokenAddress !== constants.AddressZero) {
      const tokenClient = await colonyJS.getTokenClient(
        checksummedTokenAddress,
        provider,
      );

      const newTokenName = await tokenClient.name();
      const newTokenSymbol = await tokenClient.symbol();
      const newTokenDecimals = await tokenClient.decimals();

      newToken = {
        address: checksummedTokenAddress,
        name: newTokenName,
        symbol: newTokenSymbol,
        decimals: newTokenDecimals,
      };
    }

    // save it locally
    await writeTokenToFile(newToken);

    // return the newly fetched token
    console.timeEnd('get-token');
    return newToken;

  } catch (error) {
    console.error(`Could not fetch token ${address} from the chain`);
    console.error(error);
    console.timeEnd('get-token');
  }
};
