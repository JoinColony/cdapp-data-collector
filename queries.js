// subgraph

export const getColony = /* GraphQL */ `
  query GetColony($address: String!) {
    colony(id: $address) {
      id
      colonyChainId
      ensName
      metadata
      metadataHistory {
        id
        metadata
        transaction {
          block {
            timestamp
          }
        }
      }
      token {
        tokenAddress: id
        decimals
        symbol
      }
    }
    domains(where: { colonyAddress: $address }) {
      id
      domainChainId
      parent {
        id
        domainChainId
      }
      name
      metadata
      metadataHistory {
        id
        metadata
        transaction {
          block {
            timestamp
          }
        }
      }
    }
  }
`;

export const getExtensionEvents = /* GraphQL */ `
  query SubgraphExtensionEvents($colonyAddress: String!, $extensionAddress: String!) {
    extensionInstalledEvents: events(
      orderBy: "timestamp",
      orderDirection: desc,
      where: {
        name_contains: "ExtensionInstalled",
        args_contains: $colonyAddress,
      }
    ) {
      id
      address
      name
      args
      transaction {
        id
        transactionHash: id
        block {
          id
          number: id
          timestamp
        }
      }
      timestamp
    }
    extensionInitialisedEvents: events(
      orderBy: "timestamp",
      orderDirection: desc,
      where: {
        name_contains: "ExtensionInitialised",
        address: $extensionAddress
      }
    ) {
      id
      address
      name
      args
      transaction {
        id
        transactionHash: id
        block {
          id
          number: id
          timestamp
        }
      }
      timestamp
    }
  }
`;

export const getActionEvents = /* GraphQL */ `
  query ActionEvents($colonyAddress: String!, $first: Int = 10, $skip: Int = 0) {
    events(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      where: {
        associatedColony_contains: $colonyAddress,
        name_in: [
          "TokensMinted(address,address,uint256)",
          "DomainAdded(address,uint256)",
          "ColonyMetadata(address,string)",
          "ColonyFundsMovedBetweenFundingPots(address,uint256,uint256,uint256,address)",
          "DomainMetadata(address,uint256,string)",
          "ColonyRoleSet(address,address,uint256,uint8,bool)",
          "ColonyUpgraded(address,uint256,uint256)",
          "ColonyUpgraded(uint256,uint256)",
          "RecoveryModeEntered(address)",
          "ArbitraryReputationUpdate(address,address,uint256,int256)",
          "TokenUnlocked(address)",
          "TokenUnlocked()",
          "ArbitraryTransaction(address,bytes,bool)",
        ]
      }) {
      id
      address
      transaction {
        hash: id
        # block {
        #   id
        #   timestamp
        # }
      }
      name
      args
      timestamp
    }
  }
`;

// server

export const getColonyMembers = /* GraphQL */ `
  query GetColonyMembers($address: String!) {
    subscribedUsers(colonyAddress: $address) {
      id
      profile {
        username
        avatarHash
        displayName
        bio
        walletAddress
        location
        website
      }
      colonyAddresses
      tokenAddresses
    }
  }
`;

export const getUser = /* GraphQL */ `
  query GetUser($address: String!) {
    user(address: $address) {
      id
      profile {
        username
        avatarHash
        displayName
        bio
        walletAddress
        location
        website
      }
      colonyAddresses
      tokenAddresses
    }
  }
`;
