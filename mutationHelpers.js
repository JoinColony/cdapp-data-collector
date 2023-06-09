import { nanoid } from "nanoid";
import dotenv from 'dotenv';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';
import { utils, BigNumber } from 'ethers';

import {
  runBlock,
  ColonyActionType,
  getIpfsHash,
} from "./helpers.js";
import {
  getRolesMapFromEvents,
} from './utils.js';
import {
  createToken,
  createColonyTokens,
  createUser,
  subscribeUserToColony,
  createUserTokens,
  createAction,
} from "./mutations.js";
import {
  getTokenByAddress,
  getColonyToken,
  getUserByName,
  getWatchedColonies,
  getUserToken,
  getDomainFromSkill,
} from './queries.js';
import graphQl from "./graphQl.js";
import networkClient from "./networkClient.js";

dotenv.config();

export const attemptCreateToken = async (token) => await runBlock(
  `create-token-${token.address}-${nanoid()}`,
  async () => {
    const {
      address,
      name,
      symbol,
      decimals,
    } = token;

    // fetch current token from the db, see if it exists already
    const { data } = await graphQl(
      getTokenByAddress,
      { address },
      `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
      { 'x-api-key': process.env.AWS_APPSYNC_KEY },
    );

    const [existingToken] = data && data.getTokenByAddress && data.getTokenByAddress.items || [];

    // no point in going forward, it already exists
    if (existingToken) {
      return;
    }

    // todo: this call can be optimized if desired
    const networkInfo = await networkClient.provider.getNetwork();

    const tokenClient = await colonyJS.getTokenClient(address, networkClient.provider);

    try {
      await graphQl(
        createToken,
        {
          input: {
            id: address,
            decimals,
            name,
            symbol,
            type: tokenClient.tokenClientType === 'ColonyLegacy' || tokenClient.tokenClientType === 'Colony' ? 'COLONY' : 'ERC20',
            chainMetadata: {
              chainId: networkInfo.chainId,
            },
          },
        },
        `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
        { 'x-api-key': process.env.AWS_APPSYNC_KEY },
      );
    } catch (error) {
      //
    }
  },
);

export const attemptToAddTokenToColony = async (colonyAddress, tokenAddress) => await runBlock(
  `add-token-${tokenAddress}-colony-${colonyAddress}-${nanoid()}`,
  async () => {

    // fetch current token <> colony relationship from the db, see if it exists already
    // as we'll only add it in, if it doesn't exist
    const { data } = await graphQl(
      getColonyToken,
      { colonyAddress, tokenAddress },
      `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
      { 'x-api-key': process.env.AWS_APPSYNC_KEY },
    );

    const [existingRelationship] = data && data.listColonyTokens && data.listColonyTokens.items || [];

    // no point in going forward, it already exists
    if (existingRelationship) {
      return;
    }

    try {
      await graphQl(
        createColonyTokens,
        {
          input: {
            tokenID: tokenAddress,
            colonyID: colonyAddress,
          },
        },
        `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
        { 'x-api-key': process.env.AWS_APPSYNC_KEY },
      );
    } catch (error) {
      //
    }
  },
);

export const attemptCreateUser = async (profile) => await runBlock(
  `create-user-${profile.name}-${profile.walletAddress}-${nanoid()}`,
  async () => {
    // check if the user already exists
    const { data } = await graphQl(
      getUserByName,
      { name: profile.name },
      `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
      { 'x-api-key': process.env.AWS_APPSYNC_KEY },
    );

    const [existingUser] = data && data.getUserByName && data.getUserByName.items || [];

    // no point in going forward, it already exists
    if (existingUser) {
      return;
    }

    const {
      avatar,
      bio,
      displayName,
      email,
      walletAddress: id,
      location,
      meta,
      thumbnail,
      updatedAt,
      website,
    } = profile;

    try {
      await graphQl(
        createUser,
        {
          input: {
            id: utils.getAddress(profile.walletAddress),
            name: profile.name,
            profile: {
              avatar,
              bio,
              displayName,
              email,
              id,
              location,
              meta,
              thumbnail,
              updatedAt,
              website,
            },
          },
        },
        `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
        { 'x-api-key': process.env.AWS_APPSYNC_KEY },
      );
    } catch (error) {
      //
    }
  },
);

