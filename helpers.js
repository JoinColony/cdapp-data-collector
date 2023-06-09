import { nanoid } from 'nanoid'
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadJsonFile } from 'load-json-file';
import { utils, constants } from 'ethers';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';
import minimist from 'minimist';
import dotenv from 'dotenv';

import { writeTokenToFile, writeIpfsToFile, writeUserToFile } from './utils.js';
import provider from './provider.js';
import ipfs from './ipfs.js';
import { getBearerToken } from './colonyServerJWTAuth.js';
import graphQL from './graphQl.js';

import {
  getUser as getUserQuery,
  getColonyMembers as getColonyMembersQuery,
} from './queries.js';

dotenv.config();

const args = minimist(process.argv);

// note that __filename and __dirname don't exist in node if package json declares "module"
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ColonyActionType = {
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

export const ColonyMotionsTypes = {
  generic: ColonyActionType.Generic,
  mintTokens: ColonyActionType.MintTokens,
  makePaymentFundedFromDomain: ColonyActionType.Payment,
  unlockToken: ColonyActionType.UnlockToken,
  addDomain: ColonyActionType.CreateDomain,
  editDomain: ColonyActionType.EditDomain,
  editColony: ColonyActionType.editColony,
  setUserRoles: ColonyActionType.SetUserRoles,
  moveFundsBetweenPots: ColonyActionType.MoveFunds,
  upgrade: ColonyActionType.VersionUpgrade,
  emitDomainReputationPenalty: ColonyActionType.EmitDomainReputationPenalty,
  emitDomainReputationReward: ColonyActionType.EmitDomainReputationReward,
  createDecision: 'CREATE_DECISION',
  nullMotion: 'NULL_MOTION',
  makeArbitraryTransactions: 'ARBITRARTY_TRANSACTION',
};

export const DomainColorMap = {
  0: 'LIGHT_PINK',
  1: 'PINK',
  2: 'BLACK',
  3: 'EMERALD_GREEN',
  4: 'BLUE',
  5: 'YELLOW',
  6: 'RED',
  7: 'GREEN',
  8: 'PERIWINKLE',
  9: 'GOLD',
  10: 'AQUA',
  11: 'BLUE_GREY',
  12: 'PURPLE',
  13: 'ORANGE',
  14: 'MAGENTA',
  15: 'PURPLE_GREY',
}

export const getToken = async (address = constants.AddressZero) => await runBlock(
  `get-token-${nanoid()}`,
  async () => {
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
      return newToken;

    } catch (error) {
      console.error(`Could not fetch token ${address} from the chain`);
      console.error(error);
    }
  },
);

export const getIpfsHash = async (hash) => await runBlock(
  `get-ipfs-data-${nanoid()}`,
  async () => {
    const filePath = resolve(__dirname, '.', 'ipfs', `${hash}.json`);

    // see if we already have it
    let ipfsFile = {};
    try {
      ipfsFile = await loadJsonFile(filePath);
    } catch (error) {
      // most likely the file doesn't exist
    }
    if (ipfsFile && Object.keys(ipfsFile).length) {
      // return locally stored ipfs object
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
      return newIpfsData;

    } catch (error) {
      console.error(`Could not fetch IPFS hash ${hash}`);
      console.error(error);
    }
  },
);

export const getColonySubscribers = async (address = constants.AddressZero) => await runBlock(
  `get-colony-members-${nanoid()}`,
  async () => {
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
        return query.data.subscribedUsers;
      }

      throw new Error(`Colony with address ${checksummedColonyAddress} was not found!`);

    } catch (error) {
      console.error(`Could not fetch colony`);
      console.error(error);
    }
  },
);

export const detectActionType = (actionEvents) => {
  for (let eventsIndex = 0; eventsIndex < actionEvents.length; eventsIndex += 1) {
    const { name: eventSignature, amount, payment } = actionEvents[eventsIndex];

    switch (eventSignature) {
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
        // This way of detecting payment actions is a bit sketchy
        // but it'll do for now since we're in crunch mode
        if (!!payment) {
          return ColonyActionType.Payment;
        }
        return ColonyActionType.Generic;
    }

  }
};

export const detectMotionType = ({ name = ColonyMotionsTypes.generic }) => ColonyMotionsTypes[name] || ColonyMotionsTypes.generic;

export const helpBanner = async () => {
  const {
    name,
    version,
    description,
  } = await loadJsonFile(resolve(__dirname, '.', 'package.json'));
  console.log();
  console.log(name, 'version', version);
  console.log(description);
  console.log();
  console.log('Usage: npm run start --endblock <blockNo> [OPTIONS]');
  console.log();
  console.log('Global Options:');
  console.log('  --endBlock <blockNo>', "\t", 'Block number to fetch chain and subgraph data up to. This is REQUIRED');
  console.log('  --showTimers', "\t\t", 'Show run timers for various actions. Useful to gauge run durations');
  // todo
  console.log('  --dryRun', "\t\t", 'Just fetch data, don\'t write it to the database');
  console.log('  --help', "\t\t", 'This message right here');
};

export const runBlock = async (
  name = `run-block-${nanoid()}`,
  fn,
) => {
  if (!fn || typeof fn !== 'function') {
    console.log();
    // note the ("" + function) construct is actually casting the function to a string so we can log it out
    console.error('Cannot run function block. Provided function is not actually an executable', typeof fn, "" + fn);
  }

  // start timer (if enabled)
  if (args.showTimers) {
    console.time(`[Timer]: ${name}`);
  }

  const result = await fn();

  // stop timer (if enabled)
  if (args.showTimers) {
    console.timeEnd(`[Timer]: ${name}`);
  }

  return result;
}

// throttle requests for 0.2s by default
export const throttle = async (timeout = parseInt(process.env.SUBGRAPH_BATCH_TIMEOUT, 10)) =>
  await new Promise(resolve => setTimeout(resolve, timeout));
