import { nanoid } from "nanoid";
import dotenv from 'dotenv';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';
import { utils } from 'ethers';

import { runBlock } from "./helpers.js";
import {
  createToken,
  createColonyTokens,
  createUser,
  subscribeUserToColony,
  createUserTokens,
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