export const attemptSubscribeToColony = async (colonyAddress, userAddress) => await runBlock(
  `subscribe-${userAddress}-colony-${colonyAddress}-${nanoid()}`,
  async () => {

    // fetch current user <> colony relationship from the db, see if it exists already
    // as we'll only add it in, if it doesn't exist
    const { data } = await graphQl(
      getWatchedColonies,
      { colonyAddress, userAddress },
      `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
      { 'x-api-key': process.env.AWS_APPSYNC_KEY },
    );

    const [existingRelationship] = data && data.listWatchedColonies && data.listWatchedColonies.items || [];

    // no point in going forward, it already exists
    if (existingRelationship) {
      return;
    }

    try {
      await graphQl(
        subscribeUserToColony,
        {
          input: {
            userID: userAddress,
            colonyID: colonyAddress,
          },
        },
        `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
        { 'x-api-key': process.env.AWS_APPSYNC_KEY },
      );
    } catch (error) {
      //
    }
  },
);

export const attemptToAddTokenToUser = async (userAddress, tokenAddress) => await runBlock(
  `add-token-${tokenAddress}-user-${userAddress}-${nanoid()}`,
  async () => {

    // fetch current token <> user relationship from the db, see if it exists already
    // as we'll only add it in, if it doesn't exist
    const { data } = await graphQl(
      getUserToken,
      { userAddress, tokenAddress },
      `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
      { 'x-api-key': process.env.AWS_APPSYNC_KEY },
    );

    const [existingRelationship] = data && data.listUserTokens && data.listUserTokens.items || [];

    // no point in going forward, it already exists
    if (existingRelationship) {
      return;
    }

    try {
      await graphQl(
        createUserTokens,
        {
          input: {
            tokenID: tokenAddress,
            userID: userAddress,
          },
        },
        `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
        { 'x-api-key': process.env.AWS_APPSYNC_KEY },
      );
    } catch (error) {
      //
    }
  },
);

