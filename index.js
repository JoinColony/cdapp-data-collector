import dotenv from 'dotenv';
import { utils, constants } from 'ethers';
import colonyJS from './node_modules/@colony/colony-js/dist/cjs/index.js';
import minimist from 'minimist';

import networkClient from './networkClient.js';
import graphQL from './graphQl.js';
import { sortMetadataByTimestamp } from './utils.js';
import {
  getToken,
  getIpfsHash,
  getColonySubscribers,
  detectActionType,
  helpBanner,
  runBlock,
  throttle,
  ColonyActionType,
  detectMotionType,
  DomainColorMap,
} from './helpers.js';

import {
  getColony,
  getExtensionEvents,
  getActionEvents,
  getPermissionsEvents,
  getHistoricColonyExtensions,
  getOneTxPayments,
  getMotions,
  getDecisions,
  getAnnotationsChunk,
} from './queries.js';

import {
  createUniqueColony,
  createColonyMetadata,
  createDomain,
  createDomainMetadata,
} from './mutations.js';

import {
  attemptCreateToken,
  attemptToAddTokenToColony,
  attemptCreateUser,
} from './mutationHelpers.js';

dotenv.config();
utils.Logger.setLogLevel(utils.Logger.levels.ERROR);

const args = minimist(process.argv);

