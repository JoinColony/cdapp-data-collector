// subgraph

export const getColony = /* GraphQL */ `
  query GetColony($address: String!, $upToBlock: Int!) {
    colony(
      id: $address,
      block: { number: $upToBlock }
    ) {
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
    domains(
      block: { number: $upToBlock },
      where: { colonyAddress: $address }
    ) {
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
  query ActionEvents($colonyAddress: String!, $upToBlock: Int!, $first: Int = 10, $skip: Int = 0) {
    events(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      block: { number: $upToBlock },
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
        block {
          timestamp
          number: id
        }
      }
      name
      args
      timestamp
    }
  }
`;

export const getOneTxPayments = /* GraphQL */ `
  query OneTxPayments($colonyAddress: String!, $upToBlock: Int!, $first: Int = 10, $skip: Int = 0) {
    oneTxPayments(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      block: { number: $upToBlock },
      where: { payment_contains: $colonyAddress }
    ) {
      id
      address: agent
      transaction {
        hash: id
        block {
          timestamp
          number: id
        }
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
  query Motions($colonyAddress: String!, $upToBlock: Int!, $first: Int = 10, $skip: Int = 0) {
    motions(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      block: { number: $upToBlock },
      where: {
        associatedColony: $colonyAddress,
        action_not: "0x12345678" # decisions
      }
    ) {
      id
      fundamentalChainId
      transaction {
        hash: id
        block {
          timestamp
          number: id
        }
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

export const getDecisions = /* GraphQL */ `
  query Motions($colonyAddress: String!, $upToBlock: Int!, $first: Int = 10, $skip: Int = 0) {
    decisions: motions(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      block: { number: $upToBlock },
      where: {
        associatedColony: $colonyAddress,
        action: "0x12345678" # decisions
      }
    ) {
      id
      fundamentalChainId
      transaction {
        hash: id
        block {
          timestamp
          number: id
        }
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

// Not that this is a query "chunk" as it needs to be used dinamically
// It cannot be called directly
export const getAnnotationsChunk = (name, transactionHash) => `
  ${name}: events(
    where: {
      name_contains: "Annotation",
      args_contains: "${transactionHash}",
    }
  ) {
    transaction {
      hash: id
    }
    args
  }
`;

export const getPermissionsEvents = /* GraphQL */ `
  query PermissionsEvents($colonyAddress: String!, $upToBlock: Int!, $first: Int = 10, $skip: Int = 0) {
    events(
      first: $first,
      skip: $skip,
      orderBy: "timestamp",
      orderDirection: asc,
      block: { number: $upToBlock }
      where: {
        associatedColony_contains: $colonyAddress,
        name_in: [
          "ColonyRoleSet(address,address,uint256,uint8,bool)",
          "RecoveryRoleSet(address,bool)",
        ]
      }) {
      name
      args
      transaction {
        block {
          timestamp
          number: id
        }
      }
    }
  }
`;

// display purpouses only, not really needed for data fetching,
// hence the hard limit at 1000

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

// AppSync

export const getTokenByAddress = /* GraphQL */ `
  query GetTokenByAddress($address: ID!) {
    getTokenByAddress(id: $address ) {
      items {
        address: id
      }
    }
  }
`;

// used to detect if a particular token was already added to a colony
export const getColonyToken = /* GraphQL */ `
  query getColonyToken($colonyAddress: ID!, $tokenAddress: ID!) {
    listColonyTokens(
      filter: {
        tokenID: { eq: $tokenAddress },
        colonyID: { eq: $colonyAddress }
      }
    ) {
      items {
        id
      }
    }
  }
`;

export const getUserByName = /* GraphQL */ `
  query GetUserByName($name: String!) {
    getUserByName(name: $name ) {
      items {
        name
      }
    }
  }
`;

// used to detect if a particular user is already subscribed to a colony
export const getWatchedColonies = /* GraphQL */ `
  query getWatchedColonies($colonyAddress: ID!, $userAddress: ID!) {
    listWatchedColonies(
      filter: {
        userID: { eq: $userAddress },
        colonyID: { eq: $colonyAddress }
      }
    ) {
      items {
        id
      }
    }
  }
`;

// used to detect if  a particular token was added to a user
export const getUserToken = /* GraphQL */ `
  query GetUserToken($userAddress: ID!, $tokenAddress: ID!) {
    listUserTokens(
      filter: {
        tokenID: { eq: $tokenAddress },
        userID: { eq: $userAddress }
      }
    ) {
      items {
        id
      }
    }
  }
`;

// used as a makeshift way of reversing the domainId from the skillId
export const getDomainFromSkill = /* GraphQL */ `
  query GetDomainFromSkill($colonyAddress: ID!, $skillId: Int!) {
    listDomains(
      filter: {
        colonyId: {eq: $colonyAddress },
        nativeSkillId: { eq: $skillId }
      }
    ) {
      items {
        nativeId
        id
      }
    }
  }
`;
