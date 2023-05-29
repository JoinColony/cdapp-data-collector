import dotenv from 'dotenv';
import { utils, constants } from 'ethers';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';

import networkClient from './networkClient.js';
import graphQL from './graphQl.js';
import { sortMetadataByTimestamp } from './utils.js';
import { getToken, getIpfsHash, getColonySubscribers } from './helpers.js';

import { getColony, getExtensionEvents } from './queries.js';

dotenv.config();
utils.Logger.setLogLevel(utils.Logger.levels.ERROR);

const run = async () => {

  console.time('setup');
  console.time('total-runtime');

  const coloniesCount = await networkClient.getColonyCount();

  console.timeEnd('setup');

  for (let colonyId = 1; colonyId <= coloniesCount.toNumber(); colonyId += 1) {

    // short circuit for testing, this is RC colony on QA
    if (colonyId === 2) {

      console.time('colony-fetch');

      console.log();
      console.time('chain-data');

      const currentColonyClient = await networkClient.getColonyClient(colonyId);

      console.log('Address:', currentColonyClient.address);
      console.log('Chain ID:', colonyId);

      const colonyName = await networkClient.lookupRegisteredENSDomainWithNetworkPatches(currentColonyClient.address);
      console.log('Name:', colonyName.slice(0, colonyName.indexOf('.')));
      console.log('ENS Name:', colonyName);

      // token
      console.log();

      const currentColonyToken = await getToken(currentColonyClient.tokenClient.address);

      console.log('Chain Token Address:', currentColonyToken.address);
      console.log('Chain Token Name:', currentColonyToken.name);
      console.log('Chain Token Symbol:', currentColonyToken.symbol);
      console.log('Chain Token Decimals:', currentColonyToken.decimals);

      // domains
      console.log()
      const colonyChainDomainsCount = await currentColonyClient.getDomainCount();
      for (let chainDomainId = 1; chainDomainId <= colonyChainDomainsCount.toNumber(); chainDomainId += 1) {
        console.log('Chain Domain Id:', chainDomainId);
        console.log('Chain Domain Name:', chainDomainId === 1 ? 'Root' : `Domain #${chainDomainId}`);
      }

      console.log();
      console.timeEnd('chain-data');

      console.time('subgraph-data');

      // subgraph data
      const {
        data: {
          colony: currentColony,
          domains: currentColonyDomains,
        } = {}
      } = await graphQL(
        getColony,
        { address: currentColonyClient.address.toLowerCase() },
        process.env.SUBGRAPH_ADDRESS,
      );

      // subgraph token
      if (currentColony.token) {
        const { token: subgraphToken } = currentColony;

        console.log();
        console.log('Subgraph Token Address:', subgraphToken.tokenAddress);
        console.log('Subgraph Token Symbol:', subgraphToken.symbol);
        console.log('Subgraph Token Decimals:', subgraphToken.decimals);
      }

      console.log();
      console.timeEnd('subgraph-data');

      // metadata
      console.time('colony-ipfs-data');
      if (currentColony.metadata || currentColony.metadataHistory.length) {
        const { metadata, metadataHistory } = currentColony;
        const [ mostRecentMetadataHistory ] = metadataHistory.sort(sortMetadataByTimestamp);
        const colonyMetadataHash = metadata || (mostRecentMetadataHistory && mostRecentMetadataHistory.metadata);

        if (colonyMetadataHash) {
          const colonyMetadata = await getIpfsHash(colonyMetadataHash);

          if (colonyMetadata.data) {
            const {
              colonyDisplayName,
              colonyAvatarHash,
              colonyTokens,
              verifiedAddresses, // @todo whitelist
              isWhitelistActivated
            } = colonyMetadata.data;

            console.log();
            console.log('Ipfs Display Name:', colonyDisplayName);

            if (colonyAvatarHash) {
              const colonyAvatar = await getIpfsHash(colonyAvatarHash);

              if (colonyAvatar.image) {
                console.log('Ipfs Avatar:', colonyAvatar.image.slice(0, 40), '...');
              } else {
                console.log('Ipfs Avatar Hash:', colonyAvatarHash);
              }
            }

            // fetch all tokens this colony has
            if (colonyTokens && colonyTokens.length) {
              for (let colonySavedTokenIndex = 0; colonySavedTokenIndex < colonyTokens.length; colonySavedTokenIndex += 1) {
                console.log();
                const colonySavedToken = await getToken(colonyTokens[colonySavedTokenIndex]);
                console.log('Saved Token Address:', colonySavedToken.address);
                console.log('Saved Token Name:', colonySavedToken.name);
                console.log('Saved Token Symbol:', colonySavedToken.symbol);
                console.log('Saved Token Decimals:', colonySavedToken.decimals);
              }
            }
          }
        }
      }

      // domains
      if (currentColonyDomains) {

        for (let subgraphDomainId = 0; subgraphDomainId < currentColonyDomains.length; subgraphDomainId += 1) {
          const {
            domainChainId: subgraphDomainChainId,
            name: subgraphDomainName,
            metadata: subgraphDomainMetadata,
            metadataHistory: subgraphDomainMetadataHistory,
          } = currentColonyDomains[subgraphDomainId];

          const [mostRecentDomainMetadataHistory] = subgraphDomainMetadataHistory.sort(sortMetadataByTimestamp);
          const subgraphDomainMetadataHash = subgraphDomainMetadata || (mostRecentDomainMetadataHistory && mostRecentDomainMetadataHistory.metadata);

          console.log();
          console.log('Subgraph Domain Id:', subgraphDomainChainId);
          console.log('Subgraph Domain Fallback Name:', subgraphDomainName);

          if (subgraphDomainMetadataHash) {
            const subgraphDomainMetadataValue = await getIpfsHash(subgraphDomainMetadataHash);

            if (subgraphDomainMetadataValue) {
              const {
                domainName: OLD_subgraphDomainMetadataName,
                domainColor: OLD_subgraphDomainMetadataColor,
                domainPurpose: OLD_subgraphDomainMetadataPurpose,
                data: {
                  domainName: subgraphDomainMetadataName,
                  domainColor: subgraphDomainMetadataColor,
                  domainPurpose: subgraphDomainMetadataPurpose,
                } = {},
              } = subgraphDomainMetadataValue;

              console.log('Subgraph Domain Name:', subgraphDomainMetadataName || OLD_subgraphDomainMetadataName);
              console.log('Subgraph Domain Color:', subgraphDomainMetadataColor || OLD_subgraphDomainMetadataColor);
              console.log('Subgraph Domain Description:', subgraphDomainMetadataPurpose || OLD_subgraphDomainMetadataPurpose);
            }
          } else {
            console.log('Subgraph Domain Name:', undefined);
            console.log('Subgraph Domain Color:', undefined);
            console.log('Subgraph Domain Description:', undefined);
          }
        }
      }

      console.log();
      console.timeEnd('colony-ipfs-data');

      // extensions
      console.time('colony-extension-data');

      const currentColonyExtensions = {};
      await Promise.all(
        ['OneTxPayment', 'VotingReputation'].map(async (extensionId) => {
          const extensionHash = colonyJS.getExtensionHash(extensionId);
          const extensionAddress = await networkClient.getExtensionInstallation(extensionHash, currentColonyClient.address);
          if (extensionAddress !== constants.AddressZero) {

            // events from the subgraph
            const {
              data: {
                extensionInstalledEvents,
                extensionInitialisedEvents,
              } = {}
            } = await graphQL(
              getExtensionEvents,
              {
                colonyAddress: currentColonyClient.address.toLowerCase(),
                extensionAddress: extensionAddress.toLowerCase(),
              },
              process.env.SUBGRAPH_ADDRESS,
            );

            const [{ timestamp, transaction: { transactionHash } }] =
              extensionInstalledEvents
                .filter(({ args }) => {
                  const { extensionId: currentExtensionHash } = JSON.parse(args);
                  return currentExtensionHash === extensionHash;
                }) || [];

            const receipt = await networkClient.provider.getTransactionReceipt(
              transactionHash,
            );

            const currentExtensionClient = await currentColonyClient.getExtensionClient(
              extensionId,
            );

            const deprecated = await currentExtensionClient.getDeprecated();
            const version = await currentExtensionClient.version();

            // if it's oneTxPayment
            let initialized = true;
            if (extensionId === 'VotingReputation') {
              initialized = !!extensionInitialisedEvents.length;
            }

            const permissions = [];
            await Promise.all(
              [0, 1, 2, 3, 5, 6].map(async (role) => {
                const roleExists = await currentColonyClient.hasUserRole(
                  extensionAddress,
                  1, // root domain
                  role,
                );
                if (roleExists) {
                  permissions.push(role);
                }
              }),
            );

            currentColonyExtensions[utils.getAddress(extensionAddress)] = {
              address: utils.getAddress(extensionAddress),
              name: extensionId,
              hash: extensionHash,
              deprecated,
              initialized,
              installedBy: receipt.from,
              installedAt: timestamp,
              version: version.toNumber(),
              permissions: permissions.sort(),
            };
          }
        }),
      )

      Object.keys(currentColonyExtensions).map(extensionAddress => {
        const extension = currentColonyExtensions[extensionAddress];
        console.log();
        console.log('Chain Extension Address:', extension.address);
        console.log('Chain Extension Name:', extension.name);
        console.log('Chain Extension Installed By:', extension.installedBy);
        console.log('Chain Extension Installed At:', extension.installedAt);
        console.log('Chain Extension Version:', extension.version);
        console.log(
          'Chain Extension Roles:',
          extension.permissions.map(role => colonyJS.ColonyRole[role]),
        );
        if (extension.deprecated) {
          console.log('Chain Extension Deprecated:', extension.deprecated);
        }
      });

      console.log();
      console.timeEnd('colony-extension-data');


      // colony server data
      console.time('colony-server-data');

      const colonySubscribers = await getColonySubscribers(currentColonyClient.address);

      // subscribers
      if (colonySubscribers && colonySubscribers.length) {
        for (let colonySubscriberIndex = 0; colonySubscriberIndex < colonySubscribers.length; colonySubscriberIndex += 1) {
          console.log()
          console.log(`Subscriber #${colonySubscriberIndex + 1}`)
          console.log('Colony Subscriber Display Address:', colonySubscribers[colonySubscriberIndex].id);
          console.log('Colony Subscriber Name:', colonySubscribers[colonySubscriberIndex].profile.username);

          if (colonySubscribers[colonySubscriberIndex].profile.displayName) {
            console.log('Colony Subscriber Display Name:', colonySubscribers[colonySubscriberIndex].profile.displayName);
          }

          if (colonySubscribers[colonySubscriberIndex].profile.avatarHash) {
            const subscriberAvatar = await getIpfsHash(colonySubscribers[colonySubscriberIndex].profile.avatarHash);

            if (subscriberAvatar.image) {
              console.log('Colony Subscriber Avatar:', subscriberAvatar.image.slice(0, 40), '...');
            } else {
              console.log('Colony Subscriber Avatar Hash:', colonySubscribers[colonySubscriberIndex].profile.avatarHash);
            }
          }
        }
      }

      console.log();
      console.timeEnd('colony-server-data');

      console.log();
      console.timeEnd('colony-fetch');

    }
  }

  console.log();
  console.timeEnd('total-runtime');
};

run();
