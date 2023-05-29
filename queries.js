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
