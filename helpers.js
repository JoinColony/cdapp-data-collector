import { nanoid } from 'nanoid'
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadJsonFile } from 'load-json-file';
import { utils, constants } from 'ethers';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';

import { writeTokenToFile, writeIpfsToFile, writeUserToFile } from './utils.js';
import provider from './provider.js';
import ipfs from './ipfs.js';
import { getBearerToken } from './colonyServerJWTAuth.js';
import graphQL from './graphQl.js';

import {
  getUser as getUserQuery,
  getColonyMembers as getColonyMembersQuery,
} from './queries.js';

// note that __filename and __dirname don't exist in node if package json declares "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ColonyActionType = {
  ColonyEdit: 'COLONY_EDIT',
  CreateDomain: 'CREATE_DOMAIN',
  EditDomain: 'EDIT_DOMAIN',
  EmitDomainReputationPenalty: 'EMIT_DOMAIN_REPUTATION_PENALTY',
  EmitDomainReputationReward: 'EMIT_DOMAIN_REPUTATION_REWARD',
  Generic: 'GENERIC',
  MintTokens: 'MINT_TOKENS',
  MoveFunds: 'MOVE_FUNDS',
  Payment: 'PAYMENT',
  Recovery: 'RECOVERY',
  SetUserRoles: 'SET_USER_ROLES',
  UnlockToken: 'UNLOCK_TOKEN',
  VersionUpgrade: 'VERSION_UPGRADE',
  WrongColony: 'WRONG_COLONY',
};

export const getToken = async (address = constants.AddressZero) => {
  const timerId = nanoid();
  console.time(`get-token-${timerId}`);

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
    console.timeEnd(`get-token-${timerId}`);
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
    console.timeEnd(`get-token-${timerId}`);
    return newToken;

  } catch (error) {
    console.error(`Could not fetch token ${address} from the chain`);
    console.error(error);
    console.timeEnd(`get-token-${timerId}`);
  }
};

export const getIpfsHash = async (hash) => {
  const timerId = nanoid();
  console.time(`get-ipfs-data-${timerId}`);

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
    console.timeEnd(`get-ipfs-data-${timerId}`);
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
    console.timeEnd(`get-ipfs-data-${timerId}`);
    return newIpfsData;

  } catch (error) {
    console.error(`Could not fetch IPFS hash ${hash}`);
    console.error(error);
    console.timeEnd(`get-ipfs-data-${timerId}`);
  }
}

export const getUser = async (address = constants.AddressZero) => {
  const timerId = nanoid();
  console.time(`get-user-${timerId}`);

  const checksummedUserAddress = utils.getAddress(address);
  const filePath = resolve(__dirname, '.', 'users', `${checksummedUserAddress}.json`);

  // see if we already have it
  let userFile = {};
  try {
    userFile = await loadJsonFile(filePath);
  } catch (error) {
    // most likely the file doesn't exist
  }

  if (userFile.id) {
    // return locally stored token
    console.timeEnd(`get-user-${timerId}`);
    return userFile;
  }

  try {
    const bearerToken = await getBearerToken();
    const query = await graphQL(
      getUserQuery,
      { address: checksummedUserAddress },
      `${process.env.COLONYSERVER_ADDRESS}/graphql`,
      { authorization: `Bearer ${bearerToken}` },
    );

    if (query && query.data && query.data.user) {
      // write the user file locally
      await writeUserToFile({
        address: checksummedUserAddress,
        data: query.data.user,
      });

      // pre-fetch the user's avatar if one exists
      if (query.data.user.profile.avatarHash) {
        await getIpfsHash(query.data.user.profile.avatarHash);
      }

      // pre-fetch any tokens that the user might have stored
      if (query.data.user.tokenAddresses && query.data.user.tokenAddresses.length) {
        await Promise.all(
          query.data.user.tokenAddresses.map(async (tokenAddress) => await getToken(tokenAddress)),
        );
      }

      // return the newly fetched user object
      console.timeEnd(`get-user-${timerId}`);
      return query.data.user;
    }

    throw new Error(`User with address ${checksummedUserAddress} was not found!`);

  } catch (error) {
    console.error(`Could not fetch user`);
    console.error(error);
    console.timeEnd(`get-user-${timerId}`);
  }
}

export const getColonySubscribers = async (address = constants.AddressZero) => {
  const timerId = nanoid();
  console.time(`get-colony-members-${timerId}`);

  const checksummedColonyAddress = utils.getAddress(address);

  try {
    const bearerToken = await getBearerToken();
    const query = await graphQL(
      getColonyMembersQuery,
      { address: checksummedColonyAddress },
      `${process.env.COLONYSERVER_ADDRESS}/graphql`,
      { authorization: `Bearer ${bearerToken}` },
    );

    if (query && query.data && query.data.subscribedUsers && query.data.subscribedUsers.length) {

      await Promise.all(
        query.data.subscribedUsers.map(
          async (user) => {
            // pre-fetch the user's avatar if one exists
            if (user.profile.avatarHash) {
              await getIpfsHash(user.profile.avatarHash);
            }

            // pre-fetch any tokens that the user might have stored
            if (user.tokenAddresses && user.tokenAddresses.length) {
              await Promise.all(
                user.tokenAddresses.map(async (tokenAddress) => await getToken(tokenAddress)),
              );
            }
          },
        ),
      );

      // return the newly fetched user object
      console.timeEnd(`get-colony-members-${timerId}`);
      return query.data.subscribedUsers;
    }

    throw new Error(`Colony with address ${checksummedColonyAddress} was not found!`);

  } catch (error) {
    console.error(`Could not fetch colony`);
    console.error(error);
    console.timeEnd(`get-colony-members-${timerId}`);
  }
}

export const detectActionType = (actionEvents) => {
  for (let eventsIndex = 0; eventsIndex < actionEvents.length; eventsIndex += 1) {
    const { name: eventSignature, amount } = actionEvents[eventsIndex];

    switch (eventSignature) {
      // todo one tx paymnet
      case 'ColonyRoleSet(address,address,uint256,uint8,bool)':
      case 'ColonyRoleSet(address,uint256,uint8,bool)':
      case 'RecoveryRoleSet(address,bool)':
        return ColonyActionType.SetUserRoles;
      case 'TokensMinted(address,address,uint256)':
        return ColonyActionType.MintTokens;
      case 'DomainAdded(address,uint256)':
        return ColonyActionType.CreateDomain;
      case 'DomainMetadata(address,uint256,string)': {
        const domainAddedEvent = actionEvents.find(({ name }) => name === 'DomainAdded(address,uint256)');
        if (domainAddedEvent) {
          return ColonyActionType.CreateDomain;
        }
        return ColonyActionType.EditDomain;
      }
      case 'TokenUnlocked(address)':
      case 'TokenUnlocked()':
        return ColonyActionType.UnlockToken;
      case 'ColonyFundsMovedBetweenFundingPots(address,uint256,uint256,uint256,address)':
        return ColonyActionType.MoveFunds;
      case 'ColonyMetadata(address,string)':
          return ColonyActionType.ColonyEdit;
      case 'ColonyUpgraded(address,uint256,uint256)':
        return ColonyActionType.VersionUpgrade;
      case 'RecoveryModeEntered(address)':
        return ColonyActionType.Recovery;
      case 'ArbitraryReputationUpdate(address,address,uint256,int256)': {
        const negativeAmount = amount.includes('-');
        if (negativeAmount) {
          return ColonyActionType.EmitDomainReputationPenalty;
        }
        return ColonyActionType.EmitDomainReputationReward;
      }
      default:
        return ColonyActionType.Generic;
    }

  }
};