const run = async () => {
  const networkInfo = await networkClient.provider.getNetwork();
  const currentBlock = await networkClient.provider.getBlock('latest');

  if (args.help) {
    await helpBanner();
    process.exit(0);
  }

  if (!args.endBlock || typeof args.endBlock !== 'number' || args.endBlock > currentBlock.number) {
    console.log();
    console.error('Please provide an end block using the "--endBlock <blockNo>" argument');
    if (args.endBlock > currentBlock.number) {
      console.error(`The end block cannot be higher than the current block number: ${currentBlock.number}`);
    }
    console.log();
    console.error('Run: npm run start --help for usage information');
    process.exit(1);
  }

  console.log();
  console.log(`Chain: ${networkInfo.name}`);
  console.log(`Chain ID: ${networkInfo.chainId}`);

  console.log();
  console.log(`Colony Network Deployment: ${process.env.NETWORK_ADDRESS}`);

  console.log();
  console.log('Current Block:', currentBlock.number);
  console.log('Fetching up to Block:', args.endBlock);
  console.log('Block difference:', args.endBlock - currentBlock.number);

  await runBlock(
    'total-runtime',
    async () => {
      const coloniesCount = await networkClient.getColonyCount();

      for (let colonyId = 1; colonyId <= coloniesCount.toNumber(); colonyId += 1) {

        // short circuit for testing, this is RC colony on QA
        if (colonyId === 2) {

          await runBlock(
            `colony-${colonyId}-fetch`,
            async () => {
              console.log();
              console.log(''.padStart(18, '-'));

              // chain data
              const currentColonyClient = await runBlock(
                `colony-${colonyId}-chain-data`,
                async () => {
                  console.log();

                  const currentColonyClient = await networkClient.getColonyClient(colonyId);

                  console.log('Address:', currentColonyClient.address);
                  console.log('Chain ID:', colonyId);

                  const colonyName = await networkClient.lookupRegisteredENSDomainWithNetworkPatches(currentColonyClient.address);
                  console.log('Name:', colonyName.slice(0, colonyName.indexOf('.')));
                  console.log('ENS Name:', colonyName);

                  const colonyVersion = await currentColonyClient.version();
                  console.log('Version:', colonyVersion.toNumber());

                  // token
                  console.log();

                  const currentColonyToken = await getToken(currentColonyClient.tokenClient.address);
                  const currentColonyTokenClient = currentColonyClient.tokenClient;

                  console.log('Chain Token Address:', currentColonyToken.address);
                  console.log('Chain Token Name:', currentColonyToken.name);
                  console.log('Chain Token Symbol:', currentColonyToken.symbol);
                  console.log('Chain Token Decimals:', currentColonyToken.decimals);

                  let lockedStatus = false;
                  try {
                    lockedStatus = await currentColonyTokenClient.locked();
                  } catch (error) {
                    //
                  }

                  let unlockable = false;
                  try {
                    await networkClient.provider.estimateGas({
                      from: currentColonyClient.address,
                      to: currentColonyTokenClient.address,
                      data: currentColonyTokenClient.interface.functions.unlock.sighash,
                    });
                    unlockable = true;
                  } catch (error) {
                    //
                  }

                  let mintable = false;
                  try {
                    await networkClient.provider.estimateGas({
                      from: currentColonyClient.address,
                      to: currentColonyTokenClient.address,
                      /*
                       * The mint method (overloaded version) encoded with 1 as the first parameter
                       */
                      data: currentColonyTokenClient.interface.encodeFunctionData('mint(uint256)', [1]),
                    });
                    mintable = true;
                  } catch (error) {
                    //
                  }

                  console.log('Chain Token Unlocked:', !lockedStatus);
                  console.log('Chain Token Unlockable:', unlockable);
                  console.log('Chain Token Mintable:', mintable);

                  // domains
                  console.log()
                  const colonyChainDomainsCount = await currentColonyClient.getDomainCount();
                  for (let chainDomainId = 1; chainDomainId <= colonyChainDomainsCount.toNumber(); chainDomainId += 1) {
                    console.log('Chain Domain Id:', chainDomainId);
                    console.log('Chain Domain Name:', chainDomainId === 1 ? 'Root' : `Domain #${chainDomainId}`);
                  }

                  // create token
                  await attemptCreateToken(currentColonyToken);

                  /* Create the colony's entry */
                  try {
                    await graphQL(
                      createUniqueColony,
                      {
                        input: {
                          id: utils.getAddress(currentColonyClient.address),
                          name: colonyName.slice(0, colonyName.indexOf('.')),
                          colonyNativeTokenId: utils.getAddress(currentColonyToken.address),
                          version: colonyVersion.toNumber(),
                          chainMetadata: {
                            chainId: networkInfo.chainId,
                          },
                          status: {
                            nativeToken: {
                              unlockable,
                              unlocked: !lockedStatus,
                              mintable,
                            },
                          },
                        },
                      },
                      `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
                      { 'x-api-key': process.env.AWS_APPSYNC_KEY },
                    );
                  } catch (error) {
                    //
                  }

                  // add native token to colony
                  await attemptToAddTokenToColony(
                    utils.getAddress(currentColonyClient.address),
                    currentColonyToken.address,
                  );

                  return currentColonyClient;
                },
              );

              // subgraph data
              const { currentColony, currentColonyDomains } = await runBlock(
                `colony-${colonyId}-subgraph-data`,
                async () => {
                  const {
                    data: {
                      colony: currentColony,
                      domains: currentColonyDomains,
                    } = {}
                  } = await graphQL(
                    getColony,
                    {
                      address: currentColonyClient.address.toLowerCase(),
                      upToBlock: args.endBlock,
                    },
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

                  return { currentColony, currentColonyDomains };
                },
              );

              // metadata
              await runBlock(
                `colony-${colonyId}-ipfs-data`,
                async () => {
                  if (currentColony.metadata || currentColony.metadataHistory.length) {
                    const { metadata, metadataHistory } = currentColony;
                    const [mostRecentMetadataHistory] = metadataHistory.sort(sortMetadataByTimestamp);
                    const colonyMetadataHash = metadata || (mostRecentMetadataHistory && mostRecentMetadataHistory.metadata);

                    if (colonyMetadataHash) {
                      const colonyMetadata = await getIpfsHash(colonyMetadataHash);

                      if (colonyMetadata.data) {
                        const {
                          colonyDisplayName,
                          colonyAvatarHash,
                          colonyTokens,
                          verifiedAddresses,
                          isWhitelistActivated
                        } = colonyMetadata.data;

                        console.log();
                        console.log('Ipfs Display Name:', colonyDisplayName);

                        let colonyAvatar;
                        if (colonyAvatarHash) {
                          colonyAvatar = await getIpfsHash(colonyAvatarHash);

                          if (colonyAvatar.image) {
                            console.log('Ipfs Avatar:', colonyAvatar.image.slice(0, 40), '...');
                          } else {
                            console.log('Ipfs Avatar Hash:', colonyAvatarHash);
                          }
                        }

                        // fetch all tokens this colony has
                        if (colonyTokens && colonyTokens.length) {

                          console.log();

                          for (let colonySavedTokenIndex = 0; colonySavedTokenIndex < colonyTokens.length; colonySavedTokenIndex += 1) {
                            const colonySavedToken = await getToken(colonyTokens[colonySavedTokenIndex]);

                            // multi line display

                            // console.log();
                            // console.log('Saved Token Address:', colonySavedToken.address);
                            // console.log('Saved Token Name:', colonySavedToken.name);
                            // console.log('Saved Token Symbol:', colonySavedToken.symbol);
                            // console.log('Saved Token Decimals:', colonySavedToken.decimals);

                            // single line display

                            // create token
                            await attemptCreateToken(colonySavedToken);

                            // add token to colony
                            await attemptToAddTokenToColony(
                              utils.getAddress(currentColonyClient.address),
                              colonySavedToken.address,
                            );

                            console.log(
                              'Token Address:', colonySavedToken.address,
                              'Name:', colonySavedToken.name,
                              `(${colonySavedToken.symbol})`,
                            );
                          }
                        }

                        const metadataUpdateInput = {
                          id: utils.getAddress(currentColonyClient.address),
                          isWhitelistActivated,
                        };
                        if (colonyDisplayName) {
                          metadataUpdateInput.displayName = colonyDisplayName;
                        }
                        if (colonyAvatar && colonyAvatar.image) {
                          metadataUpdateInput.avatar = colonyAvatar.image;
                        }

                        /* Create the colony's metadata entry */
                        try {
                          await graphQL(
                            createColonyMetadata,
                            { input: metadataUpdateInput },
                            `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
                            { 'x-api-key': process.env.AWS_APPSYNC_KEY },
                          );
                        } catch (error) {
                          //
                        }
                      }
                    }
                  }

                  // domains
                  if (currentColonyDomains) {

                    console.log();

                    for (let subgraphDomainId = 0; subgraphDomainId < currentColonyDomains.length; subgraphDomainId += 1) {
                      const {
                        domainChainId: subgraphDomainChainId,
                        name: subgraphDomainName,
                        metadata: subgraphDomainMetadata,
                        metadataHistory: subgraphDomainMetadataHistory,
                      } = currentColonyDomains[subgraphDomainId];

                      const [mostRecentDomainMetadataHistory] = subgraphDomainMetadataHistory.sort(sortMetadataByTimestamp);
                      const subgraphDomainMetadataHash = subgraphDomainMetadata || (mostRecentDomainMetadataHistory && mostRecentDomainMetadataHistory.metadata);

                      // multi line display

                      // console.log();
                      // console.log('Subgraph Domain Id:', subgraphDomainChainId);
                      // console.log('Subgraph Domain Fallback Name:', subgraphDomainName);

                      //   if (subgraphDomainMetadataHash) {
                      //     const subgraphDomainMetadataValue = await getIpfsHash(subgraphDomainMetadataHash);

                      //     if (subgraphDomainMetadataValue) {
                      //       const {
                      //         domainName: OLD_subgraphDomainMetadataName,
                      //         domainColor: OLD_subgraphDomainMetadataColor,
                      //         domainPurpose: OLD_subgraphDomainMetadataPurpose,
                      //         data: {
                      //           domainName: subgraphDomainMetadataName,
                      //           domainColor: subgraphDomainMetadataColor,
                      //           domainPurpose: subgraphDomainMetadataPurpose,
                      //         } = {},
                      //       } = subgraphDomainMetadataValue;

                      //       console.log('Subgraph Domain Name:', subgraphDomainMetadataName || OLD_subgraphDomainMetadataName);
                      //       console.log('Subgraph Domain Color:', subgraphDomainMetadataColor || OLD_subgraphDomainMetadataColor);
                      //       console.log('Subgraph Domain Description:', subgraphDomainMetadataPurpose || OLD_subgraphDomainMetadataPurpose);
                      //     }
                      //   } else {
                      //     console.log('Subgraph Domain Name:', undefined);
                      //     console.log('Subgraph Domain Color:', undefined);
                      //     console.log('Subgraph Domain Description:', undefined);
                      //   }
                      // }

                      // single line display

                      let subgraphDomainMetadataValue = {
                        data: {
                          domainName: false,
                          domainColor: false,
                        },
                        domainName: false,
                        domainColor: false,
                      };
                      if (subgraphDomainMetadataHash) {
                        subgraphDomainMetadataValue = await getIpfsHash(subgraphDomainMetadataHash);
                      }

                      const domainName = `${subgraphDomainMetadataValue.domainName || subgraphDomainMetadataValue.data && subgraphDomainMetadataValue.data.domainName || subgraphDomainName},`;
                      const domainColor = DomainColorMap[subgraphDomainMetadataValue && subgraphDomainMetadataValue.domainColor || subgraphDomainMetadataValue && subgraphDomainMetadataValue.data && subgraphDomainMetadataValue.data.domainColor || 0];
                      const domainDescription = `${subgraphDomainMetadataValue.domainPurpose || subgraphDomainMetadataValue.data && subgraphDomainMetadataValue.data.domainPurpose || null},`;

                      const [skillId, fundingPotId] = await currentColonyClient.getDomain(
                        subgraphDomainChainId,
                      );

                      /* Create the domains's metadata entry */
                      try {
                        await graphQL(
                          createDomainMetadata,
                          {
                            input: {
                              id: `${utils.getAddress(currentColonyClient.address)}_${subgraphDomainChainId}`,
                              color: domainColor,
                              name: domainName,
                              description: domainDescription,
                            },
                          },
                          `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
                          { 'x-api-key': process.env.AWS_APPSYNC_KEY },
                        );
                      } catch (error) {
                        //
                      }

                      /* Create the domain entry */
                      try {
                        await graphQL(
                          createDomain,
                          {
                            input: {
                              id: `${utils.getAddress(currentColonyClient.address)}_${subgraphDomainChainId}`,
                              colonyId: utils.getAddress(currentColonyClient.address),
                              isRoot: parseInt(subgraphDomainChainId, 10) === 1,
                              nativeId: parseInt(subgraphDomainChainId, 10),
                              nativeSkillId: skillId.toNumber(),
                              nativeFundingPotId: fundingPotId.toNumber(),
                            },
                          },
                          `${process.env.AWS_APPSYNC_ADDRESS}/graphql`,
                          { 'x-api-key': process.env.AWS_APPSYNC_KEY },
                        );
                      } catch (error) {
                        //
                      }

                      console.log(
                        `Domain #${subgraphDomainChainId}`,
                        'Name:', domainName,
                        'Color:', domainColor,
                      );
                    }
                  }
                },
              );

              // colony server data
              const colonySubscribers = await runBlock(
                `colony-${colonyId}-server-data`,
                async () => {
                  const colonySubscribers = await getColonySubscribers(currentColonyClient.address);

                  // subscribers
                  if (colonySubscribers && colonySubscribers.length) {
                    console.log()

                    for (let colonySubscriberIndex = 0; colonySubscriberIndex < colonySubscribers.length; colonySubscriberIndex += 1) {

                      // multi line display

                      // console.log()
                      // console.log(`Subscriber #${colonySubscriberIndex + 1}`)
                      // console.log('Colony Subscriber Display Address:', colonySubscribers[colonySubscriberIndex].id);
                      // console.log('Colony Subscriber Name:', colonySubscribers[colonySubscriberIndex].profile.username);

                      // if (colonySubscribers[colonySubscriberIndex].profile.displayName) {
                      //   console.log('Colony Subscriber Display Name:', colonySubscribers[colonySubscriberIndex].profile.displayName);
                      // }

                      // if (colonySubscribers[colonySubscriberIndex].profile.avatarHash) {
                      //   const subscriberAvatar = await getIpfsHash(colonySubscribers[colonySubscriberIndex].profile.avatarHash);

                      //   if (subscriberAvatar.image) {
                      //     console.log('Colony Subscriber Avatar:', subscriberAvatar.image.slice(0, 40), '...');
                      //   } else {
                      //     console.log('Colony Subscriber Avatar Hash:', colonySubscribers[colonySubscriberIndex].profile.avatarHash);
                      //   }
                      // }

                      // single line display

                      let subscriberAvatar = { image: false };
                      if (colonySubscribers[colonySubscriberIndex].profile.avatarHash) {
                        subscriberAvatar = await getIpfsHash(colonySubscribers[colonySubscriberIndex].profile.avatarHash);
                      }

                      const profileObject = {
                        ...colonySubscribers[colonySubscriberIndex].profile,
                        name: colonySubscribers[colonySubscriberIndex].profile.username,
                      };

                      if (subscriberAvatar.image) {
                        profileObject.avatar = subscriberAvatar.image;
                      }

                      await attemptCreateUser(profileObject);

                      console.log(
                        `Subscriber #${colonySubscriberIndex + 1}`,
                        'Address:', colonySubscribers[colonySubscriberIndex].id,
                        'Name:', colonySubscribers[colonySubscriberIndex].profile.username,
                        colonySubscribers[colonySubscriberIndex].profile.displayName ? `(${colonySubscribers[colonySubscriberIndex].profile.displayName}) Avatar:` : 'Avatar:',
                        !!subscriberAvatar.image,
                      );
                    }
                  }

                  return colonySubscribers;
                },
              );

              return;

              // extensions
              const { extensionsHashMap, historicColonyExtensions } = await runBlock(
                `colony-${colonyId}-extension-data`,
                async () => {
                  const extensionsHashMap = {
                    [colonyJS.getExtensionHash('OneTxPayment')]: 'OneTxPayment',
                    [colonyJS.getExtensionHash('VotingReputation')]: 'VotingReputation',
                    [colonyJS.getExtensionHash('CoinMachine')]: 'CoinMachine',
                    [colonyJS.getExtensionHash('Whitelist')]: 'Whitelist',
                  }

                  // display purpouses only
                  // can be removed/disabled if it becomes a burden
                  const {
                    data: {
                      colonyExtensions: historicColonyExtensions = [],
                    } = {},
                  } = await graphQL(
                    getHistoricColonyExtensions,
                    {
                      colonyAddress: currentColonyClient.address.toLowerCase(),
                    },
                    process.env.SUBGRAPH_ADDRESS,
                  );

                  const currentColonyExtensions = {};
                  await Promise.all(
                    ['OneTxPayment', 'VotingReputation', 'CoinMachine', 'Whitelist'].map(async (extensionId) => {
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
                        if (extensionId !== 'OneTxPayment') {
                          initialized = !!extensionInitialisedEvents.length;
                        }

                        // const permissions = [];
                        // await Promise.all(
                        //   [0, 1, 2, 3, 5, 6].map(async (role) => {
                        //     const roleExists = await currentColonyClient.hasUserRole(
                        //       extensionAddress,
                        //       1, // root domain
                        //       role,
                        //     );
                        //     if (roleExists) {
                        //       permissions.push(role);
                        //     }
                        //   }),
                        // );

                        currentColonyExtensions[utils.getAddress(extensionAddress)] = {
                          address: utils.getAddress(extensionAddress),
                          name: extensionId,
                          hash: extensionHash,
                          deprecated,
                          initialized,
                          installedBy: receipt.from,
                          installedAt: timestamp,
                          version: version.toNumber(),
                          // permissions: permissions.sort(),
                        };
                      }
                    }),
                  )

                  console.log();

                  Object.keys(currentColonyExtensions).map(extensionAddress => {
                    const extension = currentColonyExtensions[extensionAddress];
                    // multi line display

                    // console.log();
                    // console.log('Chain Extension Address:', extension.address);
                    // console.log('Chain Extension Name:', extension.name);
                    // console.log('Chain Extension Installed By:', extension.installedBy);
                    // console.log('Chain Extension Installed At:', extension.installedAt);
                    // console.log('Chain Extension Version:', extension.version);
                    // // console.log(
                    // //   'Chain Extension Roles:',
                    // //   extension.permissions.map(role => colonyJS.ColonyRole[role]),
                    // // );
                    // if (extension.deprecated) {
                    //   console.log('Chain Extension Deprecated:', extension.deprecated);
                    // }

                    // single line display
                    console.log(
                      'Extension Address:', extension.address,
                      'Name:', extension.name,
                      'Version:', extension.version,
                      extension.deprecated ? '(Deprecated)' : true,
                    );
                  });

                  return { extensionsHashMap, historicColonyExtensions };
                },
              );

              // user permissions
              await runBlock(
                `colony-${colonyId}-permissions`,
                async () => {
                  let shouldFetchPermissionsEvents = true;
                  let currentColonyPermissionEvents = [];

                  if (args.showTimers) {
                    console.log();
                  }

                  while (shouldFetchPermissionsEvents) {
                    const {
                      data: {
                        events: permissionEvents = []
                      } = {}
                    } = await graphQL(
                      getPermissionsEvents,
                      {
                        colonyAddress: currentColonyClient.address.toLowerCase(),
                        upToBlock: args.endBlock,
                        first: parseInt(process.env.SUBGRAPH_BATCH_SIZE, 10),
                        skip: currentColonyPermissionEvents.length,
                      },
                      process.env.SUBGRAPH_ADDRESS,
                    );

                    if (permissionEvents.length) {
                      currentColonyPermissionEvents = [
                        ...currentColonyPermissionEvents,
                        ...permissionEvents,
                      ];
                    } else {
                      shouldFetchPermissionsEvents = false;
                    }

                    if (args.showTimers) {
                      console.log(`Fetched ${currentColonyPermissionEvents.length} permission events...`)
                    }

                    await throttle();
                  }

                  const reducedColonyPermissions = currentColonyPermissionEvents.reduce(
                    (reducedPermissions, currentPermissionsEvent) => {
                      const basePermissions = {
                        role_0: null,
                        role_1: null,
                        role_2: null,
                        role_3: null,
                        role_5: null,
                        role_6: null,
                      };
                      const values = JSON.parse(currentPermissionsEvent.args);
                      const { user, domainId = 1, role = 0, setTo } = values;
                      const userAddress = utils.getAddress(user);

                      // existing role entry
                      if (reducedPermissions[userAddress]) {

                        // existing domain entry
                        if (reducedPermissions[userAddress][domainId]) {
                          return {
                            ...reducedPermissions,
                            [userAddress]: {
                              ...reducedPermissions[userAddress],
                              [domainId]: {
                                ...reducedPermissions[userAddress][domainId],
                                [`role_${role}`]: setTo ? true : null,
                              },
                            },
                          };
                        }

                        // non existing domain entry
                        return {
                          ...reducedPermissions,
                          [userAddress]: {
                            ...reducedPermissions[userAddress],
                            [domainId]: {
                              ...basePermissions,
                              [`role_${role}`]: setTo ? true : null,
                            },
                          },
                        };
                      }

                      // non existing role entry
                      return {
                        ...reducedPermissions,
                        [userAddress]: {
                          [domainId]: {
                            ...basePermissions,
                            [`role_${role}`]: setTo ? true : null,
                          }
                        }
                      };
                    },
                    {},
                  )

                  console.log();

                  Object.keys(reducedColonyPermissions).map((addressWithPermissions, colonyPermissionsIndex) => {
                    const permissionsEntry = reducedColonyPermissions[addressWithPermissions];

                    // display purpouses only
                    const subscriber = colonySubscribers.find(({ id }) => id === addressWithPermissions);
                    const username = subscriber && subscriber.profile ? subscriber.profile.username : undefined;
                    const extension = historicColonyExtensions.find(({ id }) => id === addressWithPermissions.toLowerCase());
                    const extensionName = extension && extension.hash ? extensionsHashMap[extension.hash] : undefined;
                    // maybe colony and token as well...
                    const displayName = username || extensionName;

                    // multiline display

                    // console.log()
                    // console.log(`Permission Entry #${colonyPermissionsIndex + 1}`)
                    // console.log('Permissioned Address:', addressWithPermissions);
                    // if (displayName) {
                    //   console.log('Permissioned Name:', displayName);
                    // }
                    // Object.keys(permissionsEntry).map((domainId) => {
                    //   console.log(
                    //     `Permissions in Domain #${domainId}:`,
                    //     Object.keys(permissionsEntry[domainId]).map((roleName) => {
                    //       if (permissionsEntry[domainId][roleName]) {
                    //         return parseInt(roleName.replace('role_', ''), 10);
                    //       }
                    //     }).filter(entry => entry >= 0),
                    //   );
                    // });

                    // single line display

                    Object.keys(permissionsEntry).map((domainId) => {
                      const domainPermissions = Object.keys(permissionsEntry[domainId]).map((roleName) => {
                        if (permissionsEntry[domainId][roleName]) {
                          return parseInt(roleName.replace('role_', ''), 10);
                        }
                      }).filter(entry => entry >= 0);
                      console.log(
                        'Address w/ Permissions:', addressWithPermissions,
                        displayName ? `(${displayName}) Domain:` : 'Domain:',
                        `#${domainId}`,
                        'Roles:', domainPermissions,
                      );
                    });
                  });
                },
              );

              // actions
              await runBlock(
                `colony-${colonyId}-actions-data`,
                async () => {
                  let shouldFetchActions = true;
                  let currentColonyActions = [];

                  if (args.showTimers) {
                    console.log();
                  }

                  while (shouldFetchActions) {
                    const {
                      data: {
                        events = []
                      } = {},
                    } = await graphQL(
                      getActionEvents,
                      {
                        colonyAddress: currentColonyClient.address.toLowerCase(),
                        upToBlock: args.endBlock,
                        first: parseInt(process.env.SUBGRAPH_BATCH_SIZE, 10),
                        skip: currentColonyActions.length,
                      },
                      process.env.SUBGRAPH_ADDRESS,
                    );

                    if (events.length) {
                      currentColonyActions = [
                        ...currentColonyActions,
                        ...events,
                      ];
                    } else {
                      shouldFetchActions = false;
                    }

                    if (args.showTimers) {
                      console.log(`Fetched ${currentColonyActions.length} action related events...`);
                    }

                    await throttle();
                  }

                  const reducedColonyActions = currentColonyActions.reduce(
                    (reducedActions, currentAction) => {
                      const actionTxHash = currentAction.transaction.hash;
                      const actionName = currentAction.name;
                      const values = JSON.parse(currentAction.args);
                      if (reducedActions[actionTxHash]) {
                        return {
                          ...reducedActions,
                          [actionTxHash]: {
                            ...reducedActions[actionTxHash],
                            values: [
                              ...reducedActions[actionTxHash].values,
                              {
                                name: actionName,
                                ...values,
                              },
                            ],
                          },
                        };
                      }
                      const {
                        id,
                        address,
                        timestamp
                      } = currentAction;
                      return {
                        ...reducedActions,
                        [actionTxHash]: {
                          id,
                          address,
                          name: actionName,
                          transactionHash: actionTxHash,
                          timestamp,
                          values: [{
                            name: actionName,
                            ...values,
                          }],
                        }
                      };
                    },
                    {},
                  )

                  //  one tx payments

                  let shouldFetchOneTx = true;
                  let currentColonyOneTxs = [];

                  if (args.showTimers) {
                    console.log();
                  }

                  while (shouldFetchOneTx) {
                    const {
                      data: {
                        oneTxPayments = []
                      } = {}
                    } = await graphQL(
                      getOneTxPayments,
                      {
                        colonyAddress: currentColonyClient.address.toLowerCase(),
                        upToBlock: args.endBlock,
                        first: parseInt(process.env.SUBGRAPH_BATCH_SIZE, 10),
                        skip: currentColonyOneTxs.length,
                      },
                      process.env.SUBGRAPH_ADDRESS,
                    );

                    if (oneTxPayments.length) {
                      currentColonyOneTxs = [
                        ...currentColonyOneTxs,
                        ...oneTxPayments,
                      ];
                    } else {
                      shouldFetchOneTx = false;
                    }

                    if (args.showTimers) {
                      console.log(`Fetched ${currentColonyOneTxs.length} one tx related entities...`);
                    }

                    await throttle();
                  }

                  console.log();

                  Object.keys(reducedColonyActions).map((colonyActionTransactionHash, colonyActionIndex) => {
                    const colonyAction = reducedColonyActions[colonyActionTransactionHash];

                    // multi line display

                    // console.log()
                    // console.log(`Colony Action #${colonyActionIndex + 1}`)
                    // console.log('Colony Action Name:', colonyAction.name);
                    // console.log('Colony Action TX:', colonyAction.transactionHash);
                    // console.log('Colony Action Time:', colonyAction.timestamp);
                    // console.log('Colony Action Values:', colonyAction.values);

                    // single line display

                    console.log(
                      `Action #${colonyActionIndex + 1}`,
                      'TX:', colonyAction.transactionHash,
                      'Type:', detectActionType(colonyAction.values),
                    );
                  });

                  const actionsFromEventsCount = Object.keys(reducedColonyActions).length;

                  currentColonyOneTxs.map(({ transaction: { hash }}, index) => {
                    // single line display

                    console.log(
                      `Action #${actionsFromEventsCount + 1 + index}`,
                      'TX:', hash,
                      'Type:', ColonyActionType.Payment,
                    );
                  });
                },
              );

              // motions
              await runBlock(
                `colony-${colonyId}-motions`,
                async () => {
                  let shouldFetchMotions = true;
                  let currentColonyMotions = [];

                  if (args.showTimers) {
                    console.log();
                  }

                  while (shouldFetchMotions) {
                    const {
                      data: {
                        motions = [],
                      } = {}
                    } = await graphQL(
                      getMotions,
                      {
                        colonyAddress: currentColonyClient.address.toLowerCase(),
                        upToBlock: args.endBlock,
                        first: parseInt(process.env.SUBGRAPH_BATCH_SIZE, 10),
                        skip: currentColonyMotions.length,
                      },
                      process.env.SUBGRAPH_ADDRESS,
                    );

                    if (motions.length) {
                      currentColonyMotions = [
                        ...currentColonyMotions,
                        ...motions,
                      ];
                    } else {
                      shouldFetchMotions = false;
                    }

                    if (args.showTimers) {
                      console.log(`Fetched ${currentColonyMotions.length} motions...`)
                    }

                    await throttle();
                  }

                  const oneTxPaymentClient = await currentColonyClient.getExtensionClient('OneTxPayment');
                  const votingReputationClient = await currentColonyClient.getExtensionClient('VotingReputation');

                  console.log();

                  currentColonyMotions.map(({
                    action,
                    fundamentalChainId,
                    transaction: { hash },
                    extensionAddress,
                  }, index) => {
                    if (action === '0x') {
                      return;
                    }
                    let parsedData;
                    try {
                      parsedData = currentColonyClient.interface.parseTransaction({ data: action });
                    } catch (error) {
                      // attempt with the one tx client
                      parsedData = oneTxPaymentClient.interface.parseTransaction({ data: action });
                    }

                    // single line display
                    console.log(
                      `Motion #${index + 1}`,
                      `Fundamental #${fundamentalChainId}`,
                      `TX: ${hash}`,
                      `Type: ${detectMotionType(parsedData)}`,
                      extensionAddress !== votingReputationClient.address.toLowerCase() ? `(Uninstalled)` : true,
                    );
                  });

                },
              );

              // decisions
              await runBlock(
                `colony-${colonyId}-decisions`,
                async () => {
                  let shouldFetchDecisions = true;
                  let currentColonyDecisions = [];

                  if (args.showTimers) {
                    console.log();
                  }

                  while (shouldFetchDecisions) {
                    const {
                      data: {
                        decisions = [],
                      } = {}
                    } = await graphQL(
                      getDecisions,
                      {
                        colonyAddress: currentColonyClient.address.toLowerCase(),
                        upToBlock: args.endBlock,
                        first: parseInt(process.env.SUBGRAPH_BATCH_SIZE, 10),
                        skip: currentColonyDecisions.length,
                      },
                      process.env.SUBGRAPH_ADDRESS,
                    );

                    if (decisions.length) {
                      currentColonyDecisions = [
                        ...currentColonyDecisions,
                        ...decisions,
                      ];
                    } else {
                      shouldFetchDecisions = false;
                    }

                    if (args.showTimers) {
                      console.log(`Fetched ${currentColonyDecisions.length} decisions...`)
                    }

                    await throttle();
                  }

                  // dynamic query so that we can overcome the subgraph filtering per transaction
                  // while simultaneously reducing the number of queries
                  const { data: decisionAnnotations = {} } = await graphQL(
                    /* GraphQL */ `
                      query Annotations {
                        ${currentColonyDecisions.map(({ transaction: { hash } }, index) => getAnnotationsChunk(`txAnnotation${index}`, hash))}
                      }
                    `,
                    {},
                    process.env.SUBGRAPH_ADDRESS,
                  );

                  let decisionsMetadata = {};
                  await Promise.all(
                    Object.keys(decisionAnnotations).map(async (annotationKey) => {
                      const [{ args }] = decisionAnnotations[annotationKey];
                      const { metadata, txHash } = JSON.parse(args);
                      const ipfsData = await getIpfsHash(metadata);
                      decisionsMetadata[txHash] = {
                        metadata,
                        ...ipfsData,
                      };
                    }),
                  );

                  const votingReputationClient = await currentColonyClient.getExtensionClient('VotingReputation');

                  console.log();

                  currentColonyDecisions.map((
                    {
                      transaction: { hash },
                      fundamentalChainId,
                      extensionAddress
                    },
                    index,
                  ) => {
                    // single line display
                    const { data: { title } = { title: '' } } = decisionsMetadata[hash];
                    console.log(
                      `Decision #${index + 1}`,
                      `Fundamental #${fundamentalChainId}`,
                      `TX: ${hash}`,
                      `Title:`, title.length >= 21 ? `${title.slice(0, 18)}...` : title,
                      extensionAddress !== votingReputationClient.address.toLowerCase() ? `(Uninstalled)` : true,
                    );
                  });
                },
              );

              // end individual colony
              if (args.showTimers) {
                console.log();
              }
            },
          );

          // end total
          if (args.showTimers) {
            console.log();
          }
        }
      }
    },
  );
};

run();