export const createActionEntry = async (colonyClient, action) => await runBlock(
  `add-colony-${colonyClient.address}-action-${action.transactionHash}-${nanoid()}`,
  async () => {
    const {
      transactionHash,
      blockNumber,
      timestamp,
      values,
      type,
    } = action;

    const inputData = {
      id: transactionHash,
      colonyId: utils.getAddress(colonyClient.address),
      blockNumber,
      createdAt: new Date(timestamp * 1000).toISOString(),
      showInActionsList: true, // todo
      type,
    };

    switch (type) {
      case ColonyActionType.MintTokens: {
        const [{
          agent: initiatorAddress,
          who: recipientAddress,
          amount
        }] = values;

        if (amount && amount !== '0') {
          // data to be written to the db
          try {
            await graphQl(
              createAction,
              {
                input: {
                  ...inputData,
                  initiatorAddress: utils.getAddress(initiatorAddress),
                  recipientAddress: utils.getAddress(recipientAddress),
                  amount: amount.toString(),
                  tokenAddress: utils.getAddress(colonyClient.tokenClient.address),
                  fromDomainId: `${utils.getAddress(colonyClient.address)}_${colonyJS.Id.RootDomain}`
                },
              },
              `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
              { 'x-api-key': process.env.AWS_APPSYNC_KEY },
            );
          } catch (error) {
            //
          }
        }
        return;
      };
      case ColonyActionType.SetUserRoles: {
        const receipt = await colonyClient.provider.getTransactionReceipt(
          transactionHash,
        );

        const eventWithUser = values.find(({ user }) => !!user);

        try {
          await graphQl(
            createAction,
            {
              input: {
                ...inputData,
                initiatorAddress: utils.getAddress(values.agent || eventWithUser.agent || receipt.from),
                recipientAddress: utils.getAddress(eventWithUser.user),
                fromDomainId: `${utils.getAddress(colonyClient.address)}_${eventWithUser.domainId || 1}`,
                roles: {
                  ...getRolesMapFromEvents(
                    values,
                    false,
                  ),
                },
                individualEvents: JSON.stringify(
                  values.map(
                    ({ name, role, setTo }, index) => ({
                      id: `${transactionHash}_${index}`,
                      type: name.slice(0, name.indexOf('(')),
                      role,
                      setTo,
                    }),
                  ),
                ),
              },
            },
            `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
            { 'x-api-key': process.env.AWS_APPSYNC_KEY },
          );
        } catch (error) {
          //
        }
        return;
      };
      case ColonyActionType.EmitDomainReputationPenalty:
      case ColonyActionType.EmitDomainReputationReward: {
        const [{
          agent: initiatorAddress,
          user: userAddress,
          skillId,
          amount,
        }] = values;

        const { data } = await graphQl(
          getDomainFromSkill,
          {
            colonyAddress: utils.getAddress(colonyClient.address),
            skillId: parseInt(skillId, 10),
          },
          `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
          { 'x-api-key': process.env.AWS_APPSYNC_KEY },
        );

        const [domain] = data && data.listDomains && data.listDomains.items || [];

        if (domain && domain.nativeId) {
          try {
            await graphQl(
              createAction,
              {
                input: {
                  ...inputData,
                  initiatorAddress: utils.getAddress(initiatorAddress),
                  recipientAddress: utils.getAddress(userAddress),
                  fromDomainId: `${utils.getAddress(colonyClient.address)}_${domain.nativeId}`,
                  amount,
                },
              },
              `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
              { 'x-api-key': process.env.AWS_APPSYNC_KEY },
            );
          } catch (error) {
            //
          }
        }
        return;
      };
      case ColonyActionType.Payment: {
        const [{
          fundamentalChainId,
          address: initiatorAddress,
          payment: {
            domain: { ethDomainId },
            fundingPot: {
              fundingPotPayouts: [{
                token: { address: tokenAddress },
                amount,
              }],
            },
            recipient: recipientAddress,
          }
        }] = values;

        try {
          await graphQl(
            createAction,
            {
              input: {
                ...inputData,
                initiatorAddress: utils.getAddress(initiatorAddress),
                recipientAddress: utils.getAddress(recipientAddress),
                fromDomainId: `${utils.getAddress(colonyClient.address)}_${ethDomainId}`,
                amount,
                tokenAddress: utils.getAddress(tokenAddress),
                fundamentalChainId: parseInt(fundamentalChainId, 10),
              },
            },
            `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
            { 'x-api-key': process.env.AWS_APPSYNC_KEY },
          );
        } catch (error) {
          //
        }
        return;
      };
      case ColonyActionType.CreateDomain:
      case ColonyActionType.EditDomain: {
        const [{
          agent: initiatorAddress,
          domainId,
        }] = values;

        if (parseInt(domainId, 10) !== colonyJS.Id.RootDomain) {
          try {
            await graphQl(
              createAction,
              {
                input: {
                  ...inputData,
                  initiatorAddress: utils.getAddress(initiatorAddress),
                  fromDomainId: `${utils.getAddress(colonyClient.address)}_${domainId}`,
                },
              },
              `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
              { 'x-api-key': process.env.AWS_APPSYNC_KEY },
            );
          } catch (error) {
            //
          }
        }
        return;
      };
      case ColonyActionType.MoveFunds: {
        const [{
          agent: initiatorAddress,
          fromPot,
          toPot,
          amount,
          token: tokenAddress,
        }] = values;

        let fromDomainId;
        let toDomainId;
        try {
          // Only colonies post v5 have this method
          fromDomainId = await colonyClient.getDomainFromFundingPot(fromPot);
          toDomainId = await colonyClient.getDomainFromFundingPot(toPot);
        } catch (error) {
          //
        }

        if (fromDomainId && toDomainId) {
          try {
            await graphQl(
              createAction,
              {
                input: {
                  ...inputData,
                  initiatorAddress: utils.getAddress(initiatorAddress),
                  fromDomainId: `${utils.getAddress(colonyClient.address)}_${fromDomainId.toString()}`,
                  toDomainId: `${utils.getAddress(colonyClient.address)}_${toDomainId.toString()}`,
                  amount,
                  tokenAddress: utils.getAddress(tokenAddress),
                },
              },
              `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
              { 'x-api-key': process.env.AWS_APPSYNC_KEY },
            );
          } catch (error) {
            //
          }
        }
        return;
      };
      case ColonyActionType.UnlockToken: {
        const [{ agent }] = values;

        // for pre v5 colonies there's no address in the event,
        // so we'll have to fetch it from the receipt
        let initiatorAddress = agent;
        if (!initiatorAddress) {
          const receipt = await colonyClient.provider.getTransactionReceipt(transactionHash);
          initiatorAddress = receipt.from;
        }

        try {
          await graphQl(
            createAction,
            {
              input: {
                ...inputData,
                initiatorAddress: utils.getAddress(initiatorAddress),
                fromDomainId: `${utils.getAddress(colonyClient.address)}_${colonyJS.Id.RootDomain}`,
                tokenAddress: utils.getAddress(colonyClient.tokenClient.address),
              },
            },
            `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
            { 'x-api-key': process.env.AWS_APPSYNC_KEY },
          );
        } catch (error) {
          //
        }
        return;
      };
      case ColonyActionType.VersionUpgrade: {
        const [{
          agent: initiatorAddress,
          newVersion,
        }] = values;

        try {
          await graphQl(
            createAction,
            {
              input: {
                ...inputData,
                initiatorAddress: utils.getAddress(initiatorAddress),
                newColonyVersion: parseInt(newVersion, 10),
              },
            },
            `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
            { 'x-api-key': process.env.AWS_APPSYNC_KEY },
          );
        } catch (error) {
          //
        }

        return;
      };
      default: {
        return;
      };
    }

  },
);
