import { nanoid } from "nanoid";
import dotenv from 'dotenv';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';

import { runBlock } from "./helpers.js";
import { createToken } from "./mutations.js";
import { getTokenByAddress } from './queries.js';
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

