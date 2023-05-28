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
      extensions {
        address: id
        hash
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
