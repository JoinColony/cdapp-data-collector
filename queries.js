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
          "RecoveryRoleSet(address,bool)",
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
      }
      name
      args
      timestamp
    }
  }
`;

export const getOneTxPayments = /* GraphQL */ `
  query OneTxPayments($colonyAddress: String!, $first: Int = 10, $skip: Int = 0) {
    oneTxPayments(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      where: { payment_contains: $colonyAddress }
    ) {
      id
      address: agent
      transaction {
        hash: id
      }
      payment {
        recipient: to
        domain {
          ethDomainId: domainChainId
          name
        }
        fundingPot {
          fundingPotPayouts {
            id
            token {
              address: id
              symbol
              decimals
            }
            amount
          }
        }
      }
      timestamp
    }
  }
`;

export const getMotions = /* GraphQL */ `
  query Motions($colonyAddress: String!, $first: Int = 10, $skip: Int = 0) {
    motions(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      where: {
        associatedColony: $colonyAddress,
        action_not: "0x12345678" # decisions
      }
    ) {
      id
      fundamentalChainId
      transaction {
        hash: id
      }
      extensionAddress
      address: agent
      domain {
        ethDomainId: domainChainId
        name
      }
      stakes
      requiredStake
      escalated
      action
    }
  }
`;

export const getPermissionsEvents = /* GraphQL */ `
  query PermissionsEvents($colonyAddress: String!, $first: Int = 10, $skip: Int = 0) {
    events(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      where: {
        associatedColony_contains: $colonyAddress,
        name_in: [
          "ColonyRoleSet(address,address,uint256,uint8,bool)",
          "RecoveryRoleSet(address,bool)",
        ]
      }) {
      name
      args
    }
  }
`;

export const getHistoricColonyExtensions = /* GraphQL */ `
  query HistoricColonyExtensions($colonyAddress: String!) {
    colonyExtensions(
      first: 1000,
      where: {
        colony_contains: $colonyAddress,
      }) {
      id
      hash
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
