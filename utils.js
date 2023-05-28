import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { loadJsonFile } from 'load-json-file';
import { writeJsonFile } from 'write-json-file';
import { utils, constants } from 'ethers';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';

import provider from './provider.js';
import ipfs from './ipfs.js';

// note that __filename and __dirname don't exist in node if package json declares "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const writeJsonToFile = async (path, data) => {
  console.time('write-json-file');

  try {
    // only write it if it doesn't exist, save on I/O disk actions! Would somebody please think of the SSDs...
    if (!existsSync(path)) {
      await writeJsonFile(path, data);

      console.timeEnd('write-json-file');
      return true;
    }
  } catch (error) {
    console.error(`Could not write file: ${path}`);
    console.error(error);
  }

  console.timeEnd('write-json-file');
  return false;
};


const writeTokenToFile = async ({
  address = constants.AddressZero,
  symbol,
  name,
  decimals
} = {}) => {
  const checksummedTokenAddress = utils.getAddress(address);
  const filePath = resolve(__dirname, '.', 'tokens', `${checksummedTokenAddress}.json`);

  return writeJsonToFile(filePath, {
    address: checksummedTokenAddress,
    symbol,
    name,
    decimals,
  });
};

const writeIpfsToFile = async ({
  hash,
  data,
} = {}) => {
  const filePath = resolve(__dirname, '.', 'ipfs', `${hash}.json`);
  return writeJsonToFile(filePath, data);
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

export const getIpfsHash = async (hash) => {
  console.time('get-ipfs-data');

  const filePath = resolve(__dirname, '.', 'ipfs', `${hash}.json`);

  // see if we already have it
  let ipfsFile = {};
  try {
    ipfsFile = await loadJsonFile(filePath);
  } catch (error) {
    // most likely the file doesn't exist
  }
  if (Object.keys(ipfsFile).length) {
    // return locally stored ipfs object
    console.timeEnd('get-ipfs-data');
    return ipfsFile;
  }

  try {
    const newIpfsData = await ipfs(hash);

    // save it locally
    await writeIpfsToFile({
      hash,
      data: newIpfsData,
    });

    // return the newly fetched ipfs object
    console.timeEnd('get-ipfs-data');
    return newIpfsData;

  } catch (error) {
    console.error(`Could not fetch IPFS hash ${hash}`);
    console.error(error);
    console.timeEnd('get-ipfs-data');
  }
}
