import { nanoid } from "nanoid";
import dotenv from 'dotenv';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';
import { utils } from 'ethers';

import {
  runBlock,
  detectActionType,
  ColonyActionType,
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
    } = action;

    const type = detectActionType(values);

    const inputData = {
      id: transactionHash,
      colonyId: utils.getAddress(colonyClient.address),
      blockNumber,
      createdAt: new Date(timestamp * 1000).toISOString(),
      showInActionsList: true, // todo
      type,
    };

  // ColonyEdit: 'COLONY_EDIT',
  // CreateDomain: 'CREATE_DOMAIN',
  // EditDomain: 'EDIT_DOMAIN',
  // EmitDomainReputationPenalty: 'EMIT_DOMAIN_REPUTATION_PENALTY',
  // EmitDomainReputationReward: 'EMIT_DOMAIN_REPUTATION_REWARD',
  // MoveFunds: 'MOVE_FUNDS',
  // Payment: 'PAYMENT',
  // Recovery: 'RECOVERY',
  // UnlockToken: 'UNLOCK_TOKEN',
  // VersionUpgrade: 'VERSION_UPGRADE',

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
                  initiatorAddress,
                  recipientAddress,
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
                initiatorAddress: values.agent || eventWithUser.agent || receipt.from,
                recipientAddress: eventWithUser.user,
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
      default: {
        return;
      };
    }

  },
);
