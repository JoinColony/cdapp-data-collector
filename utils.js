import { nanoid } from 'nanoid'
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { writeJsonFile } from 'write-json-file';
import { utils, constants } from 'ethers';

import { runBlock } from './helpers.js';

// note that __filename and __dirname don't exist in node if package json declares "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const writeJsonToFile = async (path, data) => runBlock(
  `write-json-file-${nanoid()}`,
  async () => {
    try {
      // only write it if it doesn't exist, save on I/O disk actions! Would somebody please think of the SSDs...
      if (!existsSync(path)) {
        await writeJsonFile(path, data);
        return true;
      }
    } catch (error) {
      console.error(`Could not write file: ${path}`);
      console.error(error);
    }
    return false;
  },
);


export const writeTokenToFile = async ({
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

export const writeIpfsToFile = async ({
  hash,
  data,
} = {}) => {
  const filePath = resolve(__dirname, '.', 'ipfs', `${hash}.json`);
  return writeJsonToFile(filePath, data);
};

export const writeUserToFile = async ({
  address = constants.AddressZero,
  data,
} = {}) => {
  const checksummedUserAddress = utils.getAddress(address);
  const filePath = resolve(__dirname, '.', 'users', `${checksummedUserAddress}.json`);
  return writeJsonToFile(filePath, data);
};

export const sortMetadataByTimestamp = (
  { transaction: { block: { timestamp: timestampA }}},
  { transaction: { block: { timestamp: timestampB }}},
) => parseInt(timestampB, 10) - parseInt(timestampA, 10);
